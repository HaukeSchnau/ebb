import { isRecordable, search, upsert, without, type Entry } from "./archive.ts";
import { ago, xml } from "./format.ts";
import { ledgerAtInstall, observe } from "./ledger.ts";
import type { Message } from "./messages.ts";
import { assess, hostOf, type Gap, type Rules } from "./rules.ts";
import { currentRules, local, session } from "./storage.ts";

type Disposition = `${chrome.omnibox.OnInputEnteredDisposition}`;
type Doomed = { tab: chrome.tabs.Tab; id: number; idleMs: number };

const PRESENCE_SECONDS = 10 * 60;

// The alarm, tab events and panel messages all read-modify-write the same
// storage keys. One queue keeps those cycles from interleaving.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => undefined);
  return run;
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason === "install") void serial(() => local.set({ ledger: ledgerAtInstall(Date.now()) }));
  void setup();
});
chrome.runtime.onStartup.addListener(() => void setup());

async function setup() {
  await chrome.alarms.create("tick", { periodInMinutes: 1 });
  await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  await chrome.action.setBadgeBackgroundColor({ color: "#5a54d6" });
  const active = await chrome.tabs.query({ active: true, windowType: "normal" });
  const activeByWindow = Object.fromEntries(active.flatMap((tab) => (tab.id === undefined ? [] : [[tab.windowId, tab.id]])));
  await serial(() => session.set({ activeByWindow }));
  await renderBadge();
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "tick") void serial(tick);
});

async function tick() {
  const now = Date.now();
  const present = (await chrome.idle.queryState(PRESENCE_SECONDS)) === "active";
  const { ledger } = await local.get("ledger");
  const next = observe(ledger, now, present);
  if (next !== ledger) await local.set({ ledger: next });
  const rules = await currentRules();
  if (!present && rules.clock === "present") return;

  const tabs = await chrome.tabs.query({ windowType: "normal" });
  const assessed = await assessAndRemember(tabs, now, next.gaps, rules);
  await archiveTabs(
    assessed.flatMap(({ tab, id, verdict }) => (verdict.kind === "archive" ? [{ tab, id, idleMs: verdict.idleMs }] : [])),
    now,
  );
}

async function clearWindow(windowId: number) {
  const now = Date.now();
  const [tabs, { ledger }, rules] = await Promise.all([
    chrome.tabs.query({ windowId, windowType: "normal" }),
    local.get("ledger"),
    currentRules(),
  ]);
  const assessed = await assessAndRemember(tabs, now, ledger.gaps, rules);
  await archiveTabs(
    assessed.flatMap(({ tab, id, verdict }) => (verdict.kind === "protected" ? [] : [{ tab, id, idleMs: verdict.idleMs }])),
    now,
  );
}

async function assessAndRemember(tabs: chrome.tabs.Tab[], now: number, gaps: readonly Gap[], rules: Rules) {
  const { ebbSaw } = await session.get("ebbSaw");
  const assessed = assess(tabs, ebbSaw, now, gaps, rules);
  const firstSightings = assessed.filter((a) => a.firstSighting);
  if (firstSightings.length > 0) {
    for (const { id } of firstSightings) ebbSaw[id] = now;
    await session.set({ ebbSaw });
  }
  return assessed;
}

async function archiveTabs(doomed: readonly Doomed[], now: number) {
  if (doomed.length === 0) return;
  const entries = doomed.flatMap(({ tab, idleMs }): Entry[] =>
    isRecordable(tab.url) ? [{ url: tab.url, title: tab.title || tab.url, archivedAt: now, idleMs }] : [],
  );
  const { archive, unseen } = await local.get("archive", "unseen");
  await local.set({ archive: upsert(archive, entries), unseen: unseen + entries.length });
  for (const { id } of doomed) await chrome.tabs.remove(id).catch(() => undefined);
  await renderBadge();
}

chrome.tabs.onActivated.addListener(({ tabId, windowId }) =>
  void serial(async () => {
    const { ebbSaw, activeByWindow } = await session.get("ebbSaw", "activeByWindow");
    const previous = activeByWindow[windowId];
    if (previous !== undefined && previous !== tabId) ebbSaw[previous] = Date.now();
    await session.set({ ebbSaw, activeByWindow: { ...activeByWindow, [windowId]: tabId } });
  }),
);

chrome.tabs.onRemoved.addListener((tabId) =>
  void serial(async () => {
    const { ebbSaw } = await session.get("ebbSaw");
    delete ebbSaw[tabId];
    await session.set({ ebbSaw });
  }),
);

async function reopen(url: string, disposition: Disposition) {
  if (disposition === "currentTab") {
    await chrome.tabs.update({ url });
  } else {
    const recent = await chrome.sessions.getRecentlyClosed();
    const sessionId = recent.find((closed) => closed.tab?.url === url)?.tab?.sessionId;
    if (sessionId) await chrome.sessions.restore(sessionId);
    else await chrome.tabs.create({ url, active: disposition === "newForegroundTab" });
  }
  const { archive } = await local.get("archive");
  await local.set({ archive: without(archive, url) });
}

async function renderBadge() {
  const { unseen } = await local.get("unseen");
  await chrome.action.setBadgeText({ text: unseen > 0 ? String(unseen) : "" });
}

chrome.runtime.onMessage.addListener((message: Message, _sender, reply) => {
  serial(() => handle(message)).then(
    () => reply({ ok: true }),
    (error: unknown) => reply({ ok: false, error: String(error) }),
  );
  return true;
});

async function handle(message: Message): Promise<void> {
  switch (message.type) {
    case "reopen":
      return reopen(message.url, "newForegroundTab");
    case "forget": {
      const { archive } = await local.get("archive");
      return local.set({ archive: without(archive, message.url) });
    }
    case "clear-window":
      return clearWindow(message.windowId);
    case "panel-viewed":
      await local.set({ unseen: 0 });
      return renderBadge();
  }
}

chrome.commands.onCommand.addListener((command, tab) => {
  const windowId = tab?.windowId;
  if (command === "clear-window" && windowId !== undefined) void serial(() => clearWindow(windowId));
});

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
