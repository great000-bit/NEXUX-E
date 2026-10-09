import '../i18n/enSite'
import { lazy, Suspense, useEffect, useState } from 'react'
import { faqJsonLdText } from '../lib/faqSchema'
import { usePageInfo } from '../lib/pageInfo'
import Hero from './home/Hero'
import { useI18n } from '../i18n/I18nProvider'

// Everything below the first screen loads after the hero has painted, so the headline is never held up.
const HomeSections = lazy(() => import('./home/HomeSections'))

export default function Home() {
  const [below, setBelow] = useState(false)
  const { locale, m } = useI18n()
  // The canonical address is the bare home page, so a link with a tracking parameter (the QR code) counts as the same page.
  usePageInfo({ title: m.home.pageTitle, canonicalPath: '/' })

  // FAQPage structured data for the questions further down the page. Added now, so a crawler does not have to scroll.
  useEffect(() => {
    const script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'faq-jsonld'
    script.text = faqJsonLdText(m.home.faq.items)
    document.head.appendChild(script)
    return () => script.remove()
  }, [m])

  useEffect(() => {
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
      {/* The key remounts the hero when the language changes, so its rolling lines start fresh in the new language. */}
      <Hero key={locale} />
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
