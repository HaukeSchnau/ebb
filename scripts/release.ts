// Submits a packaged Ebb to the Chrome Web Store when its version is newer than what the store has.
//
//   GOOGLE_SERVICE_ACCOUNT=key.json bun scripts/release.ts ebb.zip [--dry-run]
//
// Safe to run on every push: it does nothing when the store already has this version.
import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";

const PUBLISHER = "dea543f7-3e2f-4398-8805-c6aeedf8fdb7";
const ITEM = "jifmboaehilnoobbnfffolkhioeknlne";
const NAME = `publishers/${PUBLISHER}/items/${ITEM}`;
const API = "https://chromewebstore.googleapis.com";

type Key = { client_email: string; private_key: string; token_uri: string };
type ItemState = "PENDING_REVIEW" | "STAGED" | "PUBLISHED" | "PUBLISHED_TO_TESTERS" | "REJECTED" | "CANCELLED";
type Revision = { state?: ItemState; distributionChannels?: { crxVersion?: string }[] };
type Status = {
  publishedItemRevisionStatus?: Revision;
  submittedItemRevisionStatus?: Revision;
  lastAsyncUploadState?: string;
  takenDown?: boolean;
};

const [zipPath, ...flags] = process.argv.slice(2);
const dryRun = flags.includes("--dry-run");
const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT;
if (!zipPath || !keyPath) {
  console.error("usage: GOOGLE_SERVICE_ACCOUNT=key.json bun scripts/release.ts ebb.zip [--dry-run]");
  process.exit(2);
}

const manifest: { version: string } = await Bun.file(new URL("../static/manifest.json", import.meta.url)).json();
const version = manifest.version;
const token = await accessToken(JSON.parse(readFileSync(keyPath, "utf8")) as Key);

const status = await api<Status>("GET", `/v2/${NAME}:fetchStatus`);
const published = versionOf(status.publishedItemRevisionStatus);
const submitted = status.submittedItemRevisionStatus;
const pending = versionOf(submitted);
console.log(`store: published ${published ?? "nothing"}, submitted ${pending ?? "nothing"} (${submitted?.state ?? "-"}); this revision: ${version}`);

if (status.takenDown) fail("the item was taken down; fix that in the dashboard first");
if (published && compare(version, published) <= 0) done(`${version} is not newer than the published ${published}, nothing to do`);
if (pending === version && (submitted?.state === "PENDING_REVIEW" || submitted?.state === "STAGED")) {
  done(`${version} is already ${submitted.state === "STAGED" ? "approved and staged" : "in review"}`);
}
if (dryRun) done(`would ${pending && submitted?.state === "PENDING_REVIEW" ? `cancel the review of ${pending}, then ` : ""}upload ${zipPath} and submit ${version}`);

if (pending && submitted?.state === "PENDING_REVIEW" && compare(version, pending) > 0) {
  // A newer version replaces the one waiting in review; it carries everything the older one had.
  await api("POST", `/v2/${NAME}:cancelSubmission`);
  console.log(`cancelled the review of ${pending}`);
}

const upload = await api<{ uploadState?: string; crxVersion?: string }>("POST", `/upload/v2/${NAME}:upload`, Bun.file(zipPath));
let state = upload.uploadState;
for (let waited = 0; state === "IN_PROGRESS" || state === "UPLOAD_IN_PROGRESS"; waited += 5) {
  if (waited >= 300) fail("the upload was still processing after five minutes");
  await Bun.sleep(5000);
  state = (await api<Status>("GET", `/v2/${NAME}:fetchStatus`)).lastAsyncUploadState;
}
if (state !== "SUCCEEDED") fail(`upload ended in state ${state}`);
console.log(`uploaded ${upload.crxVersion ?? version}`);

const submission = await api<{ state?: ItemState }>("POST", `/v2/${NAME}:publish`, JSON.stringify({ publishType: "DEFAULT_PUBLISH" }));
done(`submitted ${version}: ${submission.state ?? "unknown state"}, publishes automatically once approved`);

// ----------------------------------------------------------------------------

function versionOf(revision: Revision | undefined): string | undefined {
  return revision?.distributionChannels?.[0]?.crxVersion;
}

function compare(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function accessToken(key: Key): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/chromewebstore",
    aud: key.token_uri,
    iat: now,
    exp: now + 600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(key.private_key).toString("base64url");
  const response = await fetch(key.token_uri, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${signature}` }),
  });
  if (!response.ok) fail(`token request failed: ${response.status} ${await response.text()}`);
  return ((await response.json()) as { access_token: string }).access_token;
}

async function api<T = unknown>(method: "GET" | "POST", path: string, body?: Blob | string): Promise<T> {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      ...(typeof body === "string" ? { "content-type": "application/json" } : {}),
    },
    ...(body === undefined ? {} : { body }),
  });
  const text = await response.text();
  if (!response.ok) fail(`${method} ${path} failed: ${response.status} ${text}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function done(message: string): never {
  console.log(message);
  process.exit(0);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}
