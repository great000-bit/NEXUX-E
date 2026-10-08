import { lazy, Suspense, useEffect, useState } from 'react'
import Hero from './home/Hero'

// Everything below the first screen loads after the hero has painted, so the headline is never held up.
const HomeSections = lazy(() => import('./home/HomeSections'))

export default function Home() {
  const [below, setBelow] = useState(false)

  useEffect(() => {
    document.title = 'NEXUS-E | Nigerian Environmental Expertise Exchange'
    // After the first paint, or sooner if the person starts to scroll or follow a link to a section.
    const start = () => setBelow(true)
    // Older browsers have no requestIdleCallback, so fall back to a short timer.
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const useIdle = typeof w.requestIdleCallback === 'function'
    const id = useIdle ? w.requestIdleCallback!(start, { timeout: 1500 }) : window.setTimeout(start, 700)
    window.addEventListener('scroll', start, { once: true, passive: true })
    return () => {
      if (useIdle) w.cancelIdleCallback?.(id)
      else window.clearTimeout(id)
      window.removeEventListener('scroll', start)
    }
  }, [])

  return (
    <>
      <Hero />
      {below ? (
        <Suspense fallback={<div className="min-h-[60vh]" aria-hidden="true" />}>
          <HomeSections />
        </Suspense>
      ) : (
        <div className="min-h-[60vh]" aria-hidden="true" />
      )}
    </>
  )
}
