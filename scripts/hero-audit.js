// Paste into the browser console on the home page at 360, 390, 768 and 1280 px wide (and a few heights).
// Reads the page only. Reports: sideways scroll; any reel whose longest possible text would not fit its window;
// and any floating item (reels, node labels, tagline, scroll cue) that overlaps the headline, subline, buttons or small print.
(() => {
  const POOLS = {
    expertise: ['ESIA and Safeguards', 'Biodiversity and Ecosystems', 'Water and Hydrogeology', 'Geology and Earth Sciences', 'Climate Change and Carbon', 'Social and Economic Studies', 'Gender and Inclusion', 'Pollution and Environmental Quality', 'GIS and Remote Sensing', 'Marine and Blue Economy', 'Environmental Engineering', 'Policy, Governance and Regulation', 'ESG and Sustainability', 'Occupational and Community Health', 'Other Specialised Expertise'],
    hooks: ['Your expertise, verified.', 'Discovered by the people who fund the work.', 'One profile. Many opportunities.', 'Be found. Be verified. Be engaged.', 'Where Nigerian environmental expertise gets noticed.', 'Built for ESIA, safeguards and research.', 'Ready for World Bank, AfDB and DFI projects.', 'Your credentials, in one trusted profile.'],
  }
  const rect = (el) => el.getBoundingClientRect()
  const hit = (a, b, pad = 0) => a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad
  const report = { width: innerWidth, height: innerHeight, sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1, tooLong: [], overlaps: [] }

  // 1. Does the longest text fit every reel window? Measured with the real font.
  const probe = document.createElement('span')
  document.body.appendChild(probe)
  document.querySelectorAll('.reel').forEach((reel) => {
    const item = reel.querySelector('.reel-item')
    const cs = getComputedStyle(item)
    const pool = reel.classList.contains('reel-hook') ? POOLS.hooks : POOLS.expertise
    const chip = reel.classList.contains('reel-chip')
    const icon = item.querySelector('svg') ? 16 + parseFloat(cs.columnGap || 0) : 0
    const avail = reel.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) - icon
    probe.style.cssText = `position:absolute;visibility:hidden;white-space:${chip ? 'normal' : 'nowrap'};font:${cs.font};letter-spacing:${cs.letterSpacing};${chip ? `width:${avail}px` : ''}`
    pool.forEach((t) => {
      probe.textContent = t
      const w = chip ? probe.scrollWidth : probe.getBoundingClientRect().width
      const h = probe.getBoundingClientRect().height
      if ((!chip && w > avail + 0.5) || (chip && h > reel.clientHeight - 6)) report.tooLong.push(`${reel.className.split(' ').pop()} "${t}" ${Math.round(chip ? h : w)} vs ${Math.round(chip ? reel.clientHeight : avail)}`)
    })
  })
  probe.remove()

  // 2. Do the floating items stay clear of the words in the middle?
  const centre = ['.hero-eyebrow', '.hero-title', '.hero-sub', '.hero-actions', '.hero-small'].map((s) => [s, document.querySelector(s)]).filter(([, e]) => e)
  const floating = [...document.querySelectorAll('.reel, .hero-node-sub, .hero-tagline, .hero-cue')]
  floating.forEach((f) => {
    const fr = f.classList.contains('hero-node-sub') ? (() => { const r = document.createRange(); r.selectNodeContents(f); return r.getBoundingClientRect() })() : rect(f)
    if (!fr.width) return
    centre.forEach(([name, c]) => {
      // Use the text box of the headline lines, not the full-width block.
      const boxes = name === '.hero-title' ? [...c.children].map((s) => { const r = document.createRange(); r.selectNodeContents(s); return r.getBoundingClientRect() }) : name === '.hero-sub' || name === '.hero-small' ? (() => { const r = document.createRange(); r.selectNodeContents(c); return [...r.getClientRects()] })() : (name === '.hero-actions' ? [...c.children].map(rect) : [rect(c)])
      boxes.forEach((b) => { if (hit(fr, b, 6)) report.overlaps.push(`${f.className.split(' ').slice(-1)[0] || f.tagName} [${Math.round(fr.left)},${Math.round(fr.top)},${Math.round(fr.right)},${Math.round(fr.bottom)}] touches ${name} [${Math.round(b.left)},${Math.round(b.top)},${Math.round(b.right)},${Math.round(b.bottom)}]`) })
    })
  })
  // And with each other.
  for (let i = 0; i < floating.length; i++) for (let j = i + 1; j < floating.length; j++) {
    const a = floating[i], b = floating[j]
    if (a.contains(b) || b.contains(a)) continue
    if (rect(a).width && rect(b).width && hit(rect(a), rect(b), 4)) report.overlaps.push(`${a.className.split(' ').slice(-1)[0]} touches ${b.className.split(' ').slice(-1)[0]}`)
  }
  report.overlaps = [...new Set(report.overlaps)]
  return report
})()
