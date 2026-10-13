import { describe, expect, test } from "bun:test";
import { HOUR, MINUTE, RULES, age, assess, seenAt, type Memory, type TabFacts } from "../src/rules.ts";

const at = (iso: string) => Date.parse(iso);
const now = at("2026-10-12T09:30:00Z");
const longAgo = now - 48 * HOUR;

type Tab = TabFacts & { id: number };
let nextId = 1;
const tab = (facts: Partial<TabFacts> = {}): Tab => ({
  id: nextId++,
  active: false,
  pinned: false,
  groupId: -1,
  audible: false,
  url: "https://example.com/",
  lastAccessed: longAgo,
  ...facts,
});
const memory = (patch: Partial<Memory> = {}): Memory => ({ now, gaps: [], ebbSaw: {}, kept: new Set(), ...patch });
const verdictOf = (tabs: Tab[], target: Tab, m = memory(), rules = RULES) =>
  assess(tabs, m, rules).find((a) => a.id === target.id)?.verdict;

describe("assess protects", () => {
  test.each([
    ["active", { active: true }],
    ["pinned", { pinned: true }],
    ["group", { groupId: 7 }],
    ["audible", { audible: true }],
    ["site", { url: "https://app.linear.app/issues" }],
  ] as const)("%s tabs however old they are", (reason, facts) => {
    const t = tab(facts);
    expect(verdictOf([t], t, memory(), { ...RULES, keptSites: ["linear.app"] })).toEqual({ kind: "protected", reason });
  });

  test("kept tabs, by id", () => {
    const kept = tab();
    const other = tab();
    const m = memory({ kept: new Set([kept.id]) });
    expect(verdictOf([kept, other], kept, m)).toEqual({ kind: "protected", reason: "kept" });
    expect(verdictOf([kept, other], other, m)?.kind).toBe("archive");
  });

  test("the other pane of the active tab's split view, and only that one", () => {
    const focused = tab({ active: true, splitViewId: 3 });
    const beside = tab({ splitViewId: 3 });
    const elsewhere = tab({ splitViewId: 4 });
    const tabs = [focused, beside, elsewhere];
    expect(verdictOf(tabs, beside)).toEqual({ kind: "protected", reason: "split" });
    expect(verdictOf(tabs, elsewhere)?.kind).toBe("archive");
  });
});

describe("age", () => {
  test("archives once idle time reaches the threshold", () => {
    expect(age(now - 12 * HOUR, RULES, now, []).kind).toBe("archive");
    expect(age(now - 12 * HOUR + MINUTE, RULES, now, [])).toEqual({
      kind: "keep",
      idleMs: 12 * HOUR - MINUTE,
      archivesInMs: MINUTE,
    });
  });

  test("a weekend away ages a tab only under the wall clock", () => {
    const leftTab = at("2026-10-09T17:30:00Z");
    const weekend = [{ start: at("2026-10-09T18:00:00Z"), end: at("2026-10-12T09:00:00Z") }];
    expect(age(leftTab, RULES, now, weekend)).toEqual({ kind: "keep", idleMs: HOUR, archivesInMs: 11 * HOUR });
    expect(age(leftTab, { ...RULES, clock: "wall" }, now, weekend)).toEqual({ kind: "archive", idleMs: 64 * HOUR });
  });
});

describe("seenAt", () => {
  const entered = at("2026-10-12T08:00:00Z");
  const left = at("2026-10-12T09:00:00Z");

  test("uses whichever is later, entering the tab or Ebb seeing you leave it", () => {
    expect(seenAt({ lastAccessed: entered }, left)).toBe(left);
    expect(seenAt({ lastAccessed: left }, entered)).toBe(left);
  });

  test("ignores an implausible lastAccessed", () => {
    expect(seenAt({ lastAccessed: 0 }, undefined)).toBeUndefined();
    expect(seenAt({ lastAccessed: 0 }, left)).toBe(left);
  });
});

test("assess treats a tab with no usable timestamps as a fresh first sighting", () => {
  const fresh = tab({ lastAccessed: 0 });
  const known = tab({ lastAccessed: now - 13 * HOUR });
  const [a, b] = assess([fresh, known], memory());
  expect(a).toMatchObject({ id: fresh.id, firstSighting: true, verdict: { kind: "keep", idleMs: 0 } });
  expect(b).toMatchObject({ id: known.id, firstSighting: false, verdict: { kind: "archive" } });
});
