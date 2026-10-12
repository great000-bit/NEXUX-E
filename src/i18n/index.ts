// The words currently on screen, kept in one place so code outside React (the form checks, the server answers, the file
// checks) says the same thing as the page. Components read the same dictionary through useMessages().
// Only English is bundled with the page. Every other language is its own file, fetched when it is needed.
import { enRuntime as en } from './enCore'
import { decide } from './detect'
import { withEnglishFallback } from './fallback'
import { DEFAULT_LOCALE, isLocale, localeInfo, type LocaleCode } from './locales'
import type { Messages } from './en'

export { fmt } from './types'
export type { Messages } from './en'

let currentMessages: Messages = en
let currentCode: LocaleCode = DEFAULT_LOCALE

export const messages = (): Messages => currentMessages
export const currentLocale = (): LocaleCode => currentCode

export function setCurrent(code: LocaleCode, m: Messages) {
  currentCode = code
  currentMessages = m
}

/** One line per language. The complete English dictionary is loaded beside it, to fill any key it lacks. */
const loaders: Record<LocaleCode, () => Promise<Messages>> = {
  en: async () => en,
  fr: async () => withEnglishFallback((await import('./en')).en as unknown as Messages, (await import('./fr')).fr),
  ar: async () => withEnglishFallback((await import('./en')).en as unknown as Messages, (await import('./ar')).ar),
  pt: async () => withEnglishFallback((await import('./en')).en as unknown as Messages, (await import('./pt')).pt),
}

const cache = new Map<LocaleCode, Messages>([['en', en]])

export async function loadMessages(code: LocaleCode): Promise<Messages> {
  const hit = cache.get(code)
  if (hit) return hit
  const loaded = await loaders[code]()
  cache.set(code, loaded)
  return loaded
}

export const cachedMessages = (code: LocaleCode): Messages | undefined => cache.get(code)

const STORAGE_KEY = 'nexus-e:lang'

/** The language the visitor picked before, or null. Storage can be blocked, so every access is guarded. */
export function storedLocale(): LocaleCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

/** Only a visitor's own pick is saved, and a saved pick is never overridden by detection. */
export function storeLocale(code: LocaleCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* private mode or blocked storage: the pick lasts for this visit */
  }
}

export type Start = { locale: LocaleCode; needsCountry: boolean }

/** Run before the first paint. A saved pick or a browser language is applied at once, so the page never flashes English. */
export async function initI18n(): Promise<Start> {
  const languages = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language ?? '']
  const d = decide(storedLocale(), languages)
  if (d.locale === DEFAULT_LOCALE) return { locale: DEFAULT_LOCALE, needsCountry: d.needsCountry }
  try {
    setCurrent(d.locale, await loadMessages(d.locale))
    // Before the first paint, so a right-to-left page never shows left to right for a moment.
    document.documentElement.lang = d.locale
    document.documentElement.dir = localeInfo(d.locale).dir
    return { locale: d.locale, needsCountry: false }
  } catch {
    return { locale: DEFAULT_LOCALE, needsCountry: false }
  }
}
