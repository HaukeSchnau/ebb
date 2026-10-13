import { DAY, HOUR, MINUTE } from "./rules.ts";

const THRESHOLD_LABELS = new Map([
  [3 * HOUR, "3 hours"],
  [12 * HOUR, "12 hours"],
  [DAY, "1 day"],
  [7 * DAY, "7 days"],
  [30 * DAY, "30 days"],
]);

export function thresholdLabel(ms: number): string {
  return THRESHOLD_LABELS.get(ms) ?? duration(ms);
}

export function ago(then: number, now: number): string {
  const ms = Math.max(0, now - then);
  if (ms < MINUTE) return "just now";
  if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
  if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
  return `${Math.floor(ms / DAY)}d ago`;
}

export function duration(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / MINUTE));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
  return `${Math.floor(minutes / (24 * 60))}d ${Math.floor((minutes % (24 * 60)) / 60)}h`;
}

export function xml(text: string): string {
  return text.replace(/[&<>"']/g, (char) => `&#${char.charCodeAt(0)};`);
}
