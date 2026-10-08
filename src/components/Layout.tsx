import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Navbar } from './Navbar'
import { Footer } from './Footer'
import { scrollToId } from '../lib/scroll'

export function Layout() {
  const { pathname, hash } = useLocation()

  // New page: start at the top. A link to /#section: scroll to that section once it exists.
  useEffect(() => {
    if (hash.length > 1) scrollToId(decodeURIComponent(hash.slice(1)))
    else window.scrollTo(0, 0)
  }, [pathname, hash])

  const isHome = pathname === '/'
  const isAdmin = pathname.startsWith('/admin')
  const width = isAdmin ? 'max-w-6xl' : pathname === '/experts' ? 'max-w-5xl' : 'max-w-3xl'

  return (
    <div className="shell theme-dark flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-lime-500 focus:px-4 focus:py-2 focus:font-bold focus:text-green-950"
      >
        Skip to content
      </a>
      <Navbar />
      {isHome ? (
        <main id="main" className="flex-1">
          <Outlet />
        </main>
      ) : (
        <main id="main" key={pathname} className={`page-enter mx-auto w-full ${width} flex-1 px-4 pb-16 pt-8 sm:px-8`}>
          {isAdmin ? (
            <div className="sheet">
              <Outlet />
            </div>
          ) : (
            <Outlet />
          )}
        </main>
      )}
      <Footer />
    </div>
  )
}
