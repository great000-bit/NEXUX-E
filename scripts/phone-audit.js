// Paste into the browser console on any page, with the window about 360 px wide.
// Reports sideways scrolling and tap targets that are too small to hit comfortably.
(() => {
  const vw = document.documentElement.clientWidth
  const out = { viewport: vw, pageScrollsSideways: document.documentElement.scrollWidth > vw + 1, overflowing: [], smallTargets: [] }
  const visible = (el) => {
    const r = el.getBoundingClientRect()
    const cs = getComputedStyle(el)
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !el.closest('.sr-only')
  }
  for (const el of document.querySelectorAll('body *')) {
    if (!visible(el)) continue
    if (el.getBoundingClientRect().right > vw + 1) {
      out.overflowing.push(el.tagName.toLowerCase())
      if (out.overflowing.length > 8) break
    }
  }
  const targets = 'button, a[href], input:not([type=hidden]):not([type=file]), select, textarea, label.choice, [role=tab]'
  for (const el of document.querySelectorAll(targets)) {
    if (!visible(el)) continue
    if (el.tagName === 'INPUT' && ['checkbox', 'radio'].includes(el.type)) continue
    const r = el.getBoundingClientRect()
    const inline = el.tagName === 'A' && getComputedStyle(el).display === 'inline'
    if ((r.height < 40 || r.width < 40) && !inline) {
      out.smallTargets.push(`${(el.textContent || el.id).trim().slice(0, 24)} ${Math.round(r.width)}x${Math.round(r.height)}`)
    }
  }
  out.smallTargets = [...new Set(out.smallTargets)]
  console.log(out)
  return out
})()
