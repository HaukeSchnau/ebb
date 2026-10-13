import type { Suggestion } from "./learn.ts";

export type Request =
  | { type: "reopen"; url: string }
  | { type: "reopen-sweep"; at: number }
  | { type: "forget"; url: string }
  | { type: "clear-window"; windowId: number }
  | { type: "panel-viewed" }
  | { type: "keep-site"; site: string; keep: boolean }
  | { type: "release-tab"; id: number }
  | { type: "accept"; suggestion: Suggestion }
  | { type: "dismiss"; suggestion: Suggestion };

export type Cleared = { at: number; count: number };

type Replies = { "clear-window": Cleared | null };

export type Reply<R extends Request> = R["type"] extends keyof Replies ? Replies[R["type"]] : void;

type Response<R extends Request> = { ok: true; value: Reply<R> } | { ok: false; error: string };

export async function send<R extends Request>(request: R): Promise<Reply<R>> {
  const response = await chrome.runtime.sendMessage<R, Response<R>>(request);
  if (!response.ok) throw new Error(response.error);
  return response.value;
}
