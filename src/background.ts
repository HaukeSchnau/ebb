import { isRecordable, search, upsert, without, type Entry, type Via } from "./archive.ts";
import { ago, xml } from "./format.ts";
import { follow, keep, keptIds, rematch, release } from "./kept.ts";
import { remember, returned, type Archived, type Suggestion } from "./learn.ts";
import { ledgerAtInstall, observe, prune } from "./ledger.ts";
import type { Cleared, Reply, Request } from "./messages.ts";
import { DAY, assess, hostOf, siteOf, type Gap, type Rules } from "./rules.ts";
import { currentRules, local, session, settings } from "./storage.ts";

type Disposition = `${chrome.omnibox.OnInputEnteredDisposition}`;
type Doomed = { tab: chrome.tabs.Tab; id: number; idleMs: number };

const PRESENCE_SECONDS = 10 * 60;
const DISMISS_THRESHOLD_FOR = 14 * DAY;

// The alarm, tab events and panel messages all read-modify-write the same
// storage keys. One queue keeps those cycles from interleaving.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") {
    void serial(() => local.set({ ledger: ledgerAtInstall(Date.now()) }));
    void chrome.tabs.create({ url: chrome.runtime.getURL("welcome.html") });
  }
  createMenus();
  void setup();
});

chrome.runtime.onStartup.addListener(() => {
  void serial(async () => {
    const [{ keptTabs }, tabs] = await Promise.all([local.get("keptTabs"), openTabs()]);
    await local.set({ keptTabs: rematch(keptTabs, tabs, Date.now()) });
  });
  void setup();
});

async function setup() {
  await chrome.alarms.create("tick", { periodInMinutes: 1 });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await chrome.action.setBadgeBackgroundColor({ color: "#5a54d6" });
  const active = await chrome.tabs.query({ active: true, windowType: "normal" });
  const activeByWindow = Object.fromEntries(active.flatMap((tab) => (tab.id === undefined ? [] : [[tab.windowId, tab.id]])));
  await serial(() => session.set({ activeByWindow }));
  await renderBadge();
}

async function openTabs() {
  const tabs = await chrome.tabs.query({ windowType: "normal" });
  return tabs.flatMap((tab) => (tab.id === undefined || tab.url === undefined ? [] : [{ id: tab.id, url: tab.url }]));
}

// ---------------------------------------------------------------- sweeping

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tick") void serial(tick);
});

async function tick() {
  const now = Date.now();
  const present = (await chrome.idle.queryState(PRESENCE_SECONDS)) === "active";
  const { ledger } = await local.get("ledger");
  const observed = observe(ledger, now, present);
  const rules = await currentRules();
  if (!present && rules.clock === "present") return;

  const tabs = await chrome.tabs.query({ windowType: "normal" });
  const assessed = await assessAndRemember(tabs, now, observed.gaps, rules);
  const next = assessed.length > 0 ? prune(observed, Math.min(...assessed.map((a) => a.seen))) : observed;
  if (next !== ledger) await local.set({ ledger: next });
  await archiveTabs(
    assessed.flatMap(({ tab, id, verdict }) => (verdict.kind === "archive" ? [{ tab, id, idleMs: verdict.idleMs }] : [])),
    now,
    "auto",
    rules,
  );
}

async function clearWindow(windowId: number): Promise<Cleared | null> {
  const now = Date.now();
  const [tabs, { ledger }, rules] = await Promise.all([
    chrome.tabs.query({ windowId, windowType: "normal" }),
    local.get("ledger"),
    currentRules(),
  ]);
  const assessed = await assessAndRemember(tabs, now, ledger.gaps, rules);
  return archiveTabs(
    assessed.flatMap(({ tab, id, verdict }) => (verdict.kind === "protected" ? [] : [{ tab, id, idleMs: verdict.idleMs }])),
    now,
    "clear",
    rules,
  );
}

