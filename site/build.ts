// The website in dist-site/: every page in English and German around one layout, the privacy policy
// rendered from PRIVACY.md and PRIVACY.de.md, and the demo bundled with Ebb's own search.
import { cp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"
import { home } from "./home.ts"
import { legal } from "./legal.ts"
import { type Locale, type Localized, locales, origin, other, type PageId, routes, source, store } from "./site.ts"

const out = "dist-site"

type Page = {
  id: PageId
  locale: Locale
  title: string
  description: string
  main: string
  demo?: boolean
}

const chrome = {
  skip: { en: "Skip to content", de: "Zum Inhalt" },
  site: { en: "Site", de: "Seite" },
  privacy: { en: "Privacy", de: "Datenschutz" },
  source: { en: "Source code", de: "Quellcode" },
  /** The link to the other language, named in that language. */
  switchTo: { en: "Deutsch", de: "English" },
  credit: { en: "A Hauke Schnau Production", de: "Eine Hauke Schnau Produktion" },
  portfolio: { en: "https://schnau.dev/", de: "https://schnau.dev/de/" },
  published: {
    en: "Ebb is free, open source under the MIT license, and published by Urbs UG (haftungsbeschränkt) in Hamburg.",
    de: "Ebb ist kostenlos, Open Source unter der MIT-Lizenz und erscheint bei der Urbs UG (haftungsbeschränkt) in Hamburg.",
  },
  legalNav: { en: "Legal", de: "Rechtliches" },
  legal: { en: "Legal notice", de: "Impressum" },
} as const satisfies Record<string, Localized>

// Inline, so a German browser leaves / before anything paints. Choosing a language with the switch wins.
const languageScript = `<script>
if (location.pathname === "/") {
  const saved = localStorage.getItem("ebb-locale")
  const german = navigator.languages.some((language) => language.toLowerCase().split("-")[0] === "de")
  if (saved === "de" || (saved === null && german)) {
    document.documentElement.style.visibility = "hidden"
    location.replace("/de/" + location.hash)
  }
}
addEventListener("click", (event) => {
  const link = event.target instanceof Element && event.target.closest("a[data-locale]")
  if (link) localStorage.setItem("ebb-locale", link.dataset.locale)
})
</script>`

const layout = (page: Page) => {
  const { id, locale } = page
  const t = (text: Localized) => text[locale]
  const url = (to: Locale) => `${origin}${routes[id][to]}`
  const current = (to: PageId) => (to === id ? ' aria-current="page"' : "")
  return `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${languageScript}
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${url(locale)}">
${locales.map((to) => `<link rel="alternate" hreflang="${to}" href="${url(to)}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${url("en")}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:url" content="${url(locale)}">
<meta property="og:image" content="${origin}/social.png">
<meta property="og:locale" content="${locale === "de" ? "de_DE" : "en_US"}">
<meta property="og:locale:alternate" content="${locale === "de" ? "en_US" : "de_DE"}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f5f4f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141413" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="preload" href="/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#main">${t(chrome.skip)}</a>
<header class="top">
  <a class="brand" href="${routes.home[locale]}"${current("home")}><span class="glyph" aria-hidden="true"><i></i><i></i><i></i></span>Ebb</a>
  <nav aria-label="${t(chrome.site)}">
    <a href="${routes.privacy[locale]}"${current("privacy")}>${t(chrome.privacy)}</a>
    <a href="${source}">${t(chrome.source)}</a>
    <a href="${routes[id][other(locale)]}" hreflang="${other(locale)}" lang="${other(locale)}" data-locale="${other(locale)}">${t(chrome.switchTo)}</a>
  </nav>
</header>
<main id="main">
${page.main.trim()}
</main>
<footer class="foot">
  <div>
    <p class="credit"><a href="${t(chrome.portfolio)}">${t(chrome.credit)}</a></p>
    <p>${t(chrome.published)}</p>
  </div>
  <nav aria-label="${t(chrome.legalNav)}">
    <a href="${store}">Chrome Web Store</a>
    <a href="${routes.privacy[locale]}">${t(chrome.privacy)}</a>
    <a href="${routes.legal[locale]}"${current("legal")}>${t(chrome.legal)}</a>
  </nav>
</footer>
${page.demo ? '<script type="module" src="/demo.js"></script>\n' : ""}</body>
</html>
`
}

const policies: Localized = { en: "PRIVACY.md", de: "PRIVACY.de.md" }

const pagesIn = async (locale: Locale): Promise<Page[]> => [
  {
    id: "home",
    locale,
    title: { en: "Ebb: auto-archive old tabs", de: "Ebb: alte Tabs automatisch archivieren" }[locale],
    description: {
      en: "Ebb closes tabs you've stopped looking at and keeps them in an archive you can search, like Arc's auto-archive did.",
      de: "Ebb schließt Tabs, die du nicht mehr ansiehst, und bewahrt sie in einem durchsuchbaren Archiv auf, so wie das Auto-Archiv von Arc.",
    }[locale],
    main: home(locale),
    demo: true,
  },
  {
    id: "privacy",
    locale,
    title: { en: "Privacy policy, Ebb", de: "Datenschutzerklärung, Ebb" }[locale],
    description: {
      en: "Ebb has no server and makes no network requests. The archive stays in your browser.",
      de: "Ebb hat keinen Server und stellt keine Netzwerkanfragen. Das Archiv bleibt in deinem Browser.",
    }[locale],
    main: `<article class="prose">\n${Bun.markdown.html(await Bun.file(policies[locale]).text(), { autolinks: true })}</article>`,
  },
  {
    id: "legal",
    locale,
    title: { en: "Legal notice, Ebb", de: "Impressum, Ebb" }[locale],
    description: {
      en: "Legal notice of Urbs UG (haftungsbeschränkt), the publisher of Ebb.",
      de: "Impressum der Urbs UG (haftungsbeschränkt), Herausgeberin von Ebb.",
    }[locale],
    main: legal(locale),
  },
]

const pages = (await Promise.all(locales.map(pagesIn))).flat()

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await Promise.all(pages.map((page) => Bun.write(join(out, routes[page.id][page.locale], "index.html"), layout(page))))

const demo = await Bun.build({ entrypoints: ["site/demo.ts"], outdir: out, target: "browser", minify: true })
if (!demo.success) throw new AggregateError(demo.logs, "the demo didn't build")

await Promise.all([
  cp("site/style.css", join(out, "style.css")),
  cp("site/favicon.svg", join(out, "favicon.svg")),
  cp("static/icons/128.png", join(out, "icon.png")),
  cp("store/promo-marquee.png", join(out, "social.png")),
  cp(
    "node_modules/@fontsource-variable/instrument-sans/files/instrument-sans-latin-wdth-normal.woff2",
    join(out, "instrument-sans.woff2"),
  ),
])
