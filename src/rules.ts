export const MINUTE = 60_000;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;

export type Rules = {
  thresholdMs: number;
  clock: "present" | "wall";
  protectGroups: boolean;
  protectAudible: boolean;
  allowlist: readonly string[];
};

export const RULES: Rules = {
  thresholdMs: 12 * HOUR,
  clock: "present",
  protectGroups: true,
  protectAudible: true,
  allowlist: [],
};

export type Gap = { start: number; end: number };

export type TabFacts = Pick<chrome.tabs.Tab, "active" | "pinned" | "groupId" | "audible" | "url" | "lastAccessed">;

export type Protection = "active" | "pinned" | "group" | "audible" | "allowlist";

export type Verdict =
  | { kind: "protected"; reason: Protection }
  | { kind: "keep"; idleMs: number; archivesInMs: number }
  | { kind: "archive"; idleMs: number };

export type Assessment<T extends TabFacts> = { tab: T; id: number; seen: number; firstSighting: boolean; verdict: Verdict };

const UNGROUPED = -1;
const PLAUSIBLE_SINCE = Date.UTC(2020, 0, 1);

export function seenAt(tab: Pick<TabFacts, "lastAccessed">, ebbSaw: number | undefined): number | undefined {
  const accessed = tab.lastAccessed > PLAUSIBLE_SINCE ? tab.lastAccessed : 0;
  return Math.max(accessed, ebbSaw ?? 0) || undefined;
}

export function judge(tab: TabFacts, rules: Rules, now: number, gaps: readonly Gap[], seen: number): Verdict {
  const reason = protection(tab, rules);
  if (reason) return { kind: "protected", reason };

  const away = rules.clock === "present" ? overlap(gaps, seen, now) : 0;
  const idleMs = Math.max(0, now - seen - away);
  return idleMs >= rules.thresholdMs
    ? { kind: "archive", idleMs }
    : { kind: "keep", idleMs, archivesInMs: rules.thresholdMs - idleMs };
}

export function assess<T extends TabFacts & { id?: number | undefined }>(
  tabs: readonly T[],
  ebbSaw: Readonly<Record<string, number>>,
  now: number,
  gaps: readonly Gap[],
  rules: Rules = RULES,
): Assessment<T>[] {
  return tabs.flatMap((tab) => {
    if (tab.id === undefined) return [];
    const seen = seenAt(tab, ebbSaw[tab.id]);
    const since = seen ?? now;
    const verdict = judge(tab, rules, now, gaps, since);
    return [{ tab, id: tab.id, seen: since, firstSighting: seen === undefined, verdict }];
  });
}

function protection(tab: TabFacts, rules: Rules): Protection | undefined {
  if (tab.active) return "active";
  if (tab.pinned) return "pinned";
  if (rules.protectGroups && tab.groupId !== UNGROUPED) return "group";
  if (rules.protectAudible && tab.audible) return "audible";
  if (isAllowlisted(tab.url, rules.allowlist)) return "allowlist";
  return undefined;
}

export function overlap(gaps: readonly Gap[], from: number, to: number): number {
  return gaps.reduce((sum, gap) => sum + Math.max(0, Math.min(to, gap.end) - Math.max(from, gap.start)), 0);
}

export function isAllowlisted(url: string | undefined, allowlist: readonly string[]): boolean {
  const host = url ? hostOf(url) : "";
  return host !== "" && allowlist.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function hostOf(url: string): string {
  return URL.canParse(url) ? new URL(url).hostname : "";
}
