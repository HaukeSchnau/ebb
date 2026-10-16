// The website in dist-site/: three pages around one layout, the privacy policy rendered from
// PRIVACY.md, and the demo bundled with Ebb's own search.
import { cp, mkdir, rm } from "node:fs/promises"
import { join } from "node:path"

const out = "dist-site"
const origin = "https://ebb.schnau.dev"
const store = "https://chromewebstore.google.com/detail/ebb-auto-archive-old-tabs/jifmboaehilnoobbnfffolkhioeknlne"
const source = "https://github.com/HaukeSchnau/ebb"

type Page = {
  path: `/${string}`
  title: string
  description: string
  main: string
  lang?: "en" | "de"
  demo?: boolean
}

const layout = (page: Page) => `<!doctype html>
<html lang="${page.lang ?? "en"}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${page.title}</title>
<meta name="description" content="${page.description}">
<link rel="canonical" href="${origin}${page.path}">
<meta property="og:title" content="${page.title}">
<meta property="og:description" content="${page.description}">
<meta property="og:image" content="${origin}/social.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#f5f4f0" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#141413" media="(prefers-color-scheme: dark)">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/icon.png">
<link rel="preload" href="/instrument-sans.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <a class="brand" href="/"${page.path === "/" ? ' aria-current="page"' : ""}><span class="glyph" aria-hidden="true"><i></i><i></i><i></i></span>Ebb</a>
  <nav aria-label="Site">
    <a href="/privacy/"${page.path === "/privacy/" ? ' aria-current="page"' : ""}>Privacy</a>
    <a href="${source}">Source code</a>
  </nav>
</header>
<main id="main"${page.lang === "de" ? ' lang="de"' : ""}>
${page.main.trim()}
</main>
<footer class="foot">
  <div>
    <p class="credit"><a href="https://schnau.dev/" lang="de">Eine Hauke Schnau Produktion</a></p>
    <p>Ebb is free, open source under the MIT license, and published by Urbs UG (haftungsbeschränkt) in Hamburg.</p>
  </div>
  <nav aria-label="Legal">
    <a href="${store}">Chrome Web Store</a>
    <a href="/privacy/">Privacy</a>
    <a href="/impressum/" hreflang="de">Impressum</a>
  </nav>
</footer>
${page.demo ? '<script type="module" src="/demo.js"></script>\n' : ""}</body>
</html>
`

const pages: Page[] = [
  {
    path: "/",
    title: "Ebb: auto-archive old tabs",
    description: "Ebb closes tabs you've stopped looking at and keeps them in an archive you can search, like Arc's auto-archive did.",
    main: (await Bun.file("site/home.html").text()).replaceAll("{{store}}", store),
    demo: true,
  },
  {
    path: "/privacy/",
    title: "Privacy policy, Ebb",
    description: "Ebb has no server and makes no network requests. The archive stays in your browser.",
    main: `<article class="prose">\n${Bun.markdown.html(await Bun.file("PRIVACY.md").text(), { autolinks: true })}</article>`,
  },
  {
    path: "/impressum/",
    title: "Impressum, Ebb",
    description: "Impressum der Urbs UG (haftungsbeschränkt), Herausgeberin von Ebb.",
    main: await Bun.file("site/impressum.html").text(),
    lang: "de",
  },
]

await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
await Promise.all(pages.map((page) => Bun.write(join(out, page.path, "index.html"), layout(page))))

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
