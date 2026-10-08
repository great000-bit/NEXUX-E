import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Logo } from './Logo'
import { Icon } from './icons'
import { Button } from './ds'

/** Anchors on the home page. They work from any page because the layout scrolls to the hash. */
export const NAV_LINKS = [
  { to: '/#how-it-works', label: 'How it works' },
  { to: '/#expertise', label: 'Expertise' },
  { to: '/#who-finds-you', label: 'Who finds you' },
  { to: '/#privacy', label: 'Privacy' },
] as const

const linkCls =
  'inline-flex min-h-11 items-center rounded-full px-3.5 text-sm font-semibold text-white/85 transition-colors duration-150 hover:bg-white/10 hover:text-white'
const sheetLink =
  'flex min-h-14 items-center justify-between rounded-2xl px-4 font-display text-xl font-semibold text-white transition-colors hover:bg-white/10'

export function Navbar() {
  const { pathname } = useLocation()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const firstLink = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the sheet whenever the page changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false)
  }, [pathname])

  const close = useCallback(() => {
    setOpen(false)
    menuButton.current?.focus()
  }, [])

  // While the sheet is open: lock page scroll, move focus into it, and let Escape close it.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstLink.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  return (
    <header className="site-header sticky top-0 z-40 px-3 pt-3 sm:px-6 sm:pt-4">
      <div className="mx-auto flex max-w-[88rem] items-center justify-between gap-4">
        <Link to="/" className="inline-flex min-h-11 items-center rounded-xl">
          <Logo onDark />
          <span className="sr-only">Home page</span>
        </Link>

        {/* Desktop: a floating glass pill */}
        <nav
          aria-label="Primary"
          data-scrolled={scrolled}
          className="nav-pill glass hidden items-center gap-0.5 rounded-full p-1.5 lg:flex"
        >
          {NAV_LINKS.map((l) => (
            <Link key={l.to} to={l.to} className={linkCls}>{l.label}</Link>
          ))}
          <Link
            to="/experts"
            className="ml-1 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 py-1 pl-4 pr-1 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/15"
          >
            Directory
            <Icon name="arrow-up-right" className="h-3.5 w-3.5" strokeWidth={2.2} />
            <span aria-hidden="true" className="ml-1 grid h-9 w-9 place-items-center rounded-full bg-white text-green-950">
              <Icon name="shield-check" className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.9} />
            </span>
          </Link>
        </nav>

        <div className="flex items-center gap-1">
          <Link
            to="/verify"
            className="hidden min-h-11 items-center gap-2.5 rounded-full px-4 text-sm font-semibold text-white/90 transition-colors duration-150 hover:bg-white/10 hover:text-white lg:inline-flex"
          >
            <Icon name="user" className="h-5 w-5" />
            Verify my profile
          </Link>

          <button
            ref={menuButton}
            type="button"
            className="glass grid h-11 w-11 place-items-center rounded-full text-white lg:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            aria-controls="mobile-menu"
            onClick={() => setOpen((v) => !v)}
          >
            <Icon name={open ? 'close' : 'menu'} className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Mobile and tablet: a glass sheet. Register is always reachable at the bottom. */}
      {open && (
        <div
          id="mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="sheet-menu fixed inset-0 z-50 flex flex-col px-5 pb-6 pt-4 lg:hidden"
        >
          <div className="flex items-center justify-between">
            <Link to="/" className="inline-flex min-h-11 items-center rounded-xl" onClick={() => setOpen(false)}>
              <Logo onDark />
              <span className="sr-only">Home page</span>
            </Link>
            <button type="button" className="glass grid h-11 w-11 place-items-center rounded-full text-white" aria-label="Close menu" onClick={close}>
              <Icon name="close" className="h-5 w-5" strokeWidth={2} />
            </button>
          </div>

          <nav aria-label="Menu" className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV_LINKS.map((l, i) => (
              <Link key={l.to} ref={i === 0 ? firstLink : undefined} to={l.to} onClick={() => setOpen(false)} className={sheetLink}>
                {l.label}
                <Icon name="arrow-right" className="h-5 w-5 text-white/50" />
              </Link>
            ))}
            <Link to="/experts" onClick={() => setOpen(false)} className={sheetLink}>
              Directory
              <Icon name="shield-check" className="h-5 w-5 text-lime-500" />
            </Link>
          </nav>

          <div className="mt-4 grid gap-3">
            <Button to="/register" variant="accent" icon="arrow-right" onClick={() => setOpen(false)}>Register now</Button>
            <Button to="/verify" variant="secondary" icon="arrow-right" onClick={() => setOpen(false)}>Verify my profile</Button>
          </div>
        </div>
      )}
    </header>
  )
}
