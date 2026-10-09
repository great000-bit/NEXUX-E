import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { Icon } from './icons'

const DEVELOPER_URL = 'https://www.greatemmanwori.cv'

const col = 'flex flex-col gap-1'
const link = 'inline-flex min-h-11 items-center text-sm font-semibold text-white/80 transition-colors hover:text-lime-500'

export function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-night-900/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.6fr_1fr]">
        <div>
          <Logo onDark />
          <p className="mt-5 font-display text-lg font-semibold text-white">Be Found. Be Verified. Be Engaged.</p>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            NEXUS-E is the Verified Environmental Experts Registry. It does not replace statutory or professional licensing.
          </p>
        </div>

        <nav aria-label="Footer" className={col}>
          <p className="eyebrow mb-1 !text-lime-500">Explore</p>
          <Link to="/register" className={link}>Register now</Link>
          <Link to="/verify" className={link}>Verify my profile</Link>
          <Link to="/experts" className={link}>Directory</Link>
          <Link to="/#privacy" className={link}>Your privacy</Link>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:px-8">
          <p>&copy; 2026 NEXUS-E. A stronger environment. A brighter future.</p>
          <p className="uppercase tracking-[0.2em] text-lime-500/90">People · Planet · Solutions</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-5 py-3 sm:px-8">
          <p className="text-xs text-white/60">Designed and built by Great Emman-Wori</p>
          <a
            href={DEVELOPER_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-flat inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-xs font-semibold text-white transition-colors hover:border-lime-500/60 hover:text-lime-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-500"
          >
            Contact developer
            <Icon name="arrow-up-right" className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
        </div>
      </div>
    </footer>
  )
}
