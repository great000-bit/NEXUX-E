// Paste into the browser console (or run through a browser tool) at 360, 390, 768 and 1280 px wide.
// Visits each public route inside the running app, then reports sideways scrolling, controls smaller than
// 44 px, images without alt text, and the heading structure. It reads the page only and changes nothing.
(async () => {
  const routes = ['/', '/register', '/verify', '/experts', '/does-not-exist']
  const wait = (ms) => new Promise((r) => setTimeout(r, ms))
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only, [aria-hidden="true"]')
  }
  const report = {}
  for (const path of routes) {
    history.pushState({}, '', path)
    window.dispatchEvent(new PopStateEvent('popstate'))
    await wait(path === '/' || path === '/experts' ? 3500 : 1800)
    window.scrollTo(0, 0)
    const vw = document.documentElement.clientWidth
    const small = []
    for (const el of document.querySelectorAll('button, a[href], select, textarea, input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), [role=tab]')) {
      if (!visible(el)) continue
      const r = el.getBoundingClientRect()
      const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
      if ((r.height < 43.5 || r.width < 43.5) && !inline) small.push(`${(el.textContent || el.getAttribute('aria-label') || el.id).trim().slice(0, 28)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
    const h = [...document.querySelectorAll('h1,h2,h3,h4')].map((e) => Number(e.tagName[1]))
    let skipped = false
    for (let i = 1; i < h.length; i++) if (h[i] - h[i - 1] > 1) skipped = true
    report[path] = {
      sideways: document.documentElement.scrollWidth > vw + 1,
      h1: h.filter((x) => x === 1).length,
      headingOrderOk: !skipped,
      imagesWithoutAlt: [...document.querySelectorAll('img:not([alt])')].length,
      small: [...new Set(small)],
    }
  }
  return { width: innerWidth, report }
})()
