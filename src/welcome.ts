import { localize, t } from "./locale.ts";
import { send } from "./messages.ts";
import { THRESHOLDS } from "./rules.ts";
import { settings } from "./storage.ts";
import { element, h } from "./ui.ts";

localize();

const thresholds = element("thresholds", HTMLDivElement);
const tryButtons = element("try", HTMLDivElement);
const clear = element("clear", HTMLButtonElement);
const result = element("result", HTMLParagraphElement);

async function renderThresholds() {
  const { thresholdMs } = await settings.get("thresholdMs");
  thresholds.replaceChildren(
    ...THRESHOLDS.map((ms) => {
      const choice = h("button", { textContent: t.threshold(ms), onclick: () => void settings.set({ thresholdMs: ms }) });
      choice.setAttribute("role", "radio");
      choice.setAttribute("aria-checked", String(ms === thresholdMs));
      return choice;
    }),
  );
}

clear.addEventListener("click", async () => {
  const { windowId } = await chrome.tabs.getCurrent().then((tab) => ({ windowId: tab?.windowId }));
  if (windowId === undefined) return;
  const cleared = await send({ type: "clear-window", windowId });
  if (cleared === null || cleared.count === 0) {
    result.textContent = t.nothingToTry;
    return;
  }
  result.textContent = t.archived(cleared.count);
  tryButtons.replaceChildren(
    // Opening the side panel needs a click, which this is.
    h("button", { className: "primary", textContent: t.openArchive, onclick: () => void chrome.sidePanel.open({ windowId }) }),
    h("button", {
      textContent: t.bringBack,
      onclick: async () => {
        await send({ type: "reopen-sweep", at: cleared.at });
        result.textContent = t.theyreBack;
        tryButtons.replaceChildren(clear);
      },
    }),
  );
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.thresholdMs) void renderThresholds();
});
void renderThresholds();
