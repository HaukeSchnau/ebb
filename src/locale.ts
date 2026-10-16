import { localeOf, texts } from "./text.ts";

/** The language of the browser's UI, which is also how Chrome picks the manifest's from _locales. */
export const locale = localeOf(chrome.i18n.getUILanguage());
export const t = texts[locale];

const phrases = new Map(Object.entries(t).filter((entry): entry is [string, string] => typeof entry[1] === "string"));

function phrase(key: string): string {
  const text = phrases.get(key);
  if (text === undefined) throw new Error(`text.ts has no phrase "${key}"`);
  return text;
}

/**
 * Fills the page's text from text.ts: `data-text` sets an element's text, `data-html` its markup,
 * and `data-placeholder`, `data-title` and `data-label` (aria-label) those attributes.
 */
export function localize() {
  document.documentElement.lang = locale;
  for (const node of document.querySelectorAll<HTMLElement>("[data-text], [data-html], [data-placeholder], [data-title], [data-label]")) {
    const { text, html, placeholder, title, label } = node.dataset;
    if (text) node.textContent = phrase(text);
    if (html) node.innerHTML = phrase(html);
    if (placeholder) node.setAttribute("placeholder", phrase(placeholder));
    if (title) node.title = phrase(title);
    if (label) node.setAttribute("aria-label", phrase(label));
  }
}
