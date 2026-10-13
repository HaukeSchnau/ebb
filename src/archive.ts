import { siteOf } from "./rules.ts";

/** How a tab got into the archive. Entries from before 0.3 have no `via`, and those were all `auto`. */
export type Via = "auto" | "clear";

export type Entry = { url: string; title: string; archivedAt: number; idleMs: number; via?: Via };

/** Tabs archived by the same tick or the same Clear window share `archivedAt`. */
export type Sweep = { at: number; via: Via; entries: Entry[] };

export function upsert(archive: readonly Entry[], added: readonly Entry[]): Entry[] {
  const byUrl = new Map<string, Entry>();
  for (const entry of [...added, ...archive]) if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
  return [...byUrl.values()];
}

export function without(archive: readonly Entry[], urls: ReadonlySet<string>): Entry[] {
  return archive.filter((entry) => !urls.has(entry.url));
}

export function sweeps(archive: readonly Entry[]): Sweep[] {
  return [...Map.groupBy(archive, (entry) => entry.archivedAt)].map(([at, entries]) => ({
    at,
    via: entries[0]?.via ?? "auto",
    entries,
  }));
}

/**
 * Every term has to match the title, the URL or the site, as a substring or as letters in order
 * ("gh" finds github.com). Substring hits rank first, earlier and word-initial ones higher. Without
 * terms the archive keeps its order, newest first.
 */
export function search(archive: readonly Entry[], query: string, site?: string): Entry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const inSite = site === undefined ? archive : archive.filter((entry) => siteOf(entry.url) === site);
  if (terms.length === 0) return [...inSite];
  return inSite
    .flatMap((entry, order) => {
      const haystack = `${entry.title} ${siteOf(entry.url)} ${entry.url}`.toLowerCase();
      let total = 0;
      for (const term of terms) {
        const s = score(haystack, term);
        if (s === 0) return [];
        total += s;
      }
      return [{ entry, total, order }];
    })
    .sort((a, b) => b.total - a.total || a.order - b.order)
    .map(({ entry }) => entry);
}

function score(haystack: string, term: string): number {
  const at = haystack.indexOf(term);
  if (at >= 0) return 100 + (isWordStart(haystack, at) ? 50 : 0) - Math.min(at, 50);
  return inOrder(haystack, term) ? 10 : 0;
}

function isWordStart(text: string, at: number): boolean {
  return at === 0 || !/[a-z0-9]/.test(text[at - 1] ?? "");
}

function inOrder(haystack: string, term: string): boolean {
  let from = 0;
  for (const char of term) {
    from = haystack.indexOf(char, from) + 1;
    if (from === 0) return false;
  }
  return true;
}

/** Sites with at least two archived tabs, most archived first. */
export function topSites(archive: readonly Entry[], limit: number): string[] {
  return [...Map.groupBy(archive, (entry) => siteOf(entry.url))]
    .filter(([site, entries]) => site !== "" && entries.length >= 2)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, limit)
    .map(([site]) => site);
}

export function isRecordable(url: string | undefined): url is string {
  return url !== undefined && /^(https?|file):/.test(url);
}
