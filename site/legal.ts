import type { Locale, Localized } from "./site.ts"

/** The Impressum German law asks for, and its English translation. */
export const legal = (locale: Locale) => {
  const t = (text: Localized) => text[locale]
  return `
<article class="prose">
  <h1>${t({ en: "Legal notice", de: "Impressum" })}</h1>
  <p>${t({ en: "Information pursuant to § 5 of the German Digital Services Act (DDG).", de: "Angaben gemäß § 5 DDG." })}</p>

  <h2>${t({ en: "Service provider", de: "Anbieterin" })}</h2>
  <address>Urbs UG (haftungsbeschränkt)<br>Stellinger Chaussee 19<br>22529 Hamburg<br>${t({ en: "Germany", de: "Deutschland" })}</address>
  <dl>
    <dt>${t({ en: "Represented by", de: "Vertreten durch" })}</dt><dd>${t({ en: "Hauke Schnau, managing director", de: "Hauke Schnau, Geschäftsführer" })}</dd>
    <dt>${t({ en: "Register court", de: "Registergericht" })}</dt><dd>Amtsgericht Hamburg</dd>
    <dt>${t({ en: "Registration number", de: "Registernummer" })}</dt><dd>HRB 185737</dd>
  </dl>

  <h2>${t({ en: "Contact", de: "Kontakt" })}</h2>
  <dl>
    <dt>${t({ en: "Email", de: "E-Mail" })}</dt><dd><a href="mailto:info@urbs.one">info@urbs.one</a></dd>
    <dt>${t({ en: "Phone", de: "Telefon" })}</dt><dd><a href="tel:+491728284708">+49 172 8284708</a></dd>
  </dl>

  <h2>${t({ en: "Consumer dispute resolution", de: "Verbraucherstreitbeilegung" })}</h2>
  <p>${t({
    en: "We are neither obliged nor willing to take part in dispute resolution proceedings before a consumer arbitration board.",
    de: "Wir sind nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
  })}</p>
</article>
`
}
