import { search, sweeps, topSites, type Entry, type Sweep } from "./archive.ts";
import { keptIds } from "./kept.ts";
import { suggest, type Suggestion } from "./learn.ts";
import { localize, t } from "./locale.ts";
import { send } from "./messages.ts";
import { DAY, THRESHOLDS, assess, siteOf } from "./rules.ts";
import { currentRules, local, session, settings } from "./storage.ts";
import { element, favicon, h } from "./ui.ts";

localize();

const searchInput = element("search", HTMLInputElement);
const count = element("count", HTMLSpanElement);
const sitesRow = element("sites", HTMLDivElement);
const undoBar = element("undo", HTMLDivElement);
const suggestionsBox = element("suggestions", HTMLDivElement);
const list = element("list", HTMLElement);
const empty = element("empty", HTMLParagraphElement);
const clearButton = element("clear", HTMLButtonElement);
const nextSummary = element("next-summary", HTMLElement);
const nextList = element("next-list", HTMLOListElement);
const keptSummary = element("kept-summary", HTMLElement);
const keptBody = element("kept-body", HTMLDivElement);
const clockBody = element("clock-body", HTMLDivElement);
const thresholdSelect = element("threshold", HTMLSelectElement);
const protectGroups = element("protect-groups", HTMLInputElement);

// Rendering every row of a long archive on each change is what makes a panel sluggish.
const ROW_LIMIT = 300;

let site: string | undefined;
let rows: Entry[] = [];
let selected: string | undefined;

// ---------------------------------------------------------------- archive

function dayLabel(time: number, now: number): string {
  const midnight = (t: number) => new Date(t).setHours(0, 0, 0, 0);
  const days = Math.round((midnight(now) - midnight(time)) / DAY);
  if (days === 0) return t.today;
  if (days === 1) return t.yesterday;
  return new Date(time).toLocaleDateString(undefined, days < 7 ? { weekday: "long" } : { day: "numeric", month: "short" });
}

function entryRow(entry: Entry, now: number) {
  const forget = h("button", {
    className: "forget",
    title: t.forgetTitle,
    textContent: "×",
    tabIndex: -1,
    onclick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      void send({ type: "forget", url: entry.url });
    },
  });
  const row = h(
    "a",
    {
      className: "entry",
      href: entry.url,
      title: entry.url,
      tabIndex: -1,
      onclick: (event) => {
        event.preventDefault();
        void send({ type: "reopen", url: entry.url });
      },
    },
    favicon(entry.url),
    h("span", { className: "title", textContent: entry.title }),
    h("span", { className: "meta", textContent: `${siteOf(entry.url)} · ${t.ago(entry.archivedAt, now)}` }),
    forget,
  );
  row.setAttribute("role", "option");
  row.dataset.url = entry.url;
  return row;
}

