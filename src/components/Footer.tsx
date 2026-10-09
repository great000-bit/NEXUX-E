import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Icon } from './icons'
import { useMessages } from '../i18n/I18nProvider'

const DEVELOPER_URL = 'https://www.greatemmanwori.cv'

const col = 'flex flex-col gap-1'
const link = 'inline-flex min-h-11 items-center text-sm font-semibold text-white/80 transition-colors hover:text-lime-500'

export function Footer() {
  const t = useMessages().footer
  const sr = useMessages().common.opensInNewTab
  return (
    <footer className="mt-10 border-t border-white/10 bg-night-900/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.6fr_1fr]">
        <div>
          <Logo onDark />
          <p className="mt-5 font-display text-lg font-semibold text-white">{t.tagline}</p>
          <p className="mt-2 max-w-sm text-sm text-white/70">{t.about}</p>
        </div>

        <nav aria-label="Footer" className={col}>
          <p className="eyebrow mb-1 !text-lime-500">{t.explore}</p>
          <Link to="/register" className={link}>{t.register}</Link>
          <Link to="/verify" className={link}>{t.verify}</Link>
          <Link to="/experts" className={link}>{t.directory}</Link>
          <Link to="/#privacy" className={link}>{t.privacy}</Link>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:px-8">
          <p>{t.copyright}</p>
          <p className="uppercase tracking-[0.2em] text-lime-500/90">{t.pillars}</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
          <p className="text-xs text-white/60">{t.designedBy}</p>
          <a
            href={DEVELOPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-flat inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold text-white transition-colors hover:border-lime-500/60 hover:text-lime-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
          >
            {t.contactDeveloper}
            <Icon name="arrow-up-right" className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span className="sr-only">{sr}</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
