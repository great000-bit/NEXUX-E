import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import {
  cachedMessages, loadMessages, setCurrent, storedLocale, storeLocale, type Messages,
} from './index'
import { DEFAULT_LOCALE, localeInfo, LOCALES, matchLocale, prefersOtherLanguage, type LocaleCode } from './locales'
import { enRuntime as en } from './enCore'

type Ctx = { locale: LocaleCode; m: Messages; setLocale: (code: LocaleCode) => Promise<void> }

const I18nContext = createContext<Ctx>({ locale: DEFAULT_LOCALE, m: en, setLocale: async () => undefined })

export const useI18n = () => useContext(I18nContext)
/** The words for the language now shown. */
export const useMessages = () => useContext(I18nContext).m

/**
 * Holds the chosen language. The admin area is staff-only and stays in English whatever the visitor chose.
 * The page's `lang` and `dir` follow the language, which is what makes a right-to-left language work later.
 */
export function I18nProvider({ initial, children }: { initial: LocaleCode; children: ReactNode }) {
  const { pathname } = useLocation()
  const isAdmin = pathname.startsWith('/admin')
  const [locale, setLocaleState] = useState<LocaleCode>(initial)
  const effective: LocaleCode = isAdmin ? 'en' : locale
  const m = cachedMessages(effective) ?? en

  // Set during render, on purpose: code outside React (form checks, server answers) must agree with what is on screen.
  setCurrent(cachedMessages(effective) ? effective : DEFAULT_LOCALE, m)

  useEffect(() => {
    const root = document.documentElement
    root.lang = effective
    root.dir = localeInfo(effective).dir
  }, [effective])

  const setLocale = useCallback(async (code: LocaleCode) => {
    try {
      await loadMessages(code)
    } catch {
      return // the file could not be fetched (offline): stay in the language already shown
    }
    storeLocale(code)
    setLocaleState(code)
  }, [])

  const value = useMemo(() => ({ locale: effective, m, setLocale }), [effective, m, setLocale])

  return (
    <I18nContext.Provider value={value}>
      {children}
      {!isAdmin && <FirstVisitPrompt setLocale={setLocale} />}
    </I18nContext.Provider>
  )
}

/**
 * Offered once, to a visitor whose browser is not set to English and who has not chosen a language before. It shows the
 * choices in the browser's own language when we have it, and never changes the language without being asked.
 */
function FirstVisitPrompt({ setLocale }: { setLocale: (code: LocaleCode) => Promise<void> }) {
  const [text, setText] = useState<{ locale: LocaleCode; m: Messages; suggested: LocaleCode | null } | null>(null)
  const dialog = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (storedLocale()) return
    const languages = navigator.languages?.length ? navigator.languages : [navigator.language ?? 'en']
    if (!prefersOtherLanguage(languages)) return
    const suggested = matchLocale(languages)
    let live = true
    loadMessages(suggested ?? 'en')
      .then((m) => {
        if (live) setText({ locale: suggested ?? 'en', m, suggested })
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  const choose = useCallback(
    (code: LocaleCode) => {
      setText(null)
      void setLocale(code)
    },
    [setLocale],
  )

  useEffect(() => {
    if (!text) return
    const root = dialog.current
    root?.querySelector<HTMLElement>('[data-suggested="true"], button')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return choose('en')
      if (e.key !== 'Tab' || !root) return
      const items = [...root.querySelectorAll<HTMLElement>('button')]
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [text, choose])

  if (!text) return null
  const t = text.m.language
  // The suggested language first, then the rest in their usual order.
  const ordered = [...LOCALES].sort((a, b) => Number(b.code === text.suggested) - Number(a.code === text.suggested))

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-black/60 p-4" lang={text.locale} dir={localeInfo(text.locale).dir}>
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lang-title"
        aria-describedby="lang-text"
        className="glass w-full max-w-sm rounded-[var(--radius-xl)] p-6 text-white sm:p-7"
      >
        <h2 id="lang-title" className="font-display text-2xl font-semibold">{t.popupTitle}</h2>
        <p id="lang-text" className="mt-2 text-sm text-white/80">{t.popupText}</p>
        <div className="mt-5 grid gap-2.5">
          {ordered.map((l) => (
            <button
              key={l.code}
              type="button"
              lang={l.code}
              data-suggested={l.code === text.suggested ? 'true' : undefined}
              className={`btn ${l.code === text.suggested ? 'btn-accent' : 'btn-secondary'} w-full justify-between`}
              onClick={() => choose(l.code)}
            >
              <span>{l.native}</span>
              {l.code === text.suggested && <span className="text-xs font-semibold opacity-80">{t.suggested}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
