export type Entry = { url: string; title: string; archivedAt: number; idleMs: number };

export function upsert(archive: readonly Entry[], added: readonly Entry[]): Entry[] {
  const byUrl = new Map<string, Entry>();
  for (const entry of [...added, ...archive]) if (!byUrl.has(entry.url)) byUrl.set(entry.url, entry);
  return [...byUrl.values()];
}

export function without(archive: readonly Entry[], url: string): Entry[] {
  return archive.filter((entry) => entry.url !== url);
}

export function search(archive: readonly Entry[], query: string): Entry[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  return archive.filter((entry) => {
    const haystack = `${entry.title} ${entry.url}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

export function isRecordable(url: string | undefined): url is string {
  return url !== undefined && /^(https?|file):/.test(url);
}
