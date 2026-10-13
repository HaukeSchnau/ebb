import { expect, test } from "bun:test";
import { follow, keep, keptIds, rematch } from "../src/kept.ts";
import { DAY, HOUR } from "../src/rules.ts";

const now = Date.parse("2026-10-20T12:00:00Z");

test("after a restart, kept tabs find their URLs again, one tab each", () => {
  const kept = [{ url: "https://a.dev/", id: 4 }, { url: "https://a.dev/", id: 9 }];
  const restored = rematch(kept, [
    { id: 101, url: "https://a.dev/" },
    { id: 102, url: "https://b.dev/" },
    { id: 103, url: "https://a.dev/" },
  ], now);
  expect([...keptIds(restored)].sort()).toEqual([101, 103]);
});

test("a kept tab that isn't back yet claims its URL when the tab shows up later, within a day", () => {
  const waiting = rematch([{ url: "https://late.dev/", id: 4 }], [], now);
  expect(keptIds(waiting).size).toBe(0);
  expect(keptIds(follow(waiting, { id: 200, url: "https://late.dev/" }, now + HOUR))).toEqual(new Set([200]));
  expect(follow(waiting, { id: 200, url: "https://late.dev/" }, now + 2 * DAY)).toEqual([]);
});

test("a kept tab follows its own navigation", () => {
  const kept = keep([], { id: 4, url: "https://a.dev/" });
  expect(follow(kept, { id: 4, url: "https://a.dev/next" }, now)).toEqual([{ url: "https://a.dev/next", id: 4 }]);
});
