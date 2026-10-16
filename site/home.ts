import { type Locale, type Localized, routes, source, store } from "./site.ts"

export const home = (locale: Locale) => {
  const t = (text: Localized) => text[locale]
  const cta = `<a class="cta" href="${store}">${t({ en: "Add to Chrome", de: "Zu Chrome hinzufügen" })}</a>`
  const keys = (...names: string[]) => names.map((name) => `<kbd>${name}</kbd>`).join(" ")

  return `
<section class="hero">
  <h1>${t({ en: "Tabs you stopped looking at, one search away.", de: "Alte Tabs, nur eine Suche entfernt." })}</h1>
  <div>
    <p class="lede">${t({
      en: "Ebb closes tabs you haven't looked at for 12 hours and keeps them in an archive you can search, like Arc's auto-archive did. Only time at the computer counts.",
      de: "Ebb schließt Tabs, die du seit 12 Stunden nicht angesehen hast, und legt sie in ein durchsuchbares Archiv, wie früher das Auto-Archiv von Arc. Nur die Zeit am Computer zählt.",
    })}</p>
    <p class="get">
      ${cta}
      <span>${t({
        en: `Free. Works in Chrome, <a href="https://helium.computer">Helium</a> and other Chromium browsers.`,
        de: `Kostenlos. Läuft in Chrome, <a href="https://helium.computer">Helium</a> und anderen Chromium-Browsern. Ebb selbst ist auf Englisch.`,
      })}</span>
    </p>
  </div>
</section>

<section class="demo" aria-labelledby="demo-title">
  <h2 id="demo-title" class="visually-hidden">${t({ en: "Try it", de: "Ausprobieren" })}</h2>
  <div class="window">
    <div class="tabs">
      <div class="pane-head">
        <h3>${t({ en: "Your tabs", de: "Deine Tabs" })}</h3>
        <p id="clock"></p>
      </div>
      <ol id="tabs" aria-label="${t({ en: "Open tabs", de: "Offene Tabs" })}"></ol>
      <div class="controls">
        <button id="work" type="button"></button>
        <button id="sleep" type="button">${t({ en: "Sleep for 8 hours", de: "8 Stunden schlafen" })}</button>
      </div>
      <p id="said" class="said" role="status"></p>
    </div>
    <div class="archive">
      <div class="pane-head">
        <h3>${t({ en: "Archive", de: "Archiv" })} <span id="count"></span></h3>
      </div>
      <input id="search" type="search" placeholder="${t({ en: "Search archived tabs", de: "Archivierte Tabs durchsuchen" })}" autocomplete="off" spellcheck="false" aria-label="${t({ en: "Search archived tabs", de: "Archivierte Tabs durchsuchen" })}" aria-controls="archived">
      <p class="try">${t({ en: "Try", de: "Probier" })} <button id="example" type="button">gh eff</button>. ${t({ en: "This is Ebb's own search.", de: "Das ist die echte Suche von Ebb." })}</p>
      <ol id="archived" aria-label="${t({ en: "Archived tabs", de: "Archivierte Tabs" })}"></ol>
      <p id="none" class="none" hidden>${t({ en: "No archived tab matches.", de: "Kein archivierter Tab passt." })}</p>
    </div>
  </div>
</section>

<div class="facts">
  <section>
    <h2>${t({ en: "How Ebb decides", de: "So entscheidet Ebb" })}</h2>
    <div>
      <p>${t({
        en: "A tab starts aging when you leave it, and only time at the computer counts. Sleep, a closed browser and ten minutes without input don't age your tabs. After 12 hours Ebb closes the tab and adds it to the archive. You can pick 3 hours, 1 day, 7 days or 30 days instead.",
        de: "Ein Tab beginnt zu altern, wenn du ihn verlässt, und es zählt nur die Zeit am Computer. Schlaf, ein geschlossener Browser und zehn Minuten ohne Eingabe lassen deine Tabs nicht altern. Nach 12 Stunden schließt Ebb den Tab und legt ihn ins Archiv. Du kannst stattdessen 3 Stunden, 1 Tag, 7 Tage oder 30 Tage wählen.",
      })}</p>
      <p>${t({ en: "Some tabs never go:", de: "Manche Tabs gehen nie:" })}</p>
      <ul>
        <li>${t({ en: "pinned tabs, and tabs in a group unless you turn that off", de: "angeheftete Tabs, und Tabs in einer Gruppe, außer du schaltest das ab" })}</li>
        <li>${t({ en: "tabs playing audio", de: "Tabs, die Audio abspielen" })}</li>
        <li>${t({ en: "the active tab in each window, and both panes of a split view you're looking at", de: "der aktive Tab in jedem Fenster und beide Hälften einer geteilten Ansicht, die du gerade ansiehst" })}</li>
        <li>${t({ en: "any tab you keep, or any site you never want archived. Right-click the page for either.", de: "jeder Tab, den du behältst, und jede Website, die nie archiviert werden soll. Beides geht per Rechtsklick auf die Seite." })}</li>
      </ul>
      <p>${t({ en: "Installing Ebb doesn't archive your backlog. Tabs start aging at install.", de: "Die Installation archiviert nicht deine alten Tabs auf einen Schlag. Tabs altern erst ab der Installation." })}</p>
    </div>
  </section>
  <section>
    <h2>${t({ en: "Getting tabs back", de: "Tabs zurückholen" })}</h2>
    <div>
      <p>${t({
        en: `Press ${keys("⌘", "Shift", "E")} on a Mac, ${keys("Alt", "Shift", "E")} elsewhere, or click Ebb's toolbar icon to open the archive in the side panel. ${keys("↑")} and ${keys("↓")} pick a result, ${keys("Enter")} reopens it and ${keys("Shift", "Delete")} forgets it. From the address bar, type ${keys("ebb")} and a space, then search.`,
        de: `Drück ${keys("⌘", "Shift", "E")} auf dem Mac, sonst ${keys("Alt", "Shift", "E")}, oder klick auf das Symbol von Ebb in der Symbolleiste, um das Archiv in der Seitenleiste zu öffnen. ${keys("↑")} und ${keys("↓")} wählen ein Ergebnis, ${keys("Enter")} öffnet es wieder und ${keys("Shift", "Entf")} vergisst es. In der Adressleiste tippst du ${keys("ebb")} und ein Leerzeichen und suchst dann.`,
      })}</p>
      <p>${t({
        en: "A reopened tab gets its back and forward history back while it's among the browser's 25 most recently closed tabs.",
        de: "Ein wieder geöffneter Tab bekommt seinen Verlauf für Zurück und Vorwärts zurück, solange er unter den 25 zuletzt geschlossenen Tabs des Browsers ist.",
      })}</p>
      <p>${t({
        en: "Clear window archives every unprotected tab in the window at once, with ten seconds to undo. Tabs archived together come back together with Reopen all.",
        de: "Clear window archiviert alle ungeschützten Tabs im Fenster auf einmal, und du hast zehn Sekunden, um das rückgängig zu machen. Was zusammen ins Archiv ging, kommt mit Reopen all zusammen zurück.",
      })}</p>
    </div>
  </section>
  <section>
    <h2>${t({ en: "When 12 hours is too short", de: "Wenn 12 Stunden zu kurz sind" })}</h2>
    <div>
      <p>${t({
        en: "If at least 15% of the last 20 or more tabs Ebb archived came back within a day, the archive suggests the next longer time. Reopen one site three times in a week and Ebb offers to keep that site. It never changes a setting on its own, and a suggestion you dismiss stays quiet.",
        de: "Holst du von den letzten 20 oder mehr archivierten Tabs mindestens 15&nbsp;% innerhalb eines Tages zurück, schlägt das Archiv die nächstlängere Zeit vor. Öffnest du eine Website in einer Woche dreimal wieder, bietet Ebb an, sie zu behalten. Ebb ändert nie selbst eine Einstellung, und ein Vorschlag, den du wegklickst, meldet sich nicht wieder.",
      })}</p>
    </div>
  </section>
  <section>
    <h2>${t({ en: "Your tabs stay in your browser", de: "Deine Tabs bleiben in deinem Browser" })}</h2>
    <div>
      <p>${t({
        en: `Ebb has no server and makes no network requests. The archive stays on your device. Ebb reads the titles and addresses of your tabs, never what's on the pages. The <a href="${routes.privacy.en}">privacy policy</a> lists everything it stores, and the <a href="${source}#privacy">source code</a> explains each permission.`,
        de: `Ebb hat keinen Server und stellt keine Netzwerkanfragen. Das Archiv bleibt auf deinem Gerät. Ebb liest Titel und Adressen deiner Tabs, aber nie, was auf den Seiten steht. Die <a href="${routes.privacy.de}">Datenschutzerklärung</a> listet alles auf, was Ebb speichert, und der <a href="${source}#privacy">Quellcode</a> erklärt jede Berechtigung.`,
      })}</p>
      <p class="get">${cta}</p>
    </div>
  </section>
</div>
`
}
