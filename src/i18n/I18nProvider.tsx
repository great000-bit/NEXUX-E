import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cachedMessages, loadMessages, setCurrent, storeLocale, type Messages, type Start } from './index'
import { localeForCountry } from './detect'
import { loadScriptFont } from './fonts'
import { fetchCountry } from './geo'
import { DEFAULT_LOCALE, localeInfo, type LocaleCode } from './locales'
import { enRuntime as en } from './enCore'

type Ctx = { locale: LocaleCode; m: Messages; setLocale: (code: LocaleCode) => Promise<void> }

const I18nContext = createContext<Ctx>({ locale: DEFAULT_LOCALE, m: en, setLocale: async () => undefined })

export const useI18n = () => useContext(I18nContext)
/** The words for the language now shown. */
export const useMessages = () => useContext(I18nContext).m

/**
 * Holds the language. It is chosen without asking (see detect.ts); the picker in the header is the permanent manual
 * override, and a visitor's own pick is saved and never overridden again. The admin area is staff-only and stays in
 * English. The page's `lang` and `dir` follow the language, which is what makes right-to-left work.
 */
export function I18nProvider({ start, children }: { start: Start; children: ReactNode }) {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const [locale, setLocaleState] = useState<LocaleCode>(start.locale)
  const picked = useRef(false)
  const effective: LocaleCode = isAdmin ? 'en' : locale
  const m = cachedMessages(effective) ?? en

  // Set during render, on purpose: code outside React (form checks, server answers) must agree with what is on screen.
  setCurrent(cachedMessages(effective) ? effective : DEFAULT_LOCALE, m)

  useEffect(() => {
    const info = localeInfo(effective)
    const root = document.documentElement
    root.lang = effective
    root.dir = info.dir
    // The page is already readable: the font for a non-Latin script arrives a moment later and swaps in.
    void loadScriptFont(info.font).catch(() => undefined)
  }, [effective])

  // Step 3 of detection: neither a saved pick nor a browser language decided, so ask for the country once. English is
  // shown meanwhile, and nothing waits for the answer.
  useEffect(() => {
    if (!start.needsCountry || isAdmin) return
    let live = true
    void fetchCountry().then(async (country) => {
      const code = localeForCountry(country)
      if (!live || picked.current || code === DEFAULT_LOCALE) return
      try {
        await loadMessages(code)
      } catch {
        return
      }
      if (live && !picked.current) setLocaleState(code)
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setLocale = useCallback(async (code: LocaleCode) => {
    picked.current = true
    try {
      await loadMessages(code)
    } catch {
      return // the file could not be fetched (offline): stay in the language already shown
    }
    storeLocale(code)
    setLocaleState(code)
  }, [])

  const value = useMemo(() => ({ locale: effective, m, setLocale }), [effective, m, setLocale])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}