async function assessAndRemember(tabs: chrome.tabs.Tab[], now: number, gaps: readonly Gap[], rules: Rules) {
  const [{ ebbSaw }, { keptTabs }] = await Promise.all([session.get("ebbSaw"), local.get("keptTabs")]);
  const assessed = assess(tabs, { now, gaps, ebbSaw, kept: keptIds(keptTabs) }, rules);
  const firstSightings = assessed.filter((a) => a.firstSighting);
  if (firstSightings.length > 0) {
    for (const { id } of firstSightings) ebbSaw[id] = now;
    await session.set({ ebbSaw });
  }
  return assessed;
}

async function archiveTabs(doomed: readonly Doomed[], now: number, via: Via, rules: Rules): Promise<Cleared | null> {
  if (doomed.length === 0) return null;
  const entries = doomed.flatMap(({ tab, idleMs }): Entry[] =>
    isRecordable(tab.url) ? [{ url: tab.url, title: tab.title || tab.url, archivedAt: now, idleMs, via }] : [],
  );
  const archived = entries.map((e): Archived => ({ url: e.url, at: now, via, thresholdMs: rules.thresholdMs }));
  const { archive, unseen, history } = await local.get("archive", "unseen", "history");
  await local.set({
    archive: upsert(archive, entries),
    unseen: unseen + entries.length,
    history: remember(history, archived, now),
  });
  for (const { id } of doomed) await chrome.tabs.remove(id).catch(() => undefined);
  await renderBadge();
  return { at: now, count: entries.length };
}

// ---------------------------------------------------------------- tab events

chrome.tabs.onActivated.addListener(({ tabId, windowId }) => {
  void serial(async () => {
    const { ebbSaw, activeByWindow } = await session.get("ebbSaw", "activeByWindow");
    const previous = activeByWindow[windowId];
    if (previous !== undefined && previous !== tabId) ebbSaw[previous] = Date.now();
    await session.set({ ebbSaw, activeByWindow: { ...activeByWindow, [windowId]: tabId } });
  });
  refreshMenus();
});

chrome.tabs.onRemoved.addListener((tabId) =>
  void serial(async () => {
    const [{ ebbSaw }, { keptTabs }] = await Promise.all([session.get("ebbSaw"), local.get("keptTabs")]);
    delete ebbSaw[tabId];
    await session.set({ ebbSaw });
    if (keptTabs.some((k) => k.id === tabId)) await local.set({ keptTabs: release(keptTabs, tabId) });
  }),
);

chrome.tabs.onReplaced.addListener((added, removed) =>
  void serial(async () => {
    const { keptTabs } = await local.get("keptTabs");
    if (keptTabs.some((k) => k.id === removed)) {
      await local.set({ keptTabs: keptTabs.map((k) => (k.id === removed ? { ...k, id: added } : k)) });
    }
  }),
);

chrome.tabs.onCreated.addListener((tab) => {
  const url = tab.pendingUrl ?? tab.url;
  if (tab.id !== undefined && url) noticeUrl(tab.id, url);
});

chrome.tabs.onUpdated.addListener((tabId, change, tab) => {
  if (change.url) noticeUrl(tabId, change.url);
  if (tab.active && (change.url || change.status)) refreshMenus();
});

/**
 * Every URL a tab opens: a kept tab follows its own navigation, a kept tab waiting after a restart
 * may claim it, and an archived URL open again leaves the archive and counts as a return.
 */
function noticeUrl(tabId: number, url: string) {
  void watched().then((w) => {
    if (!w.urls.has(url) && !w.keptIds.has(tabId) && !w.waiting.has(url)) return;
    void serial(async () => {
      const now = Date.now();
      const { archive, history, keptTabs } = await local.get("archive", "history", "keptTabs");
      const back = returned(history, url, now);
      const remaining = without(archive, new Set([url]));
      const following = follow(keptTabs, { id: tabId, url }, now);
      await local.set({
        ...(back ? { history: back } : {}),
        ...(remaining.length !== archive.length ? { archive: remaining } : {}),
        ...(following !== keptTabs ? { keptTabs: following } : {}),
      });
    });
  });
}

