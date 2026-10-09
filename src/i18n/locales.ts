// The languages the site is offered in. Adding one means: a file with its words (typed against English, so the compiler
// lists anything missing), one line here, and one line in loaders.ts. `dir` is what makes right-to-left languages such
// as Arabic work: the page direction follows it, and the layout uses logical (start and end) positions.

export type LocaleCode = 'en' | 'fr' | 'pt'

export type LocaleInfo = {
  code: LocaleCode
  /** The language's own name for itself: this is what the picker shows. */
  native: string
  dir: 'ltr' | 'rtl'
}

export const LOCALES: readonly LocaleInfo[] = [
  { code: 'en', native: 'English', dir: 'ltr' },
  { code: 'fr', native: 'Français', dir: 'ltr' },
  { code: 'pt', native: 'Português', dir: 'ltr' },
]

export const DEFAULT_LOCALE: LocaleCode = 'en'

export const isLocale = (v: unknown): v is LocaleCode => LOCALES.some((l) => l.code === v)

export const localeInfo = (code: LocaleCode): LocaleInfo => LOCALES.find((l) => l.code === code) ?? LOCALES[0]

/** The first supported language in a list of browser languages (en-GB, fr-CM, pt-AO ...), or null. */
export function matchLocale(languages: readonly string[]): LocaleCode | null {
  for (const raw of languages) {
    const base = raw.toLowerCase().split('-')[0]
    if (isLocale(base)) return base
  }
  return null
}

/** True when the browser's first language is not English. Those visitors are offered the picker on their first visit. */
export function prefersOtherLanguage(languages: readonly string[]): boolean {
  const first = languages[0]?.toLowerCase().split('-')[0]
  return Boolean(first) && first !== 'en'
}
