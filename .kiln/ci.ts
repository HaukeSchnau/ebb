import { Action, Kiln, On, Task, cmd } from "@kiln/core"
import { Bun } from "@kiln/std"
import { flake } from "./flake.ts"
import * as WebStore from "./WebStore.ts"

const shell = flake.devShells.ci
const install = Bun.install({ shell })

/** Types, tests and the package the store gets, with its manifest so the release knows the version. */
export const qa = Task.make("qa", {
  shell,
  setup: install,
  run: cmd`bun run qa`,
  outputs: { zip: "ebb.zip", manifest: "dist/manifest.json" },
})

/**
 * Submits that exact zip when its manifest names a version the store doesn't have yet, so bumping
 * the version and pushing is the release. Every other push ends as `Unchanged`.
 */
export const release = Action.make("release", {
  needs: { zip: qa.outputs.zip, manifest: qa.outputs.manifest },
  grants: { secrets: ["chrome-web-store"] },
}, function*(files) {
  return yield* WebStore.release({ publisher: "dea543f7-3e2f-4398-8805-c6aeedf8fdb7", id: "jifmboaehilnoobbnfffolkhioeknlne" }, files)
})

export default Kiln.project({ rules: [On.pullRequest([qa]), On.push("main", [release])] })
