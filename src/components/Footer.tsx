import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import { CONTACT_EMAIL } from '../lib/config'

const col = 'flex flex-col gap-1'
const link = 'inline-flex min-h-11 items-center text-sm font-semibold text-white/80 transition-colors hover:text-lime-500'

export function Footer() {
  return (
    <footer className="mt-10 border-t border-white/10 bg-night-900/60">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-12 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo onDark />
          <p className="mt-5 font-display text-lg font-semibold text-white">Be Found. Be Verified. Be Engaged.</p>
          <p className="mt-2 max-w-sm text-sm text-white/70">
            NEXUS-E is Nigeria&rsquo;s Verified Environmental Experts Registry. It does not replace statutory or professional licensing.
          </p>
        </div>

        <nav aria-label="Footer" className={col}>
          <p className="eyebrow mb-1 !text-lime-500">Explore</p>
          <Link to="/register" className={link}>Register now</Link>
          <Link to="/verify" className={link}>Verify my profile</Link>
          <Link to="/experts" className={link}>Directory</Link>
          <Link to="/#privacy" className={link}>Your privacy</Link>
        </nav>

        <div className={col}>
          <p className="eyebrow mb-1 !text-lime-500">Contact</p>
          {CONTACT_EMAIL ? (
            <a href={`mailto:${CONTACT_EMAIL}`} className={`${link} break-all`}>{CONTACT_EMAIL}</a>
          ) : (
            <p className="text-sm text-white/70">Write to the NEXUS-E team at the address on your confirmation email.</p>
          )}
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-5 py-5 text-xs text-white/60 sm:flex-row sm:items-center sm:px-8">
          <p>&copy; 2026 NEXUS-E. A stronger environment. A brighter Nigeria.</p>
          <p className="uppercase tracking-[0.2em] text-lime-500/90">People · Planet · Solutions · Nigeria</p>
        </div>
      </div>
    </footer>
  )
}