function sweepHeader(sweep: Sweep) {
  const time = new Date(sweep.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  return h(
    "div",
    { className: "sweep" },
    h("span", { textContent: t.sweep(time, sweep.via, sweep.entries.length) }),
    h("button", {
      className: "link",
      textContent: t.reopenAll,
      onclick: () => void send({ type: "reopen-sweep", at: sweep.at }),
    }),
  );
}

/** Newest first, by day, with a header and "Reopen all" for every sweep of more than one tab. */
function grouped(archive: readonly Entry[], now: number): Node[] {
  const nodes: Node[] = [];
  for (const [label, daySweeps] of Map.groupBy(sweeps(archive), (s) => dayLabel(s.at, now))) {
    nodes.push(h("h2", { textContent: label }));
    for (const sweep of daySweeps) {
      if (sweep.entries.length > 1) nodes.push(sweepHeader(sweep));
      nodes.push(...sweep.entries.map((e) => entryRow(e, now)));
    }
  }
  return nodes;
}

async function renderArchive(now: number) {
  const [{ archive, history, dismissed }, current] = await Promise.all([
    local.get("archive", "history", "dismissed"),
    settings.get("thresholdMs", "keptSites"),
  ]);
  const query = searchInput.value.trim();
  const shown = search(archive, query, site);
  rows = shown.slice(0, ROW_LIMIT);
  count.textContent = archive.length ? String(archive.length) : "";

  const chips = topSites(archive, 5);
  if (site !== undefined && !chips.includes(site)) chips.unshift(site);
  sitesRow.replaceChildren(
    ...chips.map((s) => {
      const chip = h("button", { textContent: s, onclick: () => toggleSite(s) });
      chip.setAttribute("aria-pressed", String(s === site));
      return chip;
    }),
  );

  const rest = shown.length - rows.length;
  list.replaceChildren(
    ...(query || site ? rows.map((e) => entryRow(e, now)) : grouped(rows, now)),
    ...(rest > 0 ? [h("p", { className: "more", textContent: t.olderTabs(rest) })] : []),
  );
  if (selected === undefined || !rows.some((e) => e.url === selected)) selected = rows[0]?.url;
  paintSelection();

  empty.hidden = shown.length > 0;
  empty.textContent = archive.length ? t.nothingMatches : t.emptyArchive(t.threshold(current.thresholdMs));

  suggestionsBox.replaceChildren(...suggest(history, now, current, dismissed).map(suggestionCard));
}

function suggestionCard(suggestion: Suggestion) {
  const accept = h("button", { className: "primary", onclick: () => void send({ type: "accept", suggestion }) });
  const dismiss = h("button", { onclick: () => void send({ type: "dismiss", suggestion }) });
  let text: string;
  if (suggestion.kind === "threshold") {
    const [from, to] = [t.threshold(suggestion.from), t.threshold(suggestion.to)];
    text = t.thresholdHint(suggestion.returned, suggestion.total, from, to);
    accept.textContent = t.useThreshold(to);
    dismiss.textContent = t.keepThreshold(from);
  } else {
    text = t.siteHint(suggestion.site, suggestion.returns);
    accept.textContent = t.neverArchive(suggestion.site);
    dismiss.textContent = t.dismiss;
  }
  return h("div", { className: "hint" }, h("p", { textContent: text }), h("div", { className: "buttons" }, accept, dismiss));
}

function toggleSite(s: string) {
  site = site === s ? undefined : s;
  selected = undefined;
  renderSoon("archive");
  searchInput.focus();
}

function paintSelection() {
  for (const row of list.querySelectorAll<HTMLElement>(".entry")) {
    const on = row.dataset.url === selected;
    row.setAttribute("aria-selected", String(on));
    if (on) row.scrollIntoView({ block: "nearest" });
  }
}

function move(by: number) {
  const index = rows.findIndex((e) => e.url === selected);
  const next = rows[Math.min(rows.length - 1, Math.max(0, index + by))];
  if (next) selected = next.url;
  paintSelection();
}

searchInput.addEventListener("input", () => {
  selected = undefined;
  renderSoon("archive");
});

searchInput.addEventListener("keydown", (event) => {
  const current = rows.find((e) => e.url === selected);
  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
    event.preventDefault();
    move(event.key === "ArrowDown" ? 1 : -1);
  } else if (event.key === "Enter" && current) {
    event.preventDefault();
    void send({ type: "reopen", url: current.url });
  } else if ((event.key === "Delete" || event.key === "Backspace") && event.shiftKey && current) {
    // Shift+Delete removes a suggestion in Chrome's address bar too.
    event.preventDefault();
    const index = rows.indexOf(current);
    selected = (rows[index + 1] ?? rows[index - 1])?.url;
    void send({ type: "forget", url: current.url });
  } else if (event.key === "Escape") {
    searchInput.value = "";
    site = undefined;
    selected = undefined;
    renderSoon("archive");
  }
});

// ---------------------------------------------------------------- clear and undo

let undoTimer: ReturnType<typeof setTimeout> | undefined;

function showUndo(message: string, action?: { label: string; run: () => void }) {
  clearTimeout(undoTimer);
  undoBar.replaceChildren(
    h("span", { textContent: message }),
    ...(action ? [h("button", { textContent: action.label, onclick: () => { action.run(); undoBar.hidden = true; } })] : []),
  );
  undoBar.hidden = false;
  undoTimer = setTimeout(() => (undoBar.hidden = true), action ? 10_000 : 4_000);
}

clearButton.addEventListener("click", async () => {
  const { id } = await chrome.windows.getCurrent();
  if (id === undefined) return;
  const cleared = await send({ type: "clear-window", windowId: id });
  if (cleared === null || cleared.count === 0) {
    showUndo(t.nothingToClear);
  } else {
    showUndo(t.archived(cleared.count), {
      label: t.undo,
      run: () => void send({ type: "reopen-sweep", at: cleared.at }),
    });
  }
});

// ---------------------------------------------------------------- footer

