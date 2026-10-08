import { expect, test } from "bun:test";
import { EMPTY_LEDGER, observe } from "../src/ledger.ts";
import { DAY, HOUR, MINUTE } from "../src/rules.ts";

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

test("forgets gaps older than 30 days", () => {
  const old = { presentAt: t0, gaps: [{ start: t0 - 40 * DAY, end: t0 - 31 * DAY }] };
  expect(observe(old, t0 + MINUTE, true).gaps).toEqual([]);
});
