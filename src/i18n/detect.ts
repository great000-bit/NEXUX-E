// Choosing the language, with no question asked. The order is:
//   1. a language the visitor picked before (saved in localStorage),
//   2. a supported language in the browser's own language list (English does not count, see browserLocale),
//   3. the language of the visitor's country, from the country header Vercel adds (api/geo.js),
//   4. English.
// Steps 1 and 2 are known at once. Step 3 needs one small request, so the page is shown first and switches when it answers.
import { COUNTRY_LANGUAGES } from './countryLanguages'
import { browserLocale, DEFAULT_LOCALE, LOCALES, type LocaleCode } from './locales'

/** The language for a country (ISO 3166 two letter code), when it is live; otherwise English. */
export function localeForCountry(country: string | null | undefined, live: readonly LocaleCode[] = LOCALES.filter((l) => l.complete).map((l) => l.code)): LocaleCode {
  const row = country ? COUNTRY_LANGUAGES[country.trim().toUpperCase()] : undefined
  return row && live.includes(row.default as LocaleCode) ? (row.default as LocaleCode) : DEFAULT_LOCALE
}

export type Decision =
  | { locale: LocaleCode; source: 'saved' | 'browser'; needsCountry: false }
  | { locale: LocaleCode; source: 'default'; needsCountry: true }

/** Steps 1 and 2. When neither decides, the country is asked for (step 3) and English is shown meanwhile. */
export function decide(saved: LocaleCode | null, browserLanguages: readonly string[]): Decision {
  if (saved) return { locale: saved, source: 'saved', needsCountry: false }
  const fromBrowser = browserLocale(browserLanguages)
  if (fromBrowser) return { locale: fromBrowser, source: 'browser', needsCountry: false }
  return { locale: DEFAULT_LOCALE, source: 'default', needsCountry: true }
}