type Watched = { urls: Set<string>; keptIds: Set<number>; waiting: Set<string> };
let watchedCache: Promise<Watched> | undefined;

// Most navigations concern none of this, so they shouldn't read the whole archive.
function watched(): Promise<Watched> {
  watchedCache ??= local.get("archive", "history", "keptTabs").then(({ archive, history, keptTabs }) => ({
    urls: new Set([...archive.map((e) => e.url), ...history.flatMap((a) => (a.back === undefined ? [a.url] : []))]),
    keptIds: keptIds(keptTabs),
    waiting: new Set(keptTabs.flatMap((k) => (k.id === undefined ? [k.url] : []))),
  }));
  return watchedCache;
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && (changes.archive || changes.history || changes.keptTabs)) watchedCache = undefined;
  if (changes.keptTabs || changes.keptSites) refreshMenus();
});

// ---------------------------------------------------------------- reopening

async function reopen(url: string, disposition: Disposition, active = true) {
  if (disposition === "currentTab") {
    await chrome.tabs.update({ url });
  } else {
    const recent = await chrome.sessions.getRecentlyClosed();
    const sessionId = recent.find((closed) => closed.tab?.url === url)?.tab?.sessionId;
    if (sessionId) await chrome.sessions.restore(sessionId);
    else await chrome.tabs.create({ url, active: active && disposition === "newForegroundTab" });
  }
  const now = Date.now();
  const { archive, history } = await local.get("archive", "history");
  const back = returned(history, url, now);
  await local.set({ archive: without(archive, new Set([url])), ...(back ? { history: back } : {}) });
}

async function reopenSweep(at: number) {
  const { archive } = await local.get("archive");
  const entries = archive.filter((e) => e.archivedAt === at);
  for (const entry of entries.toReversed()) await reopen(entry.url, "newBackgroundTab", false);
}

async function renderBadge() {
  const { unseen } = await local.get("unseen");
  await chrome.action.setBadgeText({ text: unseen > 0 ? String(unseen) : "" });
}

// ---------------------------------------------------------------- keeping

const MENU = { tab: "keep-tab", site: "keep-site" } as const;

function createMenus() {
  void chrome.contextMenus.removeAll().then(() => {
    const contexts: [`${chrome.contextMenus.ContextType}`, ...`${chrome.contextMenus.ContextType}`[]] = ["page", "action"];
    chrome.contextMenus.create({ id: MENU.tab, title: "Keep this tab", type: "checkbox", contexts });
    chrome.contextMenus.create({ id: MENU.site, title: "Never archive this site", type: "checkbox", contexts });
    refreshMenus();
  });
}

let menuTimer: ReturnType<typeof setTimeout> | undefined;
function refreshMenus() {
  clearTimeout(menuTimer);
  menuTimer = setTimeout(async () => {
    const [[tab], { keptTabs }, { keptSites }] = await Promise.all([
      chrome.tabs.query({ active: true, lastFocusedWindow: true }),
      local.get("keptTabs"),
      settings.get("keptSites"),
    ]);
    const site = tab?.url ? siteOf(tab.url) : "";
    const tabKept = tab?.id !== undefined && keptIds(keptTabs).has(tab.id);
    await Promise.all([
      chrome.contextMenus.update(MENU.tab, { checked: tabKept, enabled: tab?.id !== undefined }),
      chrome.contextMenus.update(MENU.site, {
        title: site ? `Never archive ${site}` : "Never archive this site",
        checked: site !== "" && keptSites.includes(site),
        enabled: site !== "",
      }),
    ]).catch(() => undefined);
  }, 50);
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  void serial(async () => {
    if (info.menuItemId === MENU.tab && tab?.id !== undefined) {
      const { keptTabs } = await local.get("keptTabs");
      const url = tab.url ?? tab.pendingUrl ?? "";
      await local.set({ keptTabs: info.checked ? keep(keptTabs, { id: tab.id, url }) : release(keptTabs, tab.id) });
    }
    if (info.menuItemId === MENU.site && tab?.url) await keepSite(siteOf(tab.url), info.checked === true);
  });
});

