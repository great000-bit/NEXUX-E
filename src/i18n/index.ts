// The words currently on screen, kept in one place so code outside React (the form checks, the server answers, the file
// checks) says the same language as the page. Components read the same dictionary through useMessages().
import { enRuntime as en } from './enCore'
import type { Messages } from './en'
import { DEFAULT_LOCALE, isLocale, type LocaleCode } from './locales'

export { fmt } from './types'
export type { Messages } from './en'

let currentMessages: Messages = en
let currentCode: LocaleCode = DEFAULT_LOCALE

/** The dictionary for the language now shown. English until another one has been loaded. */
export const messages = (): Messages => currentMessages
export const currentLocale = (): LocaleCode => currentCode

export function setCurrent(code: LocaleCode, m: Messages) {
  currentCode = code
  currentMessages = m
}

/** Each other language is its own file, fetched only when someone chooses it. */
const loaders: Record<LocaleCode, () => Promise<Messages>> = {
  en: async () => en,
  fr: async () => (await import('./fr')).fr,
  pt: async () => (await import('./pt')).pt,
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

/** The language the person chose before, or null. Storage can be blocked, so every access is guarded. */
export function storedLocale(): LocaleCode | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return isLocale(v) ? v : null
  } catch {
    return null
  }
}

export function storeLocale(code: LocaleCode) {
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    /* private mode or blocked storage: the choice simply lasts for this visit */
  }
}

/** Run before the first paint: if the person chose another language earlier, have it ready so the page never flashes English. */
export async function initI18n(): Promise<LocaleCode> {
  const stored = storedLocale()
  if (!stored || stored === 'en') return DEFAULT_LOCALE
  try {
    setCurrent(stored, await loadMessages(stored))
    return stored
  } catch {
    return DEFAULT_LOCALE
  }
}
