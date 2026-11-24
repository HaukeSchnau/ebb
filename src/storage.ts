import type { Entry } from "./archive.ts";
import type { KeptTab } from "./kept.ts";
import type { Archived, Dismissed } from "./learn.ts";
import { EMPTY_LEDGER, type Ledger } from "./ledger.ts";
import { RULES, type Rules } from "./rules.ts";

export type Local = {
  archive: Entry[];
  ledger: Ledger;
  unseen: number;
  keptTabs: KeptTab[];
  history: Archived[];
  dismissed: Dismissed;
};

export type Settings = Pick<Rules, "thresholdMs" | "protectGroups" | "keptSites">;

// storage.session clears on browser restart, the same moment tab ids reset.
type Session = { ebbSaw: Record<string, number>; activeByWindow: Record<string, number> };

function area<S extends Record<string, unknown>>(storage: chrome.storage.StorageArea, defaults: S) {
  return {
    get: <K extends keyof S & string>(...keys: K[]) => {
      // Each key with its default, so a missing item reads as the default.
      const query: Partial<Pick<S, K>> = {};

      for (const key of keys) query[key] = defaults[key];

      return storage.get<Pick<S, K>>(query);
    },
    set: (patch: Partial<S>) => storage.set(patch),
  };
}

export const local = area<Local>(chrome.storage.local, {
  archive: [],
  ledger: EMPTY_LEDGER,
  unseen: 0,
  keptTabs: [],
  history: [],
  dismissed: { thresholdUntil: 0, sites: [] },
});

export const session = area<Session>(chrome.storage.session, { ebbSaw: {}, activeByWindow: {} });

export const settings = area<Settings>(chrome.storage.sync, {
  thresholdMs: RULES.thresholdMs,
  protectGroups: RULES.protectGroups,
  keptSites: RULES.keptSites,
});

export async function currentRules(): Promise<Rules> {
  return { ...RULES, ...(await settings.get("thresholdMs", "protectGroups", "keptSites")) };
}
