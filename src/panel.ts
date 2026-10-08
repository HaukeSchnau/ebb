import { search, type Entry } from "./archive.ts";
import { ago, duration } from "./format.ts";
import { send } from "./messages.ts";
import { DAY, HOUR, assess, hostOf, type Protection } from "./rules.ts";
import { currentRules, local, session, settings } from "./storage.ts";

function element<T extends HTMLElement>(id: string, type: { new (): T; prototype: T }): T {
  const found = document.getElementById(id);
  if (!(found instanceof type)) throw new Error(`#${id} is missing or not a ${type.name}`);
  return found;
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const node = Object.assign(document.createElement(tag), props);
  node.append(...children);
  return node;
}

const searchInput = element("search", HTMLInputElement);
const count = element("count", HTMLSpanElement);
const list = element("list", HTMLElement);
const empty = element("empty", HTMLParagraphElement);
const clearButton = element("clear", HTMLButtonElement);
const nextSummary = element("next-summary", HTMLElement);
const nextList = element("next-list", HTMLOListElement);
const clockBody = element("clock-body", HTMLDivElement);
const thresholdSelect = element("threshold", HTMLSelectElement);
const protectGroups = element("protect-groups", HTMLInputElement);

const THRESHOLDS = [
  [3 * HOUR, "3 hours"],
  [12 * HOUR, "12 hours"],
  [DAY, "1 day"],
  [7 * DAY, "7 days"],
  [30 * DAY, "30 days"],
] as const;

const thresholdLabel = (ms: number) => THRESHOLDS.find(([value]) => value === ms)?.[1] ?? duration(ms);

const PROTECTION_LABELS: Record<Protection, string> = {
  active: "active",
  pinned: "pinned",
  group: "in groups",
  audible: "playing audio",
  allowlist: "on the allowlist",
};

function favicon(url: string | undefined) {
  const src = new URL(chrome.runtime.getURL("/_favicon/"));
  src.searchParams.set("pageUrl", url ?? "");
  src.searchParams.set("size", "32");
  return h("img", { className: "icon", src: src.href, alt: "", loading: "lazy" });
}

function dayLabel(time: number, now: number): string {
  const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((midnight(now) - midnight(time)) / DAY);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return new Date(time).toLocaleDateString(undefined, days < 7 ? { weekday: "long" } : { day: "numeric", month: "short" });
}

function entryRow(entry: Entry, now: number) {
  const forget = h("button", {
    className: "forget",
    title: "Remove from archive",
    textContent: "×",
    onclick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      void send({ type: "forget", url: entry.url });
    },
  });
  return h(
    "a",
    {
      className: "entry",
      href: entry.url,
      title: entry.url,
      onclick: (event) => {
        event.preventDefault();
        void send({ type: "reopen", url: entry.url });
      },
    },
    favicon(entry.url),
    h("span", { className: "title", textContent: entry.title }),
    h("span", { className: "meta", textContent: `${hostOf(entry.url)} · ${ago(entry.archivedAt, now)}` }),
    forget,
  );
}

async function renderArchive(now: number) {
  const [{ archive }, { thresholdMs }] = await Promise.all([local.get("archive"), settings.get("thresholdMs")]);
  const results = search(archive, searchInput.value);
  count.textContent = archive.length ? String(archive.length) : "";
  const days = Map.groupBy(results, (entry) => dayLabel(entry.archivedAt, now));
  list.replaceChildren(
    ...[...days].flatMap(([label, entries]) => [h("h2", { textContent: label }), ...entries.map((e) => entryRow(e, now))]),
  );
  empty.hidden = results.length > 0;
  empty.textContent = archive.length
    ? "Nothing matches."
    : `Nothing archived yet. Tabs you haven't looked at for ${thresholdLabel(thresholdMs)} of computer time land here.`;
}

