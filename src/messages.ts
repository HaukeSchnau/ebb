export type Message =
  | { type: "reopen"; url: string }
  | { type: "forget"; url: string }
  | { type: "clear-window"; windowId: number }
  | { type: "panel-viewed" };

export function send(message: Message): Promise<unknown> {
  return chrome.runtime.sendMessage(message);
}
