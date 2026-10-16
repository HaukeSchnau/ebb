import { expect, test } from "bun:test";
import { DAY, HOUR, MINUTE } from "../src/rules.ts";
import { localeOf, texts } from "../src/text.ts";

const now = Date.parse("2026-10-20T12:00:00Z");

test("a German browser UI gets German, every other one English", () => {
  expect(["de", "de-AT", "DE-ch", "en-US", "fr", "nl-DE"].map(localeOf)).toEqual(["de", "de", "de", "en", "en", "en"]);
});

test("German times read the way the English ones do", () => {
  const { ago, duration, threshold } = texts.de;
  expect([ago(now - 30_000, now), ago(now - 34 * MINUTE, now), ago(now - 3 * HOUR, now), ago(now - DAY, now), ago(now - 3 * DAY, now)])
    .toEqual(["gerade eben", "vor 34 Min.", "vor 3 Std.", "vor 1 Tag", "vor 3 Tagen"]);
  expect([duration(5 * MINUTE), duration(8 * HOUR), duration(2 * HOUR + 10 * MINUTE), duration(DAY + 2 * HOUR)])
    .toEqual(["5 Min.", "8 Std.", "2 Std. 10 Min.", "1 T. 2 Std."]);
  expect([threshold(12 * HOUR), threshold(7 * DAY), threshold(90 * MINUTE)]).toEqual(["12 Stunden", "7 Tage", "1 Std. 30 Min."]);
  expect([texts.en.threshold(DAY), texts.en.duration(2 * HOUR + 5 * MINUTE)]).toEqual(["1 day", "2h 05m"]);
});
