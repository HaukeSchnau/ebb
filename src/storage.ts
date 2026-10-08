import type { Entry } from "./archive.ts";
import { EMPTY_LEDGER, type Ledger } from "./ledger.ts";
import { RULES, type Rules } from "./rules.ts";

type Local = { archive: Entry[]; ledger: Ledger; unseen: number };

export type Settings = Pick<Rules, "thresholdMs" | "protectGroups">;

// storage.session clears on browser restart, the same moment tab ids reset.
type Session = { ebbSaw: Record<string, number>; activeByWindow: Record<string, number> };

function area<S extends Record<string, unknown>>(storage: chrome.storage.StorageArea, defaults: S) {
  return {
    get: <K extends keyof S & string>(...keys: K[]) =>
      storage.get<Pick<S, K>>(Object.fromEntries(keys.map((key) => [key, defaults[key]])) as Pick<S, K>),
    set: (patch: Partial<S>) => storage.set(patch),
  };
}

export const local = area<Local>(chrome.storage.local, { archive: [], ledger: EMPTY_LEDGER, unseen: 0 });
export const session = area<Session>(chrome.storage.session, { ebbSaw: {}, activeByWindow: {} });
export const settings = area<Settings>(chrome.storage.sync, {
  thresholdMs: RULES.thresholdMs,
  protectGroups: RULES.protectGroups,
});

export async function currentRules(): Promise<Rules> {
  return { ...RULES, ...(await settings.get("thresholdMs", "protectGroups")) };
}
