import type { Via } from "./archive.ts";
import { DAY, THRESHOLDS, siteOf } from "./rules.ts";

/** One archived tab, and when its URL was open again, if it was. */
export type Archived = { url: string; at: number; via: Via; thresholdMs: number; back?: number };

export type Dismissed = { thresholdUntil: number; sites: readonly string[] };

export type Suggestion =
  | { kind: "threshold"; from: number; to: number; returned: number; total: number }
  | { kind: "site"; site: string; returns: number };

/** How long Ebb remembers archived tabs, and how long after archiving an open counts as a return. */
export const REMEMBER = 30 * DAY;
const RETURN_WINDOW = 7 * DAY;

const MIN_ARCHIVED = 20;
const MIN_RETURNED = 4;
const RETURN_RATE = 0.15;
const SITE_RETURNS = 3;

export function remember(history: readonly Archived[], added: readonly Archived[], now: number): Archived[] {
  return [...history, ...added].filter((a) => a.at > now - REMEMBER);
}

/** Marks the newest unreturned archive of `url` from the last week as returned. */
export function returned(history: readonly Archived[], url: string, now: number): Archived[] | undefined {
  const index = history.findLastIndex((a) => a.url === url && a.back === undefined && a.at > now - RETURN_WINDOW);
  if (index < 0) return undefined;
  return history.with(index, { ...history[index]!, back: now });
}

/**
 * Only tabs Ebb archived on its own count: a Clear window and its undo say nothing about the
 * threshold. A threshold suggestion looks at tabs archived under the current threshold that had a
 * full day to come back.
 */
export function suggest(
  history: readonly Archived[],
  now: number,
  current: { thresholdMs: number; keptSites: readonly string[] },
  dismissed: Dismissed,
): Suggestion[] {
  const auto = history.filter((a) => a.via === "auto");
  const suggestions: Suggestion[] = [];

  const next = THRESHOLDS.find((t) => t > current.thresholdMs);
  if (next !== undefined && now >= dismissed.thresholdUntil) {
    const settled = auto.filter((a) => a.thresholdMs === current.thresholdMs && a.at <= now - DAY);
    const quick = settled.filter((a) => a.back !== undefined && a.back - a.at <= DAY);
    if (settled.length >= MIN_ARCHIVED && quick.length >= MIN_RETURNED && quick.length / settled.length >= RETURN_RATE) {
      suggestions.push({ kind: "threshold", from: current.thresholdMs, to: next, returned: quick.length, total: settled.length });
    }
  }

  const week = auto.filter((a) => a.back !== undefined && a.back > now - 7 * DAY);
  const bySite = [...Map.groupBy(week, (a) => siteOf(a.url))]
    .filter(([site, all]) => site !== "" && all.length >= SITE_RETURNS)
    .filter(([site]) => !current.keptSites.includes(site) && !dismissed.sites.includes(site))
    .sort((a, b) => b[1].length - a[1].length);
  const top = bySite[0];
  if (top) suggestions.push({ kind: "site", site: top[0], returns: top[1].length });

  return suggestions;
}
