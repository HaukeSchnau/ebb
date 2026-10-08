import { expect, test } from "bun:test";
import { search, upsert, type Entry } from "../src/archive.ts";

const entry = (url: string, title: string, archivedAt: number): Entry => ({ url, title, archivedAt, idleMs: 0 });

test("upsert keeps one entry per URL, newest first", () => {
  const archive = [entry("https://a.dev/", "A", 2), entry("https://b.dev/", "B", 1)];
  const result = upsert(archive, [entry("https://b.dev/", "B again", 3), entry("https://b.dev/", "B twin", 3)]);
  expect(result.map((e) => e.title)).toEqual(["B again", "A"]);
});

test("search matches every term against title or URL", () => {
  const archive = [
    entry("https://github.com/effect-ts/effect/pull/482", "Schema transformations", 2),
    entry("https://nixos.org/manual", "buildNpmPackage", 1),
  ];
  expect(search(archive, "github schema").map((e) => e.title)).toEqual(["Schema transformations"]);
  expect(search(archive, "github nix")).toEqual([]);
  expect(search(archive, "  ")).toHaveLength(2);
});
