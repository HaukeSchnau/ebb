// The hero's demo: a window of tabs aging under Ebb's default rule, and an archive searched with
// Ebb's own search. Time here is made up; the buttons move it forward.
import { search, type Entry } from "../src/archive.ts"
import { ago, duration } from "../src/format.ts"
import { DAY, HOUR, MINUTE, RULES, siteOf } from "../src/rules.ts"
import { element, h } from "../src/ui.ts"

type Site = { url: string; title: string }
type Tab = Site & ({ kind: "aging"; age: number } | { kind: "kept"; why: "Pinned" | "Playing audio" })

/** Favicons would come from the sites' servers, so the demo draws a letter instead. */
const MARKS: Record<string, readonly [letter: string, color: string]> = {
  "linear.app": ["L", "#5e6ad2"],
  "youtube.com": ["▶", "#e0002b"],
  "hono.dev": ["H", "#d24b00"],
  "orm.drizzle.team": ["D", "#3d4a12"],
  "caddyserver.com": ["C", "#1f7a4c"],
  "vite.dev": ["V", "#7e14ff"],
  "react.dev": ["R", "#087ea4"],
  "news.ycombinator.com": ["Y", "#e85d00"],
  "developer.mozilla.org": ["M", "#1b1b1b"],
  "github.com": ["G", "#24292f"],
  "stackoverflow.com": ["S", "#d76b0c"],
  "google.com": ["F", "#1a73e8"],
  "kingarthurbaking.com": ["K", "#b0122d"],
}

const TABS: readonly Tab[] = [
  { kind: "kept", why: "Pinned", title: "My issues · Linear", url: "https://linear.app/ebb/my-issues" },
  { kind: "kept", why: "Playing audio", title: "lofi hip hop radio · YouTube", url: "https://www.youtube.com/watch?v=jfKfPfyJRdk" },
  { kind: "aging", age: 70 * MINUTE, title: "Getting started · Hono", url: "https://hono.dev/docs/" },
  { kind: "aging", age: 4 * HOUR + 25 * MINUTE, title: "Relations · Drizzle ORM", url: "https://orm.drizzle.team/docs/relations" },
  { kind: "aging", age: 7 * HOUR + 5 * MINUTE, title: "reverse_proxy · Caddy Documentation", url: "https://caddyserver.com/docs/caddyfile/directives/reverse_proxy" },
  { kind: "aging", age: 9 * HOUR + 40 * MINUTE, title: "Features · Vite", url: "https://vite.dev/guide/features" },
  { kind: "aging", age: 11 * HOUR + 35 * MINUTE, title: "useEffect · React", url: "https://react.dev/reference/react/useEffect" },
]

