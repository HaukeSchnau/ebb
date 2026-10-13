/** What the Chrome Web Store's fetchStatus reports, as far as a release cares. */
export type Status = {
  publishedItemRevisionStatus?: Revision | undefined
  submittedItemRevisionStatus?: Revision | undefined
  takenDown?: boolean | undefined
}

type Revision = {
  state?: string | undefined
  distributionChannels?: ReadonlyArray<{ crxVersion?: string | undefined }> | undefined
}

export type Decision =
  | { kind: "unchanged"; reason: string }
  | { kind: "blocked"; reason: string }
  /** `cancel` names an older version still waiting in review, which the new one replaces. */
  | { kind: "submit"; cancel: string | undefined }

const WAITING = new Set(["PENDING_REVIEW", "STAGED"])

export function decide(version: string, status: Status): Decision {
  if (status.takenDown) return { kind: "blocked", reason: "the item was taken down; fix that in the dashboard first" }
  const published = versionOf(status.publishedItemRevisionStatus)
  if (published !== undefined && compare(version, published) <= 0) {
    return { kind: "unchanged", reason: `${version} is not newer than the published ${published}` }
  }
  const submitted = status.submittedItemRevisionStatus
  const pending = versionOf(submitted)
  const waiting = pending !== undefined && WAITING.has(submitted?.state ?? "")
  if (waiting && compare(version, pending) <= 0) {
    return { kind: "unchanged", reason: `${pending} is already ${submitted?.state === "STAGED" ? "approved and staged" : "in review"}` }
  }
  return { kind: "submit", cancel: waiting && submitted?.state === "PENDING_REVIEW" ? pending : undefined }
}

function versionOf(revision: Revision | undefined): string | undefined {
  return revision?.distributionChannels?.[0]?.crxVersion
}

export function compare(a: string, b: string): number {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}
