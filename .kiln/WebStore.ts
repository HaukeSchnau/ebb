import { Kiln, Secret } from "@kiln/core"
import { Effect, Redacted, Schema } from "effect"
import { HttpClient, HttpClientRequest, HttpClientResponse } from "effect/http"
import { createSign } from "node:crypto"
import { decide } from "./decide.ts"

const API = "https://chromewebstore.googleapis.com"

export class Submitted extends Kiln.Result<Submitted>("ebb/WebStore")("Submitted", {
  version: Schema.String,
  /** The older version this one took out of review, if any. */
  replaced: Schema.NullOr(Schema.String),
  state: Schema.String,
}) {}

export class Unchanged extends Kiln.Result<Unchanged>("ebb/WebStore")("Unchanged", {
  version: Schema.String,
  reason: Schema.String,
}) {}

export class Blocked extends Kiln.Failure<Blocked>("ebb/WebStore")("Blocked", { reason: Schema.String }) {
  override get message() {
    return this.reason
  }
}

export class Refused extends Kiln.Failure<Refused>("ebb/WebStore")("Refused", {
  call: Schema.String,
  status: Schema.Number,
  body: Schema.String,
}) {
  override get message() {
    // The store only says the submission "does not meet the requirements"; so far that was a dashboard field.
    const hint = this.body.includes("INVALID_ITEM_METADATA")
      ? " Usually a new permission needs a justification on the dashboard's Privacy tab (store/listing.md has the text). The upload is in place, so rerun after saving it."
      : ""
    return `${this.call} failed with ${this.status}: ${this.body}${hint}`
  }
}

export class UploadFailed extends Kiln.Failure<UploadFailed>("ebb/WebStore")("UploadFailed", { state: Schema.String }) {
  override get message() {
    return `the upload ended in ${this.state}`
  }
}

const Key = Schema.Struct({ client_email: Schema.String, private_key: Schema.String, token_uri: Schema.String })
const Manifest = Schema.Struct({ version: Schema.String })
const Token = Schema.Struct({ access_token: Schema.String })
const Revision = Schema.Struct({
  state: Schema.optional(Schema.String),
  distributionChannels: Schema.optional(Schema.Array(Schema.Struct({ crxVersion: Schema.optional(Schema.String) }))),
})
const Status = Schema.Struct({
  publishedItemRevisionStatus: Schema.optional(Revision),
  submittedItemRevisionStatus: Schema.optional(Revision),
  lastAsyncUploadState: Schema.optional(Schema.String),
  takenDown: Schema.optional(Schema.Boolean),
})
const Upload = Schema.Struct({ uploadState: Schema.optional(Schema.String) })
const Publish = Schema.Struct({ state: Schema.optional(Schema.String) })

const UPLOADING = new Set(["IN_PROGRESS", "UPLOAD_IN_PROGRESS"])

/** A service-account JWT for the Web Store scope, exchanged for an access token. */
const assertion = (key: typeof Key.Type) => {
  const now = Math.floor(Date.now() / 1000)
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url")
  const claims = { iss: key.client_email, scope: "https://www.googleapis.com/auth/chromewebstore", aud: key.token_uri, iat: now, exp: now + 600 }
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode(claims)}`
  return `${unsigned}.${createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url")}`
}

/**
 * Submits `zip` when its manifest names a version the store has neither published nor in review.
 * A newer version replaces an older one still waiting in review. Safe to run on every push.
 */
export const release = Effect.fn("WebStore.release")(function*(
  item: { readonly publisher: string; readonly id: string },
  files: { readonly zip: string; readonly manifest: string },
) {
  const client = yield* HttpClient.HttpClient
  const name = `publishers/${item.publisher}/items/${item.id}`
  const { version } = yield* Schema.decodeUnknownEffect(Manifest)(yield* Effect.promise(() => Bun.file(files.manifest).json()))
  const secret = yield* Secret.value("chrome-web-store")
  const key = yield* Schema.decodeUnknownEffect(Key)(JSON.parse(Redacted.value(secret)))

  const call = (label: string, request: HttpClientRequest.HttpClientRequest) =>
    client.execute(request).pipe(
      Effect.flatMap((response) =>
        response.status < 300
          ? Effect.succeed(response)
          : response.text.pipe(Effect.flatMap((body) => Effect.fail(new Refused({ call: label, status: response.status, body }))))
      ),
    )

  const token = yield* call("token", HttpClientRequest.post(key.token_uri).pipe(
    HttpClientRequest.bodyUrlParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: assertion(key) }),
  )).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Token)))
  const store = (label: string, request: HttpClientRequest.HttpClientRequest) =>
    call(label, request.pipe(HttpClientRequest.bearerToken(token.access_token)))
  const status = store("fetchStatus", HttpClientRequest.get(`${API}/v2/${name}:fetchStatus`)).pipe(
    Effect.flatMap(HttpClientResponse.schemaBodyJson(Status)),
  )

  const decision = decide(version, yield* status)
  if (decision.kind === "blocked") return yield* new Blocked({ reason: decision.reason })
  if (decision.kind === "unchanged") return new Unchanged({ version, reason: decision.reason })

  if (decision.cancel !== undefined) yield* store("cancelSubmission", HttpClientRequest.post(`${API}/v2/${name}:cancelSubmission`))

  const bytes = yield* Effect.promise(() => Bun.file(files.zip).bytes())
  const uploaded = yield* store("upload", HttpClientRequest.post(`${API}/upload/v2/${name}:upload`).pipe(
    HttpClientRequest.bodyUint8Array(bytes, "application/zip"),
  )).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Upload)))
  let state = uploaded.uploadState ?? "UPLOAD_STATE_UNSPECIFIED"
  for (let waited = 0; UPLOADING.has(state) && waited < 60; waited++) {
    yield* Effect.sleep("5 seconds")
    state = (yield* status).lastAsyncUploadState ?? state
  }
  if (state !== "SUCCEEDED") return yield* new UploadFailed({ state })

  const submitted = yield* store("publish", HttpClientRequest.post(`${API}/v2/${name}:publish`).pipe(
    HttpClientRequest.bodyJsonUnsafe({ publishType: "DEFAULT_PUBLISH" }),
  )).pipe(Effect.flatMap(HttpClientResponse.schemaBodyJson(Publish)))
  return new Submitted({ version, replaced: decision.cancel ?? null, state: submitted.state ?? "unknown" })
})
