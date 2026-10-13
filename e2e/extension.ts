// Loads a built Ebb into Chromium and uses it the way a person would: install, Clear window and
// undo, a sweep that spares a kept tab, the panel's search and keys, and returning to a URL.
// It also checks the layout bugs 0.4.0 shipped with, and saves screenshots.
//
//   bun e2e/extension.ts <dist> [out]
//
// Exits 1 when a check fails.
import puppeteer, { type Page } from "puppeteer-core"
import { mkdirSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const [distArg, outArg = "e2e/out"] = process.argv.slice(2)
if (!distArg) {
  console.error("usage: bun e2e/extension.ts <dist> [out]")
  process.exit(2)
}
const dist = resolve(distArg)
const out = resolve(outArg)
mkdirSync(out, { recursive: true })
const chromium = process.env.CHROMIUM ?? Bun.which("chromium") ?? Bun.which("chromium-browser")
if (!chromium) {
  console.error("no chromium on PATH; set CHROMIUM")
  process.exit(2)
}

let failures = 0
function check(label: string, ok: boolean, detail = "") {
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${detail ? ` · ${detail}` : ""}`)
  if (!ok) failures++
}

async function until<T>(probe: () => Promise<T | undefined | null | false>, timeoutMs: number): Promise<T | undefined> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const value = await probe()
    if (value) return value
    await Bun.sleep(250)
  }
  return undefined
}

const site = Bun.serve({
  port: 0,
  fetch: (request) => {
    const name = new URL(request.url).pathname.slice(1) || "home"
    return new Response(`<title>Page ${name}</title><h1>${name}</h1>`, { headers: { "content-type": "text/html" } })
  },
})
const url = (name: string) => `http://127.0.0.1:${site.port}/${name}`

const errors: string[] = []
const launch = (dumpio: boolean) =>
  puppeteer.launch({
    executablePath: chromium,
    headless: true,
    pipe: true,
    dumpio,
    enableExtensions: [dist],
    args: ["--no-sandbox", "--no-first-run", "--disable-dev-shm-usage", "--lang=en-US"],
    userDataDir: mkdtempSync(join(tmpdir(), "ebb-e2e-")),
  })
// When Chromium dies at startup Puppeteer only says the pipe closed; a second try shows Chromium's own output.
const browser = await launch(false).catch((error: unknown) => {
  console.error(`Chromium didn't start (${error}). Again, with its output:`)
  return launch(true)
})

try {
  const workerTarget = await browser.waitForTarget((t) => t.type() === "service_worker" && t.url().endsWith("/background.js"))
  const worker = (await workerTarget.worker())!
  const extension = new URL(workerTarget.url()).host
  worker.on("console", (m) => void (m.type() === "error" && errors.push(`worker: ${m.text()}`)))
  const watch = (page: Page, name: string) => {
    page.on("pageerror", (e) => errors.push(`${name}: ${e}`))
    page.on("console", (m) => void (m.type() === "error" && errors.push(`${name}: ${m.text()}`)))
  }
  const titles = () => worker.evaluate(async () => (await chrome.tabs.query({})).map((t) => t.title ?? ""))
  const local = () => worker.evaluate(async () => chrome.storage.local.get(null)) as Promise<Record<string, any>>
  const open = async (name: string) => {
    const page = await browser.newPage()
    await page.goto(url(name))
    return page
  }

  // ------------------------------------------------------------------ install
  const welcome = await until(async () => (await browser.pages()).find((p) => p.url().endsWith("/welcome.html")), 10_000)
  check("installing opens the welcome page", welcome !== undefined)
  if (!welcome) throw new Error("no welcome page")
  watch(welcome, "welcome")
  await welcome.setViewport({ width: 900, height: 1000 })
  await welcome.reload()
  await welcome.waitForSelector("#thresholds button")
  const welcomeFont = await welcome.evaluate(() => getComputedStyle(document.body).fontSize)
  // Chrome injects body { font-size: 75% } into extension pages.
  check("welcome text is 15px, not shrunk by Chrome", welcomeFont === "15px", welcomeFont)
  const stepHeights = await welcome.$$eval(".steps li", (items) => items.map((li) => Math.round(li.getBoundingClientRect().height)))
  check("each welcome step is a few lines, not squeezed into a narrow column", stepHeights.length === 3 && stepHeights.every((h) => h < 100), stepHeights.join(", "))
  const picked = await welcome.$$eval("#thresholds [aria-checked=true]", (b) => b.map((x) => x.textContent))
  check("the threshold picker starts at 12 hours", picked.join() === "12 hours", picked.join())
  await welcome.screenshot({ path: join(out, "welcome.png"), fullPage: true })

  // ------------------------------------------------------------------ Clear window and bring them back
  for (const name of ["a", "b", "c", "d"]) await open(name)
  await welcome.bringToFront()
  await welcome.click("#clear")
  const result = await until(() => welcome.$eval("#result", (e) => e.textContent), 5_000)
  check("the welcome page's Clear window archives the other tabs", result === "Archived 4 tabs.", result ?? "")
  check("only the welcome page stays open", !(await titles()).some((t) => t.startsWith("Page ")))
  await welcome.$$eval("#try button", (buttons) => (buttons.find((b) => b.textContent === "Bring them back") as HTMLButtonElement).click())
  const back = await until(async () => {
    const open = await titles()
    return ["Page a", "Page b", "Page c", "Page d"].every((t) => open.includes(t)) && open
  }, 10_000)
  check("Bring them back reopens all four", back !== undefined)
  let store = await local()
  check("reopened tabs leave the archive", store.archive.length === 0, `${store.archive.length} left`)
  check("reopens after a Clear window count as returns", store.history.filter((a: any) => a.via === "clear" && a.back).length === 4)

  // ------------------------------------------------------------------ a sweep that spares a kept tab
  const keptId = await worker.evaluate(async () => {
    const [b] = await chrome.tabs.query({ title: "Page b" })
    await chrome.storage.local.set({ keptTabs: [{ id: b!.id, url: b!.url }] })
    await chrome.storage.sync.set({ thresholdMs: 15_000 })
    // Unpacked extensions may tick faster than once a minute.
    await chrome.alarms.create("tick", { periodInMinutes: 0.1 })
    return b!.id
  })
  await welcome.bringToFront()
  store = (await until(async () => {
    const s = await local()
    return s.archive.length >= 3 && s
  }, 120_000)) ?? (await local())
  await worker.evaluate(() => chrome.storage.sync.set({ thresholdMs: 12 * 3_600_000 }))
  const afterSweep = await titles()
  check("the sweep archives tabs past the threshold", store.archive.length >= 3, `${store.archive.length} archived`)
  check("the kept tab survives the sweep", afterSweep.includes("Page b"), `open: ${afterSweep.join(", ")}; kept: ${JSON.stringify(store.keptTabs)}; kept id was ${keptId}`)
  check("the sweep counts as automatic", store.history.some((a: any) => a.via === "auto"))

  // ------------------------------------------------------------------ the panel
  const panel = await browser.newPage()
  watch(panel, "panel")
  await panel.setViewport({ width: 380, height: 720 })
  await panel.goto(`chrome-extension://${extension}/panel.html`)
  await panel.waitForSelector(".entry")
  const panelFont = await panel.evaluate(() => getComputedStyle(document.body).fontSize)
  check("panel text is 13px, not shrunk by Chrome", panelFont === "13px", panelFont)
  check("the undo bar is hidden until there is something to undo", (await panel.$eval("#undo", (e) => getComputedStyle(e).display)) === "none")
  const sweep = await panel.$$eval(".sweep", (headers) => headers.map((h) => h.textContent ?? ""))
  check("tabs archived together are grouped with Reopen all", sweep.some((h) => h.includes("Reopen all")), sweep.join(" | "))
  check("the Kept section counts the kept tab", /\b1 tab\b/.test(await panel.$eval("#kept-summary", (e) => e.textContent ?? "")))
  await panel.screenshot({ path: join(out, "panel.png") })

  // The panel redraws shortly after each keystroke, so wait for the state rather than read it once.
  const selectedTitle = () => panel.$eval(".entry[aria-selected=true] .title", (e) => e.textContent).catch(() => null)
  await panel.type("#search", "pg c")
  const selected = await until(async () => (await selectedTitle()) === "Page c", 3_000)
  check("fuzzy search selects the match", selected === true, (await selectedTitle()) ?? "")
  await panel.keyboard.press("Enter")
  check("Enter reopens it", (await until(async () => (await titles()).includes("Page c"), 5_000)) === true)

  await panel.bringToFront()
  await panel.click("#search", { count: 3 })
  await panel.keyboard.press("Backspace")
  const archived = (await local()).archive.length
  await until(async () => (await panel.$$(".entry")).length === archived, 3_000)
  const first = await selectedTitle()
  await panel.keyboard.down("Shift")
  await panel.keyboard.press("Delete")
  await panel.keyboard.up("Shift")
  const forgotten = await until(async () => !(await local()).archive.some((e: any) => e.title === first), 3_000)
  check("Shift+Delete forgets the selected entry", forgotten === true, first ?? "")

  // ------------------------------------------------------------------ coming back to a URL by hand
  const remaining = (await local()).archive[0]
  if (remaining) {
    await open(new URL(remaining.url).pathname.slice(1))
    const counted = await until(async () => {
      const s = await local()
      return !s.archive.some((e: any) => e.url === remaining.url) && s.history.some((a: any) => a.url === remaining.url && a.back)
    }, 5_000)
    check("opening an archived URL by hand takes it out and counts a return", counted === true)
  }

  // ------------------------------------------------------------------ Clear window from the panel, then undo
  for (const name of ["x", "y"]) await open(name)
  await panel.bringToFront()
  await panel.click("#clear")
  const undo = await until(() => panel.$eval("#undo", (e) => getComputedStyle(e).display !== "none" && e.textContent), 5_000)
  check("the panel's Clear window offers an undo", typeof undo === "string" && undo.includes("Undo"), undo || "")
  await panel.$$eval("#undo button", (buttons) => (buttons[0] as HTMLButtonElement).click())
  const restored = await until(async () => {
    const open = await titles()
    return open.includes("Page x") && open.includes("Page y")
  }, 10_000)
  check("Undo brings the tabs back", restored === true)
} finally {
  check("no errors in the worker or the pages", errors.length === 0, errors.join(" | "))
  await browser.close()
  await site.stop()
}

console.log(failures === 0 ? "all checks passed" : `${failures} checks failed`)
process.exit(failures === 0 ? 0 : 1)