async function keepSite(site: string, kept: boolean) {
  if (!site) return;
  const { keptSites } = await settings.get("keptSites");
  const next = kept ? [...new Set([...keptSites, site])].sort() : keptSites.filter((s) => s !== site);
  await settings.set({ keptSites: next });
}

// ---------------------------------------------------------------- suggestions

async function accept(suggestion: Suggestion) {
  if (suggestion.kind === "threshold") await settings.set({ thresholdMs: suggestion.to });
  else await keepSite(suggestion.site, true);
}

async function dismiss(suggestion: Suggestion) {
  const { dismissed } = await local.get("dismissed");
  await local.set({
    dismissed:
      suggestion.kind === "threshold"
        ? { ...dismissed, thresholdUntil: Date.now() + DISMISS_THRESHOLD_FOR }
        : { ...dismissed, sites: [...dismissed.sites, suggestion.site] },
  });
}

// ---------------------------------------------------------------- messages

type Handlers = { [T in Request["type"]]: (request: Extract<Request, { type: T }>) => Promise<Reply<Extract<Request, { type: T }>>> };

const handlers: Handlers = {
  reopen: ({ url }) => reopen(url, "newForegroundTab"),
  "reopen-sweep": ({ at }) => reopenSweep(at),
  forget: async ({ url }) => {
    const { archive } = await local.get("archive");
    await local.set({ archive: without(archive, new Set([url])) });
  },
  "clear-window": ({ windowId }) => clearWindow(windowId),
  "panel-viewed": async () => {
    await local.set({ unseen: 0 });
    await renderBadge();
  },
  "keep-site": ({ site, keep: kept }) => keepSite(site, kept),
  "release-tab": async ({ id }) => {
    const { keptTabs } = await local.get("keptTabs");
    await local.set({ keptTabs: release(keptTabs, id) });
  },
  accept: ({ suggestion }) => accept(suggestion),
  dismiss: ({ suggestion }) => dismiss(suggestion),
};

chrome.runtime.onMessage.addListener((request: Request, _sender, reply) => {
  // TypeScript can't relate a union member to its handler, so the lookup needs one cast.
  const handler = handlers[request.type] as (r: Request) => Promise<unknown>;
  serial(() => handler(request)).then(
    (value) => reply({ ok: true, value }),
    (error: unknown) => reply({ ok: false, error: String(error) }),
  );
  return true;
});

chrome.commands.onCommand.addListener((command, tab) => {
  const windowId = tab?.windowId;
  if (command === "clear-window" && windowId !== undefined) void serial(() => clearWindow(windowId));
});

// ---------------------------------------------------------------- address bar

void chrome.omnibox.setDefaultSuggestion({ description: "Search tabs Ebb archived" });

chrome.omnibox.onInputChanged.addListener((text, suggest) => {
  void local.get("archive").then(({ archive }) => {
    const now = Date.now();
    suggest(
      search(archive, text)
        .slice(0, 8)
        .map((entry) => ({
          content: entry.url,
          description: `${xml(entry.title)} <dim>${xml(hostOf(entry.url))} · ${ago(entry.archivedAt, now)}</dim>`,
        })),
    );
  });
});

chrome.omnibox.onInputEntered.addListener((text, disposition) =>
  void serial(async () => {
    const { archive } = await local.get("archive");
    const entry = archive.find((candidate) => candidate.url === text) ?? search(archive, text)[0];
    if (entry) await reopen(entry.url, disposition);
  }),
);
