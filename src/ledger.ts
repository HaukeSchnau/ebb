import { DAY, MINUTE, type Gap } from "./rules.ts";

// presentAt only advances on ticks where you're at the computer, so sleep,
// quitting Helium and walking away all show up as a hole between two ticks.
export type Ledger = { presentAt: number | null; gaps: Gap[] };

export const EMPTY_LEDGER: Ledger = { presentAt: null, gaps: [] };

const TICK_SLACK = 3 * MINUTE;
const RETENTION = 30 * DAY;

export function observe(ledger: Ledger, now: number, present: boolean): Ledger {
  if (!present) return ledger;
  const { presentAt } = ledger;
  const missedTicks = presentAt !== null && now - presentAt > TICK_SLACK;
  const gaps = missedTicks ? [...ledger.gaps, { start: presentAt, end: now }] : ledger.gaps;
  return { presentAt: now, gaps: gaps.filter((gap) => gap.end > now - RETENTION) };
}
