import { expect, test } from "bun:test";
import { EMPTY_LEDGER, ledgerAtInstall, observe, prune } from "../src/ledger.ts";
import { DAY, HOUR, MINUTE, RULES, age } from "../src/rules.ts";

const t0 = Date.parse("2026-10-12T09:00:00Z");

test("present ticks a minute apart record no gap", () => {
  const ledger = [0, 1, 2].reduce((l, i) => observe(l, t0 + i * MINUTE, true), EMPTY_LEDGER);
  expect(ledger).toEqual({ presentAt: t0 + 2 * MINUTE, gaps: [] });
});

test("absent ticks leave presentAt behind, so returning records the whole absence", () => {
  let ledger = observe(EMPTY_LEDGER, t0, true);
  ledger = observe(ledger, t0 + 30 * MINUTE, false);
  ledger = observe(ledger, t0 + HOUR, false);
  expect(ledger.presentAt).toBe(t0);

  ledger = observe(ledger, t0 + 2 * HOUR, true);
  expect(ledger).toEqual({ presentAt: t0 + 2 * HOUR, gaps: [{ start: t0, end: t0 + 2 * HOUR }] });
});

test("a hole from sleep or a quit browser becomes a gap", () => {
  const ledger = observe(observe(EMPTY_LEDGER, t0, true), t0 + 9 * HOUR, true);
  expect(ledger.gaps).toEqual([{ start: t0, end: t0 + 9 * HOUR }]);
});

test("prune keeps every gap since the oldest open tab was last seen, however old", () => {
  const night = (daysAgo: number) => ({ start: t0 - daysAgo * DAY, end: t0 - daysAgo * DAY + 16 * HOUR });
  const ledger = { presentAt: t0, gaps: [night(90), night(60), night(1)] };
  expect(prune(ledger, t0 - 70 * DAY).gaps).toEqual([night(60), night(1)]);
  expect(prune(ledger, t0 - 100 * DAY)).toBe(ledger);
});

test("time before install doesn't count, so installing never archives a backlog at once", () => {
  const { gaps } = ledgerAtInstall(t0);
  expect(age(t0 - 3 * DAY, RULES, t0 + HOUR, gaps)).toMatchObject({ kind: "keep", idleMs: HOUR });
});
