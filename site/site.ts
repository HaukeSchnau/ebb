export const locales = ["en", "de"] as const
export type Locale = (typeof locales)[number]
export type Localized<T = string> = { readonly [L in Locale]: T }

/** Every page in both languages. The store listing links the English privacy URL, so it must stay. */
export const routes = {
  home: { en: "/", de: "/de/" },
  privacy: { en: "/privacy/", de: "/de/datenschutz/" },
  legal: { en: "/legal-notice/", de: "/de/impressum/" },
} as const satisfies Record<string, Localized<`/${string}`>>

export type PageId = keyof typeof routes

export const other = (locale: Locale): Locale => (locale === "en" ? "de" : "en")

export const origin = "https://ebb.schnau.dev"
export const store = "https://chromewebstore.google.com/detail/ebb-auto-archive-old-tabs/jifmboaehilnoobbnfffolkhioeknlne"
export const source = "https://github.com/HaukeSchnau/ebb"
