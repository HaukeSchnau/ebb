import { expect, test } from "bun:test";
import { search, sweeps, topSites, upsert, type Entry } from "../src/archive.ts";

const entry = (url: string, title: string, archivedAt: number, via?: Entry["via"]): Entry => ({
  url,
  title,
  archivedAt,
  idleMs: 0,
  ...(via ? { via } : {}),
});

test("upsert keeps one entry per URL, newest first", () => {
  const archive = [entry("https://a.dev/", "A", 2), entry("https://b.dev/", "B", 1)];
  const result = upsert(archive, [entry("https://b.dev/", "B again", 3), entry("https://b.dev/", "B twin", 3)]);
  expect(result.map((e) => e.title)).toEqual(["B again", "A"]);
});

const archive = [
  entry("https://github.com/Effect-TS/effect/pulls", "Pull requests · Effect-TS/effect", 5),
  entry("https://nixos.org/manual", "buildNpmPackage", 4),
  entry("https://github.com/HaukeSchnau/ebb", "HaukeSchnau/ebb", 3),
  entry("https://docs.effect.website/schema", "Schema transformations", 2),
];
const titles = (entries: Entry[]) => entries.map((e) => e.title);

test("search needs every term, as a substring or as letters in order", () => {
  expect(titles(search(archive, "gh eff"))).toEqual(["Pull requests · Effect-TS/effect"]);
  expect(titles(search(archive, "github nix"))).toEqual([]);
  expect(search(archive, "  ")).toHaveLength(4);
});

test("search ranks substring hits above letters in order, and word starts above the middle of a word", () => {
  expect(titles(search(archive, "schema"))[0]).toBe("Schema transformations");
  expect(titles(search(archive, "eff"))).toEqual(["Pull requests · Effect-TS/effect", "Schema transformations"]);
});

test("search narrows to a site", () => {
  expect(titles(search(archive, "", "github.com"))).toEqual(["Pull requests · Effect-TS/effect", "HaukeSchnau/ebb"]);
});

test("sweeps group tabs archived together and remember how", () => {
  const swept = sweeps([entry("https://a.dev/", "A", 9, "clear"), entry("https://b.dev/", "B", 9, "clear"), entry("https://c.dev/", "C", 4)]);
  expect(swept.map((s) => [s.at, s.via, s.entries.length])).toEqual([
    [9, "clear", 2],
    [4, "auto", 1],
  ]);
});

test("topSites lists sites with more than one tab, most first", () => {
  expect(topSites(archive, 5)).toEqual(["github.com"]);
});
