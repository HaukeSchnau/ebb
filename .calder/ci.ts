import { Action, Files, Calder, On, Task, cmd } from "@calder-ci/core"
import { Alchemy, Bun } from "@calder-ci/std"
import { flake } from "./flake.ts"
import * as WebStore from "./WebStore.ts"

const shell = flake.devShells.ci
const install = Bun.install({ shell })

/** The extension as the store gets it: dist/ and its zip. */
const build = Task.make("build", {
  shell,
  setup: install,
  run: cmd`bun run zip`,
  inputs: Files.glob("src/**", "static/**", "tsconfig.json", "tsconfig.build.json"),
  outputs: { dist: "dist", zip: "ebb.zip" },
})

/** Types and unit tests. */
const qa = Task.make("qa", { shell, setup: install, run: cmd`bun run qa` })

/** That exact build in Chromium. Its screenshots stay downloadable from the run, also when a check fails. */
const e2e = Task.make("e2e", {
  shell: flake.devShells.e2e,
  setup: install,
  run: cmd`bun e2e/extension.ts ${build.outputs.dist} e2e/out`,
  inputs: Files.of("e2e/extension.ts"),
  outputs: { screenshots: "e2e/out" },
})

/**
 * Submits the build once qa and e2e pass, when its manifest names a version the store doesn't have
 * yet: bumping the version and pushing is the release. Every other push ends as `Unchanged`.
 */
const release = Action.make("release", {
  needs: { zip: build.outputs.zip, dist: build.outputs.dist },
  after: [qa, e2e],
  grants: { secrets: ["chrome-web-store"] },
}, function*({ zip, dist }) {
  return yield* WebStore.release(
    { publisher: "dea543f7-3e2f-4398-8805-c6aeedf8fdb7", id: "jifmboaehilnoobbnfffolkhioeknlne" },
    { zip, manifest: `${dist}/manifest.json` },
  )
})

/** The website (alchemy.run.ts). It only needs qa to deploy; the extension's browser test gates the release. */
const website = { shell, setup: install, runner: "bun", env: "cloudflare" } satisfies Alchemy.Stack

export default Calder.project({
  rules: [
    On.pullRequest([qa, e2e]),
    On.preview(Alchemy.preview(website, { url: (pr) => `https://pr-${pr}-ebb.hauke-911.workers.dev`, after: [qa] })),
    On.pullRequestClosed([Alchemy.destroy(website)]),
    On.push("main", [release, Alchemy.deploy(website, { stage: "prod", after: [qa] })]),
  ],
})
