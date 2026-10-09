import { useEffect } from 'react'
import { SITE_URL } from './config'

/**
 * Sets the page title, and optionally a canonical link and a robots tag, and puts everything back when the
 * person leaves the page. Without this, moving from one page to another inside the app keeps the old title.
 * Pages that are private or only part of a flow (verify, the confirmation, the 404) say "noindex".
 */
export function usePageInfo({ title, canonicalPath, noindex = false }: { title: string; canonicalPath?: string; noindex?: boolean }) {
  useEffect(() => {
    const previousTitle = document.title
    document.title = title
    const undo: (() => void)[] = []

    const ensure = (selector: string, create: () => HTMLElement, attr: string, value: string) => {
      let el = document.head.querySelector<HTMLElement>(selector)
      const created = !el
      if (!el) {
        el = create()
        document.head.appendChild(el)
      }
      const before = el.getAttribute(attr)
      el.setAttribute(attr, value)
      undo.push(() => {
        if (created) el?.remove()
        else if (before === null) el?.removeAttribute(attr)
        else el?.setAttribute(attr, before)
      })
    }

    if (canonicalPath !== undefined) {
      ensure('link[rel="canonical"]', () => Object.assign(document.createElement('link'), { rel: 'canonical' }), 'href', `${SITE_URL}${canonicalPath}`)
    }
    if (noindex) {
      ensure('meta[name="robots"]', () => Object.assign(document.createElement('meta'), { name: 'robots' }), 'content', 'noindex, nofollow')
    }

    return () => {
      document.title = previousTitle
      undo.forEach((fn) => fn())
    }
  }, [title, canonicalPath, noindex])
}
