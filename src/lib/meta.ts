import { useEffect } from 'react'
import { SITE_URL } from './config'

export type PageMeta = {
  title: string
  description: string
  /** "index, follow" only for pages that should appear in search engines. */
  robots: 'index, follow' | 'noindex, follow'
  /** Path on the live site, for example /experts/NEX-000042. */
  path: string
}

type Tag = { selector: string; create: () => HTMLElement; attr: string; value: string }

/** Sets the page title and the basic tags, and puts everything back when the page is left. */
export function usePageMeta(meta: PageMeta) {
  const { title, description, robots, path } = meta
  useEffect(() => {
    const url = `${SITE_URL}${path}`
    const previousTitle = document.title
    document.title = title

    const meta = (attr: 'name' | 'property', key: string, value: string): Tag => ({
      selector: `meta[${attr}="${key}"]`,
      create: () => {
        const el = document.createElement('meta')
        el.setAttribute(attr, key)
        return el
      },
      attr: 'content',
      value,
    })
    const tags: Tag[] = [
      meta('name', 'description', description),
      meta('name', 'robots', robots),
      meta('property', 'og:title', title),
      meta('property', 'og:description', description),
      meta('property', 'og:type', 'profile'),
      meta('property', 'og:url', url),
      meta('property', 'og:site_name', 'NEXUS-E'),
      {
        selector: 'link[rel="canonical"]',
        create: () => {
          const el = document.createElement('link')
          el.setAttribute('rel', 'canonical')
          return el
        },
        attr: 'href',
        value: url,
      },
    ]

    const undo = tags.map((t) => {
      let el = document.head.querySelector<HTMLElement>(t.selector)
      const created = !el
      if (!el) {
        el = t.create()
        document.head.appendChild(el)
      }
      const before = el.getAttribute(t.attr)
      el.setAttribute(t.attr, t.value)
      return () => {
        if (created) el?.remove()
        else if (before === null) el?.removeAttribute(t.attr)
        else el?.setAttribute(t.attr, before)
      }
    })

    return () => {
      document.title = previousTitle
      undo.forEach((fn) => fn())
    }
  }, [title, description, robots, path])
}
