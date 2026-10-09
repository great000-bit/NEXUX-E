import { useI18n } from '../i18n/I18nProvider'
import { isLocale, LOCALES } from '../i18n/locales'

/** The language choice in the header: a native select, so it is keyboard and screen reader friendly on every phone. */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const { locale, m, setLocale } = useI18n()
  return (
    <label className={`lang-picker glass relative inline-flex h-11 items-center rounded-full text-white ${className}`}>
      <span className="sr-only">{m.language.label}</span>
      <svg viewBox="0 0 24 24" className="pointer-events-none absolute start-3 h-[1.05rem] w-[1.05rem]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.6 2.6 4 5.6 4 9s-1.4 6.4-4 9c-2.6-2.6-4-5.6-4-9s1.4-6.4 4-9Z" />
      </svg>
      <select
        value={locale}
        onChange={(e) => isLocale(e.target.value) && void setLocale(e.target.value)}
        className="h-11 cursor-pointer appearance-none rounded-full bg-transparent ps-9 pe-3 text-sm font-semibold text-white outline-none"
      >
        {LOCALES.map((l) => (
          <option key={l.code} value={l.code} lang={l.code} style={{ color: '#0f1a14' }}>
            {l.native}
          </option>
        ))}
      </select>
    </label>
  )
}
