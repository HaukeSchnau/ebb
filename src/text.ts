import { DAY, HOUR, MINUTE, THRESHOLDS, type Protection } from "./rules.ts";

export type Locale = "en" | "de";

/** German for a browser whose UI is German, English for everyone else. */
export function localeOf(language: string): Locale {
  return language.toLowerCase().split("-")[0] === "de" ? "de" : "en";
}

/** Splits a span of time into whole days, hours and minutes. */
function parts(ms: number) {
  const minutes = Math.max(0, Math.round(ms / MINUTE));
  return { days: Math.floor(minutes / (24 * 60)), hours: Math.floor(minutes / 60) % 24, minutes: minutes % 60, total: minutes };
}

function enDuration(ms: number): string {
  const { days, hours, minutes, total } = parts(ms);
  if (total < 60) return `${minutes}m`;
  if (days === 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  return `${days}d ${hours}h`;
}

function deDuration(ms: number): string {
  const { days, hours, minutes, total } = parts(ms);
  if (total < 60) return `${minutes} Min.`;
  if (days === 0) return `${hours} Std.${minutes > 0 ? ` ${minutes} Min.` : ""}`;
  return `${days} T. ${hours} Std.`;
}

/** Names for THRESHOLDS, in order; any other threshold reads as a duration. */
const thresholdNames = { en: ["3 hours", "12 hours", "1 day", "7 days", "30 days"], de: ["3 Stunden", "12 Stunden", "1 Tag", "7 Tage", "30 Tage"] };

const en = {
  // The side panel
  archive: "Archive",
  clearWindow: "Clear window",
  clearWindowTitle: "Archive every unprotected tab in this window",
  search: "Search archived tabs",
  keys: "↑ ↓ to pick · Enter reopens · Shift+Delete forgets",
  archivedTabs: "Archived tabs",
  nextToGo: "Next to go",
  kept: "Kept",
  clock: "Clock",
  settings: "Settings",
  archiveAfter: "Archive tabs after",
  protectGroups: "Never archive tabs in groups",
  settingsNote:
    "Only time at the computer counts. Pinned tabs, tabs playing audio, and the tab you're on are never archived. Right-click a page to keep it or its whole site.",
  today: "Today",
  yesterday: "Yesterday",
  forgetTitle: "Remove from archive (Shift+Delete)",
  reopenAll: "Reopen all",
  nothingMatches: "Nothing matches.",
  dismiss: "Dismiss",
  undo: "Undo",
  nothingToClear: "Nothing to clear. Every tab in this window is protected.",
  nextMinute: "next minute",
  stopKeeping: "Stop keeping this tab",
  keptEmpty: `Right-click a page and choose Ebb's "Keep this tab" or "Never archive" to list it here.`,
  protection: {
    active: "active",
    split: "in split view",
    pinned: "pinned",
    kept: "kept",
    site: "on kept sites",
    group: "in groups",
    audible: "playing audio",
  } satisfies Record<Protection, string>,
  sweep: (time: string, via: "auto" | "clear", count: number) => `${time} · ${via === "clear" ? "Clear window" : "unseen"} · ${count} tabs`,
  olderTabs: (count: number) => `${count} older tabs. Search to find them.`,
  emptyArchive: (threshold: string) => `Nothing archived yet. Tabs you haven't looked at for ${threshold} of computer time land here.`,
  thresholdHint: (returned: number, total: number, from: string, to: string) =>
    `You brought back ${returned} of the last ${total} tabs Ebb archived within a day. Archiving after ${to} instead of ${from} would keep more of them open.`,
  useThreshold: (to: string) => `Use ${to}`,
  keepThreshold: (from: string) => `Keep ${from}`,
  siteHint: (site: string, returns: number) => `You opened ${site} again ${returns} times this week after Ebb archived it.`,
  neverArchive: (site: string) => `Never archive ${site}`,
  archived: (count: number) => `Archived ${count === 1 ? "1 tab" : `${count} tabs`}.`,
  nextSummary: (aging: number, protectedTabs: string) => `Next to go · ${aging} aging${protectedTabs ? ` · protected: ${protectedTabs}` : ""}`,
  tabTooltip: (lastAccessed: string, ebbSaw: string | undefined) => `lastAccessed ${lastAccessed}\nEbb saw it ${ebbSaw ?? "never"}`,
  archivesIn: (left: string) => `in ${left}`,
  keptSummary: (sites: number, tabs: number) => `Kept · ${sites} site${sites === 1 ? "" : "s"} · ${tabs} tab${tabs === 1 ? "" : "s"}`,
  archiveAgain: (site: string) => `Archive ${site} again`,
  lastPresent: (ago: string | undefined) => `Last present ${ago ?? "never"}. Time away doesn't age tabs.`,

  // The right-click menu and the address bar
  keepTab: "Keep this tab",
  neverArchiveThisSite: "Never archive this site",
  searchArchived: "Search tabs Ebb archived",

  // The welcome page
  welcomeTitle: "Welcome to Ebb",
  welcomeOn: "Ebb is on.",
  welcomeLede: "Ebb closes tabs you've stopped looking at and keeps them in an archive you can search.",
  welcomeAging: "<b>A tab starts aging when you leave it.</b> Only time at the computer counts, so nights and weekends away don't.",
  welcomeProtected:
    "<b>Some tabs never go.</b> Pinned tabs, tabs in a group, tabs playing audio, and the tab you're on. Right-click any page to keep that tab or its whole site.",
  welcomeSearch: "<b>Archived tabs are one search away.</b> Click Ebb's toolbar icon, or type <kbd>ebb</kbd> and a space in the address bar.",
  welcomeThresholdHint:
    "You can change this later in the archive's settings. If Ebb notices you bringing back a lot of tabs, it will suggest a longer time.",
  tryIt: "Try it",
  tryText: "Archive every tab in this window except this one and the protected ones. One click brings them all back.",
  tryButton: "Archive this window's other tabs",
  welcomeFine:
    'Ebb can\'t read what\'s on your pages and has no server. Everything stays in your browser. <a href="https://github.com/HaukeSchnau/ebb" target="_blank" rel="noopener">Source code</a>',
  nothingToTry: "Nothing to archive here. Every other tab in this window is protected.",
  openArchive: "Open the archive",
  bringBack: "Bring them back",
  theyreBack: "They're back.",

  // Times
  ago: (then: number, now: number): string => {
    const ms = Math.max(0, now - then);
    if (ms < MINUTE) return "just now";
    if (ms < HOUR) return `${Math.floor(ms / MINUTE)}m ago`;
    if (ms < DAY) return `${Math.floor(ms / HOUR)}h ago`;
    return `${Math.floor(ms / DAY)}d ago`;
  },
  duration: enDuration,
  threshold: (ms: number): string => thresholdNames.en[THRESHOLDS.indexOf(ms)] ?? enDuration(ms),
};

export type Text = typeof en;

const de: Text = {
  archive: "Archiv",
  clearWindow: "Fenster leeren",
  clearWindowTitle: "Jeden ungeschützten Tab in diesem Fenster archivieren",
  search: "Archivierte Tabs durchsuchen",
  keys: "↑ ↓ wählen · Enter öffnet · Shift+Entf vergisst",
  archivedTabs: "Archivierte Tabs",
  nextToGo: "Als Nächstes",
  kept: "Behalten",
  clock: "Zeit am Computer",
  settings: "Einstellungen",
  archiveAfter: "Tabs archivieren nach",
  protectGroups: "Tabs in Gruppen nie archivieren",
  settingsNote:
    "Es zählt nur die Zeit am Computer. Angeheftete Tabs, Tabs, die Audio abspielen, und der Tab, auf dem du bist, werden nie archiviert. Per Rechtsklick auf eine Seite behältst du sie oder ihre ganze Website.",
  today: "Heute",
  yesterday: "Gestern",
  forgetTitle: "Aus dem Archiv entfernen (Shift+Entf)",
  reopenAll: "Alle wieder öffnen",
  nothingMatches: "Nichts gefunden.",
  dismiss: "Ausblenden",
  undo: "Rückgängig",
  nothingToClear: "Nichts zu leeren. Jeder Tab in diesem Fenster ist geschützt.",
  nextMinute: "in der nächsten Minute",
  stopKeeping: "Diesen Tab nicht mehr behalten",
  keptEmpty: "Klick mit rechts auf eine Seite und wähl bei Ebb „Diesen Tab behalten“ oder „nie archivieren“, dann steht sie hier.",
  protection: {
    active: "aktiv",
    split: "in geteilter Ansicht",
    pinned: "angeheftet",
    kept: "behalten",
    site: "auf behaltenen Websites",
    group: "in Gruppen",
    audible: "mit Audio",
  },
  sweep: (time, via, count) => `${time} · ${via === "clear" ? "Fenster geleert" : "ungesehen"} · ${count} Tabs`,
  olderTabs: (count) => `${count} ältere Tabs. Such, um sie zu finden.`,
  emptyArchive: (threshold) => `Noch nichts archiviert. Tabs, die du ${threshold} Computerzeit lang nicht angesehen hast, landen hier.`,
  thresholdHint: (returned, total, from, to) =>
    `Du hast ${returned} der letzten ${total} archivierten Tabs innerhalb eines Tages zurückgeholt. Mit ${to} statt ${from} blieben mehr davon offen.`,
  useThreshold: (to) => `${to} nehmen`,
  keepThreshold: (from) => `Bei ${from} bleiben`,
  siteHint: (site, returns) => `Du hast ${site} diese Woche ${returns}-mal wieder geöffnet, nachdem Ebb die Seite archiviert hatte.`,
  neverArchive: (site) => `${site} nie archivieren`,
  archived: (count) => `${count === 1 ? "1 Tab" : `${count} Tabs`} archiviert.`,
  nextSummary: (aging, protectedTabs) =>
    `Als Nächstes · ${aging} ${aging === 1 ? "altert" : "altern"}${protectedTabs ? ` · geschützt: ${protectedTabs}` : ""}`,
  tabTooltip: (lastAccessed, ebbSaw) => `Zuletzt aktiv ${lastAccessed}\nVon Ebb gesehen ${ebbSaw ?? "nie"}`,
  archivesIn: (left) => `in ${left}`,
  keptSummary: (sites, tabs) => `Behalten · ${sites} ${sites === 1 ? "Website" : "Websites"} · ${tabs} ${tabs === 1 ? "Tab" : "Tabs"}`,
  archiveAgain: (site) => `${site} wieder archivieren`,
  lastPresent: (ago) => `Zuletzt anwesend ${ago ?? "nie"}. Zeit weg lässt Tabs nicht altern.`,

  keepTab: "Diesen Tab behalten",
  neverArchiveThisSite: "Diese Website nie archivieren",
  searchArchived: "Von Ebb archivierte Tabs durchsuchen",

  welcomeTitle: "Willkommen bei Ebb",
  welcomeOn: "Ebb ist an.",
  welcomeLede: "Ebb schließt Tabs, die du nicht mehr ansiehst, und bewahrt sie in einem Archiv auf, das du durchsuchen kannst.",
  welcomeAging: "<b>Ein Tab beginnt zu altern, wenn du ihn verlässt.</b> Es zählt nur die Zeit am Computer, Nächte und Wochenenden weg also nicht.",
  welcomeProtected:
    "<b>Manche Tabs gehen nie.</b> Angeheftete Tabs, Tabs in einer Gruppe, Tabs, die Audio abspielen, und der Tab, auf dem du bist. Per Rechtsklick auf eine Seite behältst du den Tab oder seine ganze Website.",
  welcomeSearch:
    "<b>Archivierte Tabs sind nur eine Suche entfernt.</b> Klick auf das Symbol von Ebb in der Symbolleiste oder tippe <kbd>ebb</kbd> und ein Leerzeichen in die Adressleiste.",
  welcomeThresholdHint:
    "Das kannst du später in den Einstellungen des Archivs ändern. Merkt Ebb, dass du viele Tabs zurückholst, schlägt es eine längere Zeit vor.",
  tryIt: "Ausprobieren",
  tryText: "Archiviere jeden Tab in diesem Fenster außer diesem und den geschützten. Ein Klick holt alle zurück.",
  tryButton: "Die anderen Tabs dieses Fensters archivieren",
  welcomeFine:
    'Ebb kann nicht lesen, was auf deinen Seiten steht, und hat keinen Server. Alles bleibt in deinem Browser. <a href="https://github.com/HaukeSchnau/ebb" target="_blank" rel="noopener">Quellcode</a>',
  nothingToTry: "Hier gibt es nichts zu archivieren. Jeder andere Tab in diesem Fenster ist geschützt.",
  openArchive: "Archiv öffnen",
  bringBack: "Alle zurückholen",
  theyreBack: "Sie sind zurück.",

  ago: (then, now) => {
    const ms = Math.max(0, now - then);
    if (ms < MINUTE) return "gerade eben";
    if (ms < HOUR) return `vor ${Math.floor(ms / MINUTE)} Min.`;
    if (ms < DAY) return `vor ${Math.floor(ms / HOUR)} Std.`;
    const days = Math.floor(ms / DAY);
    return `vor ${days} ${days === 1 ? "Tag" : "Tagen"}`;
  },
  duration: deDuration,
  threshold: (ms) => thresholdNames.de[THRESHOLDS.indexOf(ms)] ?? deDuration(ms),
};

export const texts: Record<Locale, Text> = { en, de };