async function renderTabs(now: number) {
  const [tabs, { ledger, keptTabs }, { ebbSaw }, rules] = await Promise.all([
    chrome.tabs.query({ windowType: "normal" }),
    local.get("ledger", "keptTabs"),
    session.get("ebbSaw"),
    currentRules(),
  ]);
  const assessed = assess(tabs, { now, gaps: ledger.gaps, ebbSaw, kept: keptIds(keptTabs) }, rules);
  const upcoming = assessed
    .flatMap(({ tab, id, verdict }) =>
      verdict.kind === "protected" ? [] : [{ tab, id, left: verdict.kind === "keep" ? verdict.archivesInMs : 0 }],
    )
    .sort((a, b) => a.left - b.left);
  const reasons = Map.groupBy(
    assessed.flatMap(({ verdict }) => (verdict.kind === "protected" ? [verdict.reason] : [])),
    (reason) => reason,
  );
  const protectedText = [...reasons].map(([reason, all]) => `${all.length} ${t.protection[reason]}`).join(", ");
  nextSummary.textContent = t.nextSummary(upcoming.length, protectedText);

  nextList.replaceChildren(
    ...upcoming.map(({ tab, id, left }) =>
      h(
        "li",
        {
          title: t.tabTooltip(new Date(tab.lastAccessed).toLocaleString(), ebbSaw[id] ? new Date(ebbSaw[id]).toLocaleString() : undefined),
          onclick: () => {
            void chrome.tabs.update(id, { active: true });
            void chrome.windows.update(tab.windowId, { focused: true });
          },
        },
        favicon(tab.url),
        h("span", { className: "title", textContent: tab.title ?? tab.url ?? "" }),
        h("span", { className: "meta", textContent: left > 0 ? t.archivesIn(t.duration(left)) : t.nextMinute }),
      ),
    ),
  );

  const titles = new Map(tabs.map((t) => [t.id, t.title || t.url || ""]));
  const keptOpen = keptTabs.flatMap((k) => (k.id === undefined ? [] : [{ id: k.id, title: titles.get(k.id) ?? k.url }]));
  const remove = (label: string, onclick: () => void) => h("button", { textContent: "×", title: label, onclick });
  keptSummary.textContent = t.keptSummary(rules.keptSites.length, keptOpen.length);
  keptBody.replaceChildren(
    ...(rules.keptSites.length + keptOpen.length === 0
      ? [h("p", { textContent: t.keptEmpty })]
      : []),
    ...rules.keptSites.map((s) =>
      h("div", { className: "row" }, h("span", { textContent: s }), remove(t.archiveAgain(s), () => void send({ type: "keep-site", site: s, keep: false }))),
    ),
    ...keptOpen.map((k) =>
      h("div", { className: "row" }, h("span", { textContent: k.title }), remove(t.stopKeeping, () => void send({ type: "release-tab", id: k.id }))),
    ),
  );

  const at = (t: number) => new Date(t).toLocaleString(undefined, { weekday: "short", hour: "2-digit", minute: "2-digit" });
  clockBody.replaceChildren(
    h("p", { textContent: t.lastPresent(ledger.presentAt ? t.ago(ledger.presentAt, now) : undefined) }),
    ...ledger.gaps
      .slice(-6)
      .reverse()
      .map((gap) => h("div", { className: "gap", textContent: `${at(gap.start)} → ${at(gap.end)} · ${t.duration(gap.end - gap.start)}` })),
  );

  thresholdSelect.value = String(rules.thresholdMs);
  protectGroups.checked = rules.protectGroups;
}

thresholdSelect.append(...THRESHOLDS.map((ms) => h("option", { value: String(ms), textContent: t.threshold(ms) })));
thresholdSelect.addEventListener("change", () => void settings.set({ thresholdMs: Number(thresholdSelect.value) }));
protectGroups.addEventListener("change", () => void settings.set({ protectGroups: protectGroups.checked }));

// ---------------------------------------------------------------- updates

const timers = new Map<"archive" | "tabs", ReturnType<typeof setTimeout>>();
function renderSoon(part: "archive" | "tabs") {
  clearTimeout(timers.get(part));
  timers.set(part, setTimeout(() => void (part === "archive" ? renderArchive(Date.now()) : renderTabs(Date.now())), 80));
}

const ARCHIVE_KEYS = new Set(["archive", "history", "dismissed", "thresholdMs", "keptSites"]);

function markViewed() {
  if (document.visibilityState === "visible") void send({ type: "panel-viewed" });
}

chrome.storage.onChanged.addListener((changes) => {
  const unseen = changes.unseen?.newValue;
  if (typeof unseen === "number" && unseen > 0) markViewed();
  if (Object.keys(changes).some((key) => ARCHIVE_KEYS.has(key))) renderSoon("archive");
  renderSoon("tabs");
});
for (const event of [chrome.tabs.onActivated, chrome.tabs.onCreated, chrome.tabs.onRemoved, chrome.tabs.onUpdated]) {
  event.addListener(() => renderSoon("tabs"));
}
document.addEventListener("visibilitychange", () => {
  markViewed();
  if (document.visibilityState === "visible") searchInput.focus();
  renderSoon("archive");
  renderSoon("tabs");
});
setInterval(() => {
  renderSoon("archive");
  renderSoon("tabs");
}, 60_000);

markViewed();
searchInput.focus();
renderSoon("archive");
renderSoon("tabs");
