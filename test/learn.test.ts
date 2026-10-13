import { describe, expect, test } from "bun:test";
import { remember, returned, suggest, type Archived } from "../src/learn.ts";
import { DAY, HOUR } from "../src/rules.ts";

const now = Date.parse("2026-10-20T12:00:00Z");
const twelve = 12 * HOUR;
const current = { thresholdMs: twelve, keptSites: [] as string[] };
const never = { thresholdUntil: 0, sites: [] as string[] };

const archived = (n: number, patch: Partial<Archived> = {}): Archived[] =>
  Array.from({ length: n }, (_, i) => ({
    url: `https://site${i}.dev/page`,
    at: now - 3 * DAY,
    via: "auto",
    thresholdMs: twelve,
    ...patch,
  }));

describe("threshold suggestion", () => {
  test("appears when many tabs come back within a day", () => {
    const history = [...archived(16), ...archived(4, { back: now - 3 * DAY + 2 * HOUR })];
    expect(suggest(history, now, current, never)).toEqual([
      { kind: "threshold", from: twelve, to: DAY, returned: 4, total: 20 },
    ]);
  });

  test("needs enough data and a high enough rate", () => {
    expect(suggest([...archived(15), ...archived(4, { back: now - 2 * DAY })], now, current, never)).toEqual([]);
    expect(suggest([...archived(40), ...archived(4, { back: now - 3 * DAY + HOUR })], now, current, never)).toEqual([]);
  });

  test("ignores Clear window, other thresholds, late returns and recent archives", () => {
    const quick = { back: now - 3 * DAY + HOUR };
    const noise = [
      ...archived(20, { via: "clear", ...quick }),
      ...archived(20, { thresholdMs: 3 * HOUR, ...quick }),
      ...archived(20, { back: now }),
      ...archived(20, { at: now - HOUR, back: now }),
    ];
    expect(suggest([...archived(16), ...noise], now, current, never).filter((s) => s.kind === "threshold")).toEqual([]);
  });

  test("stays quiet while dismissed and at the longest threshold", () => {
    const history = [...archived(16), ...archived(4, { back: now - 3 * DAY + HOUR })];
    expect(suggest(history, now, current, { thresholdUntil: now + DAY, sites: [] })).toEqual([]);
    expect(suggest(history.map((a) => ({ ...a, thresholdMs: 30 * DAY })), now, { ...current, thresholdMs: 30 * DAY }, never)).toEqual([]);
  });
});

describe("site suggestion", () => {
  const linear = (n: number): Archived[] =>
    Array.from({ length: n }, (_, i) => ({
      url: `https://linear.app/urbs/issue/URB-${i}`,
      at: now - 2 * DAY,
      via: "auto",
      thresholdMs: twelve,
      back: now - DAY,
    }));

  test("names the site you brought back most this week", () => {
    expect(suggest(linear(3), now, current, never)).toEqual([{ kind: "site", site: "linear.app", returns: 3 }]);
  });

  test("skips kept and dismissed sites", () => {
    expect(suggest(linear(5), now, { ...current, keptSites: ["linear.app"] }, never)).toEqual([]);
    expect(suggest(linear(5), now, current, { thresholdUntil: 0, sites: ["linear.app"] })).toEqual([]);
  });
});

test("returned marks the newest unreturned archive of a URL from the last week", () => {
  const url = "https://a.dev/";
  const history: Archived[] = [
    { url, at: now - 10 * DAY, via: "auto", thresholdMs: twelve },
    { url, at: now - DAY, via: "auto", thresholdMs: twelve },
  ];
  expect(returned(history, url, now)?.map((a) => a.back)).toEqual([undefined, now]);
  expect(returned([history[0]!], url, now)).toBeUndefined();
});

test("remember forgets archives older than 30 days", () => {
  const old = archived(1, { at: now - 31 * DAY });
  expect(remember(old, archived(1), now)).toHaveLength(1);
});
