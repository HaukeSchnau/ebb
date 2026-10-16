import * as Alchemy from "alchemy"
import * as Cloudflare from "alchemy/Cloudflare"
import * as Effect from "effect/Effect"

const productionStage = "prod"

const headers = `
/*
  Referrer-Policy: strict-origin-when-cross-origin
  X-Content-Type-Options: nosniff
`

/**
 * The website (site/), served by Cloudflare's asset layer without a script. Production answers at
 * ebb.schnau.dev. Any other stage, such as pr-42, is a Worker Preview of production at
 * https://pr-42-ebb.hauke-911.workers.dev.
 */
export default Alchemy.Stack(
  "Ebb",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const { stage } = yield* Alchemy.Stack
    const site = yield* Cloudflare.Website.StaticSite("Site", {
      command: "bun run site",
      outdir: "dist-site",
      memo: false,
      compatibility: { date: "2026-10-01" },
      assets: { headers },
      ...(stage === productionStage
        ? { name: "ebb", workersDev: { enabled: false, previewsEnabled: true }, domain: "ebb.schnau.dev" }
        : { preview: { of: yield* Cloudflare.Worker.ref("Site", { stage: productionStage }) } }),
    })
    return { url: site.url }
  }),
)
