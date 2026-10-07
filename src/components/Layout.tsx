import { Link, Outlet, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { Logo } from './Logo'

export function Layout() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  const width = pathname.startsWith('/admin') ? 'max-w-6xl' : 'max-w-3xl'
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-green-900 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <header className={`mx-auto w-full ${width} px-5 pt-6 sm:px-8`}>
        <Link to="/" aria-label="NEXUS-E home" className="inline-block rounded-lg">
          <Logo />
        </Link>
      </header>
      <main id="main" key={pathname} className={`page-enter mx-auto w-full ${width} flex-1 px-5 pb-16 pt-8 sm:px-8`}>
        <Outlet />
      </main>
      <footer className="bg-green-900 text-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-5 py-8 text-sm sm:px-8">
          <p className="font-semibold tracking-wide">A stronger environment. A brighter Nigeria.</p>
          <p className="text-white/70">
            NEXUS-E is a registry of environmental professionals. It does not replace statutory or professional licensing.
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-lime-500">People · Planet · Solutions · Nigeria</p>
        </div>
      </footer>
    </div>
  )
}
