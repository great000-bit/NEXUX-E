// The language registry. A language is one row here, one dictionary file, and one line in loaders (index.ts).
// `dir` is what makes a right-to-left language work: the page direction follows it. `font` names the script, so the
// font for it is fetched only when that language is on screen.

export type LocaleCode = 'en' | 'fr' | 'ar' | 'pt'

export type FontScript = 'latin' | 'arabic'

export type LocaleInfo = {
  code: LocaleCode
  /** The English name of the language. */
  name: string
  /** The language's own name for itself: this is what the picker shows. */
  native: string
  dir: 'ltr' | 'rtl'
  font: FontScript
}

/** Languages that are live: they are in the picker and can be chosen automatically. */
export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', name: 'English', native: 'English', dir: 'ltr', font: 'latin' },
  { code: 'fr', name: 'French', native: 'Français', dir: 'ltr', font: 'latin' },
  { code: 'ar', name: 'Arabic', native: 'العربية', dir: 'rtl', font: 'arabic' },
  { code: 'pt', name: 'Portuguese', native: 'Português', dir: 'ltr', font: 'latin' },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'

/** Languages planned for later tiers. They are known here so the country data can name them, but nothing loads them yet. */
export const PLANNED_LANGUAGES = [
  { code: 'sw', name: 'Swahili', native: 'Kiswahili', dir: 'ltr', font: 'latin' },
  { code: 'am', name: 'Amharic', native: 'አማርኛ', dir: 'ltr', font: 'ethiopic' },
  { code: 'ha', name: 'Hausa', native: 'Hausa', dir: 'ltr', font: 'latin' },
  { code: 'yo', name: 'Yoruba', native: 'Yorùbá', dir: 'ltr', font: 'latin' },
  { code: 'ig', name: 'Igbo', native: 'Igbo', dir: 'ltr', font: 'latin' },
  { code: 'zu', name: 'Zulu', native: 'isiZulu', dir: 'ltr', font: 'latin' },
  { code: 'xh', name: 'Xhosa', native: 'isiXhosa', dir: 'ltr', font: 'latin' },
  { code: 'af', name: 'Afrikaans', native: 'Afrikaans', dir: 'ltr', font: 'latin' },
  { code: 'so', name: 'Somali', native: 'Soomaali', dir: 'ltr', font: 'latin' },
  { code: 'om', name: 'Oromo', native: 'Afaan Oromoo', dir: 'ltr', font: 'latin' },
  { code: 'mg', name: 'Malagasy', native: 'Malagasy', dir: 'ltr', font: 'latin' },
  { code: 'rw', name: 'Kinyarwanda', native: 'Ikinyarwanda', dir: 'ltr', font: 'latin' },
  { code: 'sn', name: 'Shona', native: 'chiShona', dir: 'ltr', font: 'latin' },
  { code: 'ti', name: 'Tigrinya', native: 'ትግርኛ', dir: 'ltr', font: 'ethiopic' },
  { code: 'rn', name: 'Kirundi', native: 'Ikirundi', dir: 'ltr', font: 'latin' },
  { code: 'tn', name: 'Setswana', native: 'Setswana', dir: 'ltr', font: 'latin' },
  { code: 'st', name: 'Sesotho', native: 'Sesotho', dir: 'ltr', font: 'latin' },
  { code: 'ny', name: 'Chichewa', native: 'Chichewa', dir: 'ltr', font: 'latin' },
  { code: 'wo', name: 'Wolof', native: 'Wolof', dir: 'ltr', font: 'latin' },
  { code: 'ln', name: 'Lingala', native: 'Lingála', dir: 'ltr', font: 'latin' },
  { code: 'es', name: 'Spanish', native: 'Español', dir: 'ltr', font: 'latin' },
  { code: 'bm', name: 'Bambara', native: 'Bamanankan', dir: 'ltr', font: 'latin' },
  { code: 'ber', name: 'Berber', native: 'Tamazight', dir: 'ltr', font: 'latin' },
  { code: 'ss', name: 'Swati', native: 'siSwati', dir: 'ltr', font: 'latin' },
] as const

/** Every language code the country data may use: the live ones and the planned ones. */
export const KNOWN_LANGUAGE_CODES: readonly string[] = [...LOCALES.map((l) => l.code), ...PLANNED_LANGUAGES.map((l) => l.code)]

export const isLocale = (v: unknown): v is LocaleCode => LOCALES.some((l) => l.code === v)

export const localeInfo = (code: LocaleCode): LocaleInfo => LOCALES.find((l) => l.code === code) ?? LOCALES[0]

/** The base language of a browser tag: "fr-SN" becomes "fr". */
export const baseLanguage = (tag: string): string => tag.toLowerCase().split(/[-_]/)[0]

/**
 * The first live language other than English in a list of browser languages (ar-EG, fr-CM, pt-AO ...), or null.
 * English is skipped on purpose: it is the default setting on most phones, so it says little about who the visitor is,
 * and the country is a better guide. A visitor who really wants English can choose it once from the picker.
 */
export function browserLocale(languages: readonly string[]): LocaleCode | null {
  for (const tag of languages) {
    const base = baseLanguage(tag)
    if (base !== 'en' && isLocale(base)) return base
  }
  return null
}
