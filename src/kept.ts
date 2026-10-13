import { DAY } from "./rules.ts";

/**
 * A tab you asked Ebb to keep. Tab ids don't survive a browser restart, so each kept tab also
 * remembers its URL. After a restart it waits without an id until a tab with that URL shows up,
 * for at most a day.
 */
export type KeptTab = { url: string; id?: number; lostAt?: number };

type Tab = { id: number; url: string };

const WAIT = DAY;

export function keptIds(kept: readonly KeptTab[]): Set<number> {
  return new Set(kept.flatMap((k) => (k.id === undefined ? [] : [k.id])));
}

export function keep(kept: readonly KeptTab[], tab: Tab): KeptTab[] {
  return [...kept.filter((k) => k.id !== tab.id), { url: tab.url, id: tab.id }];
}

export function release(kept: readonly KeptTab[], id: number): KeptTab[] {
  return kept.filter((k) => k.id !== id);
}

/** After a restart: every kept tab finds an open tab with its URL, or waits for one. */
export function rematch(kept: readonly KeptTab[], tabs: readonly Tab[], now: number): KeptTab[] {
  let result = kept.map((k): KeptTab => ({ url: k.url, lostAt: k.lostAt ?? now }));
  for (const tab of tabs) result = follow(result, tab, now);
  return result;
}

/**
 * A tab's URL changed or it appeared. A kept tab follows its own navigation, and a waiting one
 * claims the first tab with its URL. Waits older than a day end.
 */
export function follow(kept: readonly KeptTab[], tab: Tab, now: number): KeptTab[] {
  const alive = kept.filter((k) => k.lostAt === undefined || k.lostAt > now - WAIT);
  const mine = alive.findIndex((k) => k.id === tab.id);
  if (mine >= 0) return alive.with(mine, { url: tab.url, id: tab.id });
  const waiting = alive.findIndex((k) => k.id === undefined && k.url === tab.url);
  if (waiting >= 0) return alive.with(waiting, { url: tab.url, id: tab.id });
  return alive;
}
