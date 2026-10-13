export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export const THRESHOLDS = [3 * HOUR, 12 * HOUR, DAY, 7 * DAY, 30 * DAY] as const;

export type Rules = {
  thresholdMs: number;
  clock: "present" | "wall";
  protectGroups: boolean;
  protectAudible: boolean;
  keptSites: readonly string[];
};

export const RULES: Rules = {
  thresholdMs: 12 * HOUR,
  clock: "present",
  protectGroups: true,
  protectAudible: true,
  keptSites: [],
};

export type Gap = { start: number; end: number };

export type TabFacts = Pick<chrome.tabs.Tab, "active" | "pinned" | "groupId" | "audible" | "url" | "lastAccessed"> & {
  splitViewId?: number | undefined;
};

export type Protection = "active" | "split" | "pinned" | "kept" | "site" | "group" | "audible";

export type Verdict =
  | { kind: "protected"; reason: Protection }
  | { kind: "keep"; idleMs: number; archivesInMs: number }
  | { kind: "archive"; idleMs: number };

export type Assessment<T extends TabFacts> = { tab: T; id: number; seen: number; firstSighting: boolean; verdict: Verdict };

/** What Ebb knows beyond the tabs themselves. */
export type Memory = {
  now: number;
  gaps: readonly Gap[];
  /** When Ebb saw you leave each tab, by tab id. */
  ebbSaw: Readonly<Record<string, number>>;
  kept: ReadonlySet<number>;
};

const UNGROUPED = -1;
const NO_SPLIT = -1;
const PLAUSIBLE_SINCE = Date.UTC(2020, 0, 1);

export function seenAt(tab: Pick<TabFacts, "lastAccessed">, ebbSaw: number | undefined): number | undefined {
  const accessed = tab.lastAccessed > PLAUSIBLE_SINCE ? tab.lastAccessed : 0;
  return Math.max(accessed, ebbSaw ?? 0) || undefined;
}

export function age(seen: number, rules: Rules, now: number, gaps: readonly Gap[]): Verdict {
  const away = rules.clock === "present" ? overlap(gaps, seen, now) : 0;
  const idleMs = Math.max(0, now - seen - away);
  return idleMs >= rules.thresholdMs
    ? { kind: "archive", idleMs }
    : { kind: "keep", idleMs, archivesInMs: rules.thresholdMs - idleMs };
}

export function assess<T extends TabFacts & { id?: number | undefined }>(
  tabs: readonly T[],
  memory: Memory,
  rules: Rules = RULES,
): Assessment<T>[] {
  // The other pane of a split view is on screen too, but only one pane counts as active.
  const visibleSplits = new Set(tabs.flatMap((tab) => (tab.active && isSplit(tab) ? [tab.splitViewId] : [])));
  return tabs.flatMap((tab) => {
    if (tab.id === undefined) return [];
    const seen = seenAt(tab, memory.ebbSaw[tab.id]);
    const since = seen ?? memory.now;
    const reason = protection(tab, rules, {
      kept: memory.kept.has(tab.id),
      split: isSplit(tab) && visibleSplits.has(tab.splitViewId),
    });
    const verdict: Verdict = reason ? { kind: "protected", reason } : age(since, rules, memory.now, memory.gaps);
    return [{ tab, id: tab.id, seen: since, firstSighting: seen === undefined, verdict }];
  });
}

function isSplit(tab: TabFacts): tab is TabFacts & { splitViewId: number } {
  return tab.splitViewId !== undefined && tab.splitViewId !== NO_SPLIT;
}

function protection(tab: TabFacts, rules: Rules, shields: { kept: boolean; split: boolean }): Protection | undefined {
  if (tab.active) return "active";
  if (shields.split) return "split";
  if (tab.pinned) return "pinned";
  if (shields.kept) return "kept";
  if (isKeptSite(tab.url, rules.keptSites)) return "site";
  if (rules.protectGroups && tab.groupId !== UNGROUPED) return "group";
  if (rules.protectAudible && tab.audible) return "audible";
  return undefined;
}

export function overlap(gaps: readonly Gap[], from: number, to: number): number {
  return gaps.reduce((sum, gap) => sum + Math.max(0, Math.min(to, gap.end) - Math.max(from, gap.start)), 0);
}

export function isKeptSite(url: string | undefined, keptSites: readonly string[]): boolean {
  const host = url ? hostOf(url) : "";
  return host !== "" && keptSites.some((site) => host === site || host.endsWith(`.${site}`));
}

export function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : "";
}

/** A host without its `www.`, which is how people name a site. */
export function siteOf(url: string): string {
  return hostOf(url).replace(/^www\./, "");
}
