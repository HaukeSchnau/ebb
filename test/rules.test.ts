import { describe, expect, test } from "bun:test";
import { HOUR, MINUTE, RULES, assess, judge, seenAt, type TabFacts } from "../src/rules.ts";

const at = (iso: string) => Date.parse(iso);
const tab = (facts: Partial<TabFacts> = {}): TabFacts => ({
  active: false,
  pinned: false,
  groupId: -1,
  audible: false,
  url: "https://example.com/",
  lastAccessed: 0,
  ...facts,
});

describe("judge", () => {
  const now = at("2026-10-12T09:30:00Z");
  const longAgo = now - 48 * HOUR;

  test.each([
    ["active", { active: true }],
    ["pinned", { pinned: true }],
    ["group", { groupId: 7 }],
    ["audible", { audible: true }],
    ["allowlist", { url: "https://app.linear.app/issues" }],
  ] as const)("protects %s tabs however old they are", (reason, facts) => {
    const rules = { ...RULES, allowlist: ["linear.app"] };
    expect(judge(tab(facts), rules, now, [], longAgo)).toEqual({ kind: "protected", reason });
  });

  test("archives once idle time reaches the threshold", () => {
    expect(judge(tab(), RULES, now, [], now - 12 * HOUR).kind).toBe("archive");
    expect(judge(tab(), RULES, now, [], now - 12 * HOUR + MINUTE)).toEqual({
      kind: "keep",
      idleMs: 12 * HOUR - MINUTE,
      archivesInMs: MINUTE,
    });
  });

  test("a weekend away ages a tab only under the wall clock", () => {
    const leftTab = at("2026-10-09T17:30:00Z");
    const weekend = [{ start: at("2026-10-09T18:00:00Z"), end: at("2026-10-12T09:00:00Z") }];

    expect(judge(tab(), RULES, now, weekend, leftTab)).toEqual({
      kind: "keep",
      idleMs: HOUR,
      archivesInMs: 11 * HOUR,
    });
    expect(judge(tab(), { ...RULES, clock: "wall" }, now, weekend, leftTab)).toEqual({
      kind: "archive",
      idleMs: 64 * HOUR,
    });
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
  const now = at("2026-10-12T09:30:00Z");
  const [fresh, known] = assess(
    [{ ...tab(), id: 1 }, { ...tab({ lastAccessed: now - 13 * HOUR }), id: 2 }],
    {},
    now,
    [],
  );
  expect(fresh).toMatchObject({ id: 1, firstSighting: true, verdict: { kind: "keep", idleMs: 0 } });
  expect(known).toMatchObject({ id: 2, firstSighting: false, verdict: { kind: "archive" } });
});