async function renderUpcoming(now: number) {
  const [tabs, { ledger }, { ebbSaw }, rules] = await Promise.all([
    chrome.tabs.query({ windowType: "normal" }),
    local.get("ledger"),
    session.get("ebbSaw"),
    currentRules(),
  ]);
  const assessed = assess(tabs, ebbSaw, now, ledger.gaps, rules);
  const upcoming = assessed
    .flatMap(({ tab, id, verdict }) =>
      verdict.kind === "protected" ? [] : [{ tab, id, left: verdict.kind === "keep" ? verdict.archivesInMs : 0 }],
    )
    .sort((a, b) => a.left - b.left);
  const reasons = Map.groupBy(
    assessed.flatMap(({ verdict }) => (verdict.kind === "protected" ? [verdict.reason] : [])),
    (reason) => reason,
  );
  const protectedText = [...reasons].map(([reason, all]) => `${all.length} ${PROTECTION_LABELS[reason]}`).join(", ");
  nextSummary.textContent = `Next to go · ${upcoming.length} aging${protectedText ? ` · protected: ${protectedText}` : ""}`;

  nextList.replaceChildren(
    ...upcoming.map(({ tab, id, left }) =>
      h(
        "li",
        {
          title: `lastAccessed ${new Date(tab.lastAccessed).toLocaleString()}\nEbb saw it ${ebbSaw[id] ? new Date(ebbSaw[id]).toLocaleString() : "never"}`,
          onclick: () => {
            void chrome.tabs.update(id, { active: true });
            void chrome.windows.update(tab.windowId, { focused: true });
          },
        },
        favicon(tab.url),
        h("span", { className: "title", textContent: tab.title ?? tab.url ?? "" }),
        h("span", { className: "meta", textContent: left > 0 ? `in ${duration(left)}` : "next minute" }),
      ),
    ),
  );

  const recentGaps = ledger.gaps.slice(-6).reverse();
  const at = (t: number) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  clockBody.replaceChildren(
    h("p", {
      textContent: `Last present ${ledger.presentAt ? ago(ledger.presentAt, now) : "never"}. Time away doesn't age tabs.`,
    }),
    ...recentGaps.map((gap) =>
      h("div", { className: "gap", textContent: `${at(gap.start)} → ${at(gap.end)} · ${duration(gap.end - gap.start)}` }),
    ),
  );
}

async function renderSettings() {
  const current = await settings.get("thresholdMs", "protectGroups");
  thresholdSelect.value = String(current.thresholdMs);
  protectGroups.checked = current.protectGroups;
}

thresholdSelect.append(...THRESHOLDS.map(([ms, label]) => h("option", { value: String(ms), textContent: label })));
thresholdSelect.addEventListener("change", () => void settings.set({ thresholdMs: Number(thresholdSelect.value) }));
protectGroups.addEventListener("change", () => void settings.set({ protectGroups: protectGroups.checked }));

let pending: ReturnType<typeof setTimeout> | undefined;
function render() {
  clearTimeout(pending);
  pending = setTimeout(() => {
    const now = Date.now();
    void renderArchive(now);
    void renderUpcoming(now);
    void renderSettings();
  }, 100);
}

function markViewed() {
  if (document.visibilityState === "visible") void send({ type: "panel-viewed" });
}

searchInput.addEventListener("input", render);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    searchInput.value = "";
    render();
  }
  if (event.key !== "Enter") return;
  void local.get("archive").then(({ archive }) => {
    const first = search(archive, searchInput.value)[0];
    if (first) void send({ type: "reopen", url: first.url });
  });
});

clearButton.addEventListener("click", async () => {
  const { id } = await chrome.windows.getCurrent();
  if (id !== undefined) await send({ type: "clear-window", windowId: id });
});

chrome.storage.onChanged.addListener((changes) => {
  const unseen = changes.unseen?.newValue;
  if (typeof unseen === "number" && unseen > 0) markViewed();
  render();
});
chrome.tabs.onActivated.addListener(render);
chrome.tabs.onCreated.addListener(render);
chrome.tabs.onRemoved.addListener(render);
chrome.tabs.onUpdated.addListener(render);
document.addEventListener("visibilitychange", () => {
  markViewed();
  render();
});
setInterval(render, 30_000);

markViewed();
render();
