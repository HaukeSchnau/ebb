import { Kiln, On, Secret, Task, cmd } from "@kiln/core"
import { Bun } from "@kiln/std"
import { flake } from "./flake.ts"

const shell = flake.devShells.ci
const install = Bun.install({ shell })

/** Types, tests and the package the store gets. The release uploads exactly this zip. */
export const qa = Task.make("qa", { shell, setup: install, run: cmd`bun run qa`, outputs: { zip: "ebb.zip" } })

/**
 * Submits the zip to the Chrome Web Store when static/manifest.json names a version the store
 * doesn't have yet, so bumping the version and pushing is the release. Every other push is a no-op.
 */
export const release = Task.make("release", {
  shell,
  setup: install,
  run: cmd`bun scripts/release.ts ${qa.outputs.zip}`,
  secrets: { GOOGLE_SERVICE_ACCOUNT: Secret.file("chrome-web-store") },
})

export default Kiln.project({ rules: [On.pullRequest([qa]), On.push("main", [release])] })
