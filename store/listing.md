# Chrome Web Store listing

Copy these into the developer dashboard. The upload is `ebb.zip` from `bun run zip`.

## Store listing

**Name and summary** come from `static/manifest.json`.

**Category:** Productivity › Workflow & Planning

**Language:** English

**Description:**

```
Too many tabs? Ebb closes the ones you've stopped looking at and keeps them in an archive you can search, the way Arc's auto-archive did.

HOW IT DECIDES
• A tab starts aging when you leave it.
• Only time at the computer counts. A night with the laptop closed or a weekend away doesn't empty your tab strip.
• After 12 hours, Ebb closes the tab and adds it to the archive. You can pick 3 hours, 1 day, 7 days, or 30 days instead.
• Pinned tabs, tabs in groups, tabs playing audio, and the tab you're on are never archived.
• Installing Ebb doesn't close anything right away. Tabs start aging at install.

GETTING TABS BACK
• Click the toolbar icon to open the archive in the side panel. Type to search, press Enter to reopen.
• Or type "ebb" and a space in the address bar to search from there.
• Reopened tabs get their back/forward history back while the browser still remembers them.
• "Clear window" archives every unprotected tab in the window at once.

PRIVATE BY DESIGN
Ebb has no server and makes no network requests. The archive stays on your device. Ebb can't read page content, only tab titles and addresses.

Open source under the MIT license: https://github.com/HaukeSchnau/ebb
```

**Description in German** (add German as a listing language; the name and summary come from `static/_locales/de`):

```
Zu viele Tabs? Ebb schließt die, die du nicht mehr ansiehst, und bewahrt sie in einem Archiv auf, das du durchsuchen kannst, so wie das Auto-Archiv von Arc.

SO ENTSCHEIDET EBB
• Ein Tab beginnt zu altern, wenn du ihn verlässt.
• Es zählt nur die Zeit am Computer. Eine Nacht mit zugeklapptem Laptop oder ein Wochenende weg leeren deine Tableiste nicht.
• Nach 12 Stunden schließt Ebb den Tab und legt ihn ins Archiv. Du kannst stattdessen 3 Stunden, 1 Tag, 7 Tage oder 30 Tage wählen.
• Angeheftete Tabs, Tabs in Gruppen, Tabs, die Audio abspielen, und der Tab, auf dem du bist, werden nie archiviert.
• Die Installation schließt nichts sofort. Tabs altern erst ab der Installation.

TABS ZURÜCKHOLEN
• Klick auf das Symbol in der Symbolleiste, um das Archiv in der Seitenleiste zu öffnen. Tipp, um zu suchen, und drück Enter, um einen Tab wieder zu öffnen.
• Oder tipp „ebb“ und ein Leerzeichen in die Adressleiste und such dort.
• Wieder geöffnete Tabs bekommen ihren Verlauf für Zurück und Vorwärts zurück, solange der Browser ihn noch kennt.
• „Fenster leeren“ archiviert alle ungeschützten Tabs im Fenster auf einmal.

PRIVAT VON GRUND AUF
Ebb hat keinen Server und stellt keine Netzwerkanfragen. Das Archiv bleibt auf deinem Gerät. Ebb kann keine Seiteninhalte lesen, nur Titel und Adressen von Tabs.

Open Source unter der MIT-Lizenz: https://github.com/HaukeSchnau/ebb
```

**Graphics:** `store/promo-small.png` (440×280), `store/promo-marquee.png` (1400×560), and `store/screenshot-1.png` through `store/screenshot-4.png` (1280×800).

**Homepage URL:** https://ebb.schnau.dev

**Support URL:** https://github.com/HaukeSchnau/ebb/issues

## Privacy practices

**Single purpose:**

```
Ebb automatically closes browser tabs the user hasn't looked at for a configurable time and keeps them in a searchable archive so the user can reopen them.
```

**Permission justifications:**

| Permission | Justification |
| --- | --- |
| tabs | Reads the URL, title, and last-active time of open tabs to find stale ones, closes them, and opens archived tabs again. Ebb never reads page content. |
| alarms | Runs the check for stale tabs once a minute. |
| idle | Detects when the user is away or the screen is locked, so that time doesn't count toward a tab's age. |
| sessions | Reopens an archived tab with its back/forward history from the browser's recently closed list. |
| sidePanel | Shows the archive, search, and settings in the side panel. |
| contextMenus | Adds "Keep this tab" and "Never archive <site>" to the right-click menu of a page, so the user can protect a tab or a whole site from being archived. |
| storage | Stores on the user's device: the archive, which archived tabs were opened again in the last 30 days (to suggest a better threshold), the away periods, the tabs the user chose to keep, and the settings. |
| favicon | Shows site icons next to archived tabs from the browser's local icon cache, without network requests. |

**Remote code:** No, I am not using remote code.

**Data usage.** Chrome Web Store policy requires disclosure even when data never leaves the device. Check these:

- **Web history:** the URLs, titles, and archive times of tabs Ebb closed, stored locally.
- **User activity:** start and end times of away periods, derived from the browser's idle state and stored locally. No clicks or keystrokes are recorded.

Then certify all three statements: data isn't sold to third parties, isn't used for purposes unrelated to the single purpose, and isn't used for creditworthiness or lending.

**Privacy policy URL:** https://ebb.schnau.dev/privacy/

## Distribution

Public, all regions, free.
