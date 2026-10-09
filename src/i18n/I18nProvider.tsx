import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { enRuntime as en } from './enCore'
import { DEFAULT_LOCALE, type LocaleCode } from './locales'
import { setCurrent, type Messages } from './index'

// The language feature is switched off for now: the site is English only. There is no picker, no first-visit prompt,
// no stored choice, and French and Portuguese are never loaded. The dictionary structure stays (every page reads its words
// through useMessages) and the French and Portuguese files stay in the repository, unused, so a later plan can reuse them.
// The picker and prompt as they were are in the git history (commit 86d98f9).

type Ctx = { locale: LocaleCode; m: Messages }

const value: Ctx = { locale: DEFAULT_LOCALE, m: en }
const I18nContext = createContext<Ctx>(value)

export const useI18n = () => useContext(I18nContext)
/** The words on screen. English only for now. */
export const useMessages = () => useContext(I18nContext).m

export function I18nProvider({ children }: { children: ReactNode }) {
  // English, left to right, whatever the browser's own language is.
  setCurrent(DEFAULT_LOCALE, en)
  useEffect(() => {
    const root = document.documentElement
    root.lang = 'en'
    root.dir = 'ltr'
  }, [])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