const ARCHIVED: ReadonlyArray<Site & { ago: number }> = [
  { ago: 2 * HOUR, title: "Hacker News", url: "https://news.ycombinator.com/" },
  { ago: 5 * HOUR, title: "Temporal · JavaScript | MDN", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Temporal" },
  { ago: DAY, title: "Pull requests · Effect-TS/effect", url: "https://github.com/Effect-TS/effect/pulls" },
  { ago: DAY + 3 * HOUR, title: "Flights from Hamburg to Lisbon · Google Flights", url: "https://www.google.com/travel/flights" },
  { ago: 2 * DAY, title: "How do I undo the most recent local commits in Git? · Stack Overflow", url: "https://stackoverflow.com/questions/927358" },
  { ago: 3 * DAY, title: "Issues · oven-sh/bun", url: "https://github.com/oven-sh/bun/issues" },
  { ago: 4 * DAY, title: "Sourdough starter, day by day · King Arthur Baking", url: "https://www.kingarthurbaking.com/recipes/sourdough-starter-recipe" },
]

const THRESHOLD = RULES.thresholdMs
const STEP_MS = 1400
const calm = matchMedia("(prefers-reduced-motion: reduce)")

const tabList = element("tabs", HTMLOListElement)
const archiveList = element("archived", HTMLOListElement)
const clock = element("clock", HTMLParagraphElement)
const said = element("said", HTMLParagraphElement)
const count = element("count", HTMLSpanElement)
const none = element("none", HTMLParagraphElement)
const input = element("search", HTMLInputElement)
const work = element("work", HTMLButtonElement)
const sleep = element("sleep", HTMLButtonElement)
const example = element("example", HTMLButtonElement)

let tabs: Tab[] = []
let archive: Entry[] = []
let now = 0
let atComputer = 0
let away = 0
let busy = false
const rows = new Map<string, HTMLLIElement>()
/** Each shown archive entry's site-and-age line, so time can move without rebuilding the list. */
const metas = new Map<HTMLSpanElement, Entry>()
const meta = (entry: Entry) => `${siteOf(entry.url)} · ${ago(entry.archivedAt, now)}`

function mark(url: string) {
  const [letter, color] = MARKS[siteOf(url)] ?? ["•", "#6d6a63"]
  const node = h("span", { className: "mark", textContent: letter, ariaHidden: "true" })
  node.style.setProperty("--mark", color)
  return node
}

function tabRow(tab: Tab) {
  const row = h("li", { className: `tab ${tab.kind}` }, mark(tab.url), h("span", { className: "title", textContent: tab.title }), h("span", { className: "age" }), h("span", { className: "bar", ariaHidden: "true" }))
  rows.set(tab.url, row)
  return row
}

/** A tab's bar is the time it has left: full when you leave it, gone at the threshold, like the logo's bars. */
function paint(tab: Tab, row: HTMLLIElement) {
  const life = tab.kind === "kept" ? 1 : Math.max(0, 1 - tab.age / THRESHOLD)
  row.style.setProperty("--life", life.toFixed(3))
  const age = row.querySelector(".age")
  if (age) age.textContent = tab.kind === "kept" ? tab.why : duration(tab.age)
}

/** Kept tabs first, then the youngest, so the bars shorten down the list. */
const rank = (tab: Tab) => (tab.kind === "kept" ? -1 : tab.age)

function renderTabs() {
  tabList.replaceChildren(...[...tabs].sort((a, b) => rank(a) - rank(b)).map((tab) => {
    const row = rows.get(tab.url) ?? tabRow(tab)
    paint(tab, row)
    return row
  }))
  clock.textContent = atComputer + away === 0
    ? "Tabs age only while you're at the computer."
    : [`${duration(atComputer)} at the computer`, ...(away > 0 ? [`${duration(away)} away`] : [])].join(", ")
  work.textContent = tabs.some((tab) => tab.kind === "aging") ? "Work for an hour" : "Start over"
}

function renderArchive(fresh?: string) {
  const found = search(archive, input.value)
  count.textContent = String(archive.length)
  none.hidden = found.length > 0 || archive.length === 0
  metas.clear()
  archiveList.replaceChildren(...found.map((entry) => {
    const line = h("span", { className: "meta", textContent: meta(entry) })
    metas.set(line, entry)
    const open = h(
      "button",
      { type: "button", className: "entry", title: "Reopen" },
      mark(entry.url),
      h("span", { className: "title", textContent: entry.title }),
      line,
    )
    open.addEventListener("click", () => reopen(entry))
    return h("li", { className: entry.url === fresh ? "fresh" : "" }, open)
  }))
}

function reset() {
  now = Date.now()
  atComputer = 0
  away = 0
  rows.clear()
  tabs = TABS.map((tab) => ({ ...tab }))
  archive = ARCHIVED.map(({ ago, ...site }) => ({ ...site, archivedAt: now - ago, idleMs: 0, via: "auto" }))
  renderTabs()
  renderArchive()
}

/** An hour at the computer, played over STEP_MS: every unprotected tab ages, and those at the threshold ebb. */
function passHour() {
  if (busy) return
  if (!tabs.some((tab) => tab.kind === "aging")) {
    reset()
    said.textContent = "The tabs are back where they started."
    return
  }
  busy = true
  const start = performance.now()
  const span = calm.matches ? 0 : STEP_MS
  let applied = 0
  const gone: string[] = []
  const frame = (time: number) => {
    const target = span === 0 ? HOUR : Math.min(HOUR, Math.max(0, (HOUR * (time - start)) / span))
    const delta = target - applied
    applied = target
    now += delta
    atComputer += delta
    for (const tab of tabs) if (tab.kind === "aging") tab.age += delta
    for (const tab of tabs.filter((tab) => tab.kind === "aging" && tab.age >= THRESHOLD)) {
      ebb(tab)
      gone.push(tab.title)
    }
    renderTabs()
    for (const [line, entry] of metas) line.textContent = meta(entry)
    if (applied < HOUR) return requestAnimationFrame(frame)
    busy = false
    said.textContent = gone.length > 0
      ? `${gone.join(" and ")} went to the archive after 12 hours at the computer.`
      : tabs.some((tab) => tab.kind === "aging")
        ? "An hour at the computer. Every tab you left is an hour older."
        : "Every tab you left is in the archive. The pinned and playing tabs stay."
  }
  requestAnimationFrame(frame)
}

function ebb(tab: Tab) {
  tabs = tabs.filter((other) => other !== tab)
  archive = [{ url: tab.url, title: tab.title, archivedAt: now, idleMs: 0, via: "auto" }, ...archive]
  rows.delete(tab.url)
  renderArchive(tab.url)
}

function rest() {
  if (busy) return
  now += 8 * HOUR
  away += 8 * HOUR
  renderTabs()
  renderArchive()
  said.textContent = "8 hours away. No tab got older."
}

function reopen(entry: Entry) {
  archive = archive.filter((other) => other !== entry)
  tabs = [...tabs, { kind: "aging", age: 0, title: entry.title, url: entry.url }]
  renderTabs()
  renderArchive()
  said.textContent = `${entry.title} is open again and starts aging when you leave it.`
}

work.addEventListener("click", passHour)
sleep.addEventListener("click", rest)
input.addEventListener("input", () => renderArchive())
example.addEventListener("click", () => {
  input.value = example.textContent ?? ""
  renderArchive()
  input.focus()
})

reset()

// The one hour that plays by itself, once the demo is in view, so the first tab ebbs without a click.
if (!calm.matches) {
  const seen = new IntersectionObserver(([entry]) => {
    if (!entry?.isIntersecting) return
    seen.disconnect()
    setTimeout(passHour, 600)
  }, { threshold: 0.6 })
  seen.observe(tabList)
}
