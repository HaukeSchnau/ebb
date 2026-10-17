import { expect, test } from "bun:test"
import { decide, type Status } from "../.calder/decide.ts"

const revision = (crxVersion: string, state?: string) => ({ state, distributionChannels: [{ crxVersion }] })
const live = (version: string): Status => ({ publishedItemRevisionStatus: revision(version, "PUBLISHED") })

test.each([
  ["a first release", "0.1.0", {}, { kind: "submit", cancel: undefined }],
  ["a newer version", "0.4.1", live("0.2.0"), { kind: "submit", cancel: undefined }],
  ["a version already live", "0.2.0", live("0.2.0"), { kind: "unchanged", reason: "0.2.0 is not newer than the published 0.2.0" }],
  ["a version already in review", "0.4.1", { ...live("0.2.0"), submittedItemRevisionStatus: revision("0.4.1", "PENDING_REVIEW") }, { kind: "unchanged", reason: "0.4.1 is already in review" }],
  ["a version approved and staged", "0.4.1", { ...live("0.2.0"), submittedItemRevisionStatus: revision("0.4.1", "STAGED") }, { kind: "unchanged", reason: "0.4.1 is already approved and staged" }],
  ["a newer version than the one in review", "0.4.1", { ...live("0.2.0"), submittedItemRevisionStatus: revision("0.4.0", "PENDING_REVIEW") }, { kind: "submit", cancel: "0.4.0" }],
  ["after a cancelled review", "0.4.1", { ...live("0.2.0"), submittedItemRevisionStatus: revision("0.4.1", "CANCELLED") }, { kind: "submit", cancel: undefined }],
  ["a taken-down item", "0.4.1", { ...live("0.2.0"), takenDown: true }, { kind: "blocked", reason: "the item was taken down; fix that in the dashboard first" }],
] as const)("%s", (_, version, status, expected) => {
  expect(decide(version, status)).toEqual(expected)
})

test("versions compare by number, not by text", () => {
  expect(decide("0.10.0", live("0.9.0")).kind).toBe("submit")
})
