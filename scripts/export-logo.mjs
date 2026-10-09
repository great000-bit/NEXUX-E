// Exports the NEXUS-E logo lockup (emblem + wordmark + the two line descriptor) as vector SVG and PNG files.
//
//   node scripts/export-logo.mjs [output folder]        default: C:\NEXUS-E-logo-africa
//
// The lettering is converted to outlines from the site's own fonts (Sora Bold for NEXUS-E, Manrope SemiBold for the
// descriptor), using the same sizes and spacing as the site header (src/components/Logo.tsx), so the files look the same
// on any computer and need no fonts installed. The emblem shapes are the ones in Logo.tsx.
//
// Files written:
//   for-dark-backgrounds    white lettering with the lime accent, transparent background (SVG + PNG at 3000 px wide)
//   for-light-backgrounds   deep green lettering with the blue accent, transparent background (SVG + PNG at 3000 px wide)
//   on-dark-green           the dark version on the brand's deep green (PNG at 3000 px wide)
//   print-one-colour-black  one colour, solid black, transparent background (SVG + PNG at 3000 px wide)
//   print-one-colour-white  one colour, solid white, for printing on dark material (SVG + PNG at 3000 px wide)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { Resvg } from '@resvg/resvg-js'
import wawoff2 from 'wawoff2'

const require = createRequire(import.meta.url)
const fontkit = require('fontkit')
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = process.argv[2] ?? 'C:\\NEXUS-E-logo-africa'
fs.mkdirSync(outDir, { recursive: true })

// ---- fonts: the site's woff2 files, opened as TrueType so the weight axis can be set ----
async function openFont(name) {
  const ttf = await wawoff2.decompress(fs.readFileSync(path.join(root, 'public', 'fonts', name)))
  return fontkit.create(Buffer.from(ttf))
}
const sora = (await openFont('sora-latin.woff2')).getVariation({ wght: 700 })
const manrope = (await openFont('manrope-latin.woff2')).getVariation({ wght: 600 })

/** Lays text out as outlines. Returns the SVG path markup and the width used, including letter spacing. */
function outline(font, text, { size, spacing, x, baseline, fill, opacity }) {
  const run = font.layout(text)
  const scale = size / font.unitsPerEm
  let cursor = x
  let d = ''
  run.glyphs.forEach((g, i) => {
    const pos = run.positions[i]
    const gx = cursor + (pos.xOffset ?? 0) * scale
    d += `<path transform="translate(${gx.toFixed(3)} ${baseline.toFixed(3)}) scale(${scale.toFixed(6)} ${(-scale).toFixed(6)})" d="${g.path.toSVG()}"/>`
    cursor += pos.xAdvance * scale + spacing
  })
  const fillAttr = `fill="${fill}"${opacity ? ` fill-opacity="${opacity}"` : ''}`
  return { svg: `<g ${fillAttr}>${d}</g>`, end: cursor }
}

// Where the baseline sits in a line box of height `line` (the site uses line-height 1).
const baselineIn = (font, size, top, line = size) => {
  const asc = (font.ascent / font.unitsPerEm) * size
  const desc = (-font.descent / font.unitsPerEm) * size
  return top + (line - (asc + desc)) / 2 + asc
}

const EMBLEM_PALETTES = {
  light: { bodyFrom: '#0a663f', bodyTo: '#06361e', blueFrom: '#2a9be6', blueTo: '#0b6fc2', leafFrom: '#0a663f', leafTo: '#1f8a4f', vein: '#a9cf7e', head: '#0a663f', ring: '#0a663f' },
  dark: { bodyFrom: '#e6f2d0', bodyTo: '#9fd0a6', blueFrom: '#6cc3ff', blueTo: '#2b9cf0', leafFrom: '#62aa2a', leafTo: '#c5dc3f', vein: '#f3fbd3', head: '#c5dc3f', ring: '#06361e' },
}
const SHAPES = {
  leaf: 'M60 98C62 52 100 14 163 4C160 56 122 96 60 98Z',
  vein: 'M66 94C92 66 122 38 156 10',
  blue: 'M138 78C158 120 146 170 92 206C128 166 136 124 118 92C126 90 132 85 138 78Z',
  body: 'M44 100C14 114 2 152 18 182C32 208 66 214 92 206C58 202 34 184 32 154C30 130 36 112 44 100Z',
  land: ['M62 112c8-8 20-8 24-2 3 5-3 9 1 14s-4 10-10 8-6 6-12 4-9-12-3-24Z', 'M92 138c6-4 14-2 18 4s-2 16-10 18-12-8-8-22Z', 'M70 150c6 2 10 8 8 14s-12 6-14-2 0-10 6-12Z'],
}

/** The emblem in 170 by 215 units. mono = one flat colour, with the vein and the globe's ocean knocked out. */
function emblem(id, p, mono) {
  const land = SHAPES.land.map((d) => `<path d="${d}"/>`).join('')
  if (mono) {
    return `<defs>
      <mask id="${id}-leafmask" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="215"><rect width="170" height="215" fill="#fff"/><circle cx="82" cy="132" r="33" fill="#000"/><path d="${SHAPES.vein}" stroke="#000" stroke-width="2.6" stroke-linecap="round" fill="none"/></mask>
      <mask id="${id}-cut" maskUnits="userSpaceOnUse" x="0" y="0" width="170" height="215"><rect width="170" height="215" fill="#fff"/><circle cx="82" cy="132" r="33" fill="#000"/></mask>
      <clipPath id="${id}-globe"><circle cx="82" cy="132" r="31"/></clipPath></defs>
      <g fill="${mono}">
        <path d="${SHAPES.leaf}" mask="url(#${id}-leafmask)"/>
        <path d="${SHAPES.blue}" mask="url(#${id}-cut)"/>
        <path d="${SHAPES.body}" mask="url(#${id}-cut)"/>
        <circle cx="28" cy="80" r="12"/>
        <g clip-path="url(#${id}-globe)">${land}</g>
        <circle cx="82" cy="132" r="31" fill="none" stroke="${mono}" stroke-width="2.4"/>
      </g>`
  }
  return `<defs>
    <linearGradient id="${id}-body" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${p.bodyFrom}"/><stop offset="1" stop-color="${p.bodyTo}"/></linearGradient>
    <linearGradient id="${id}-blue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.blueFrom}"/><stop offset="1" stop-color="${p.blueTo}"/></linearGradient>
    <linearGradient id="${id}-leaf" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${p.leafFrom}"/><stop offset="1" stop-color="${p.leafTo}"/></linearGradient>
    <clipPath id="${id}-globe"><circle cx="82" cy="132" r="31"/></clipPath></defs>
    <path d="${SHAPES.leaf}" fill="url(#${id}-leaf)"/>
    <path d="${SHAPES.vein}" stroke="${p.vein}" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/>
    <path d="${SHAPES.blue}" fill="url(#${id}-blue)"/>
    <path d="${SHAPES.body}" fill="url(#${id}-body)"/>
    <circle cx="28" cy="80" r="12" fill="${p.head}"/>
    <circle cx="82" cy="132" r="33" fill="#fff"/>
    <circle cx="82" cy="132" r="31" fill="#cfe9f8"/>
    <g clip-path="url(#${id}-globe)" fill="#1f8a4f">${land}</g>
    <circle cx="82" cy="132" r="31" fill="none" stroke="${p.ring}" stroke-width="2.2"/>`
}

const LINES = ['AFRICAN ENVIRONMENTAL', 'EXPERTISE EXCHANGE']

/** The lockup, laid out exactly like the site header: emblem 48 high, 12 gap, wordmark 27.2, descriptor 9.28. */
function lockup({ id, palette, mono, colors, margin, background }) {
  const EH = 48
  const ES = EH / 215
  const EW = 170 * ES
  const gap = 12
  const tx = EW + gap
  const W = 27.2
  const wLS = -0.04 * W
  const SUB = 9.28
  const subLS = 0.14 * SUB
  const blockH = W + 4 + SUB * 2
  const total = Math.max(EH, blockH)

  const wBase = baselineIn(sora, W, 0)
  const nexus = outline(sora, 'NEXUS', { size: W, spacing: wLS, x: tx, baseline: wBase, fill: colors.name })
  const dashE = outline(sora, '-E', { size: W, spacing: wLS, x: nexus.end, baseline: wBase, fill: colors.accent })
  const tmSize = 8
  const tm = outline(sora, 'TM', { size: tmSize, spacing: wLS, x: dashE.end + 2, baseline: baselineIn(sora, tmSize, 0), fill: colors.tm, opacity: colors.tmOpacity })
  const subTop = W + 4
  const l1 = outline(manrope, LINES[0], { size: SUB, spacing: subLS, x: tx, baseline: baselineIn(manrope, SUB, subTop), fill: colors.sub, opacity: colors.subOpacity })
  const l2 = outline(manrope, LINES[1], { size: SUB, spacing: subLS, x: tx, baseline: baselineIn(manrope, SUB, subTop + SUB), fill: colors.sub, opacity: colors.subOpacity })
  const contentW = Math.max(tm.end, l1.end - subLS, l2.end - subLS)

  const vbW = contentW + margin * 2
  const vbH = total + margin * 2
  const emblemY = (total - EH) / 2
  const bg = background ? `<rect x="${-margin}" y="${-margin}" width="${vbW}" height="${vbH}" fill="${background}"/>` : ''
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-margin} ${-margin} ${vbW.toFixed(3)} ${vbH.toFixed(3)}" width="${vbW.toFixed(1)}" height="${vbH.toFixed(1)}" role="img" aria-label="NEXUS-E, African Environmental Expertise Exchange">
  <title>NEXUS-E, African Environmental Expertise Exchange</title>
  ${bg}
  <g transform="translate(0 ${emblemY.toFixed(3)}) scale(${ES.toFixed(6)})">${emblem(id, palette, mono)}</g>
  ${nexus.svg}${dashE.svg}${tm.svg}${l1.svg}${l2.svg}
</svg>
`
  return { svg, width: vbW, height: vbH }
}

const variants = [
  { name: 'for-dark-backgrounds', id: 'd', palette: EMBLEM_PALETTES.dark, colors: { name: '#ffffff', accent: '#c5dc3f', tm: '#ffffff', tmOpacity: 0.7, sub: '#ffffff', subOpacity: 0.7 }, margin: 6, png: true },
  { name: 'for-light-backgrounds', id: 'l', palette: EMBLEM_PALETTES.light, colors: { name: '#06361e', accent: '#0b7cd0', tm: '#0b4a2a', sub: '#5a695f' }, margin: 6, png: true },
  { name: 'on-dark-green', id: 'g', palette: EMBLEM_PALETTES.dark, colors: { name: '#ffffff', accent: '#c5dc3f', tm: '#ffffff', tmOpacity: 0.7, sub: '#ffffff', subOpacity: 0.7 }, margin: 26, background: '#06361e', png: true, svg: false },
  { name: 'print-one-colour-black', id: 'k', mono: '#000000', colors: { name: '#000000', accent: '#000000', tm: '#000000', sub: '#000000' }, margin: 6, png: true },
  { name: 'print-one-colour-white', id: 'w', mono: '#ffffff', colors: { name: '#ffffff', accent: '#ffffff', tm: '#ffffff', sub: '#ffffff' }, margin: 6, png: true },
]

for (const v of variants) {
  const { svg } = lockup(v)
  const base = path.join(outDir, `nexus-e-african-logo-${v.name}`)
  if (v.svg !== false) fs.writeFileSync(`${base}.svg`, svg)
  if (v.png) fs.writeFileSync(`${base}.png`, new Resvg(svg, { fitTo: { mode: 'width', value: 3000 } }).render().asPng())
}

fs.writeFileSync(
  path.join(outDir, 'READ-ME.txt'),
  [
    'NEXUS-E logo, African Environmental Expertise Exchange',
    '',
    'The emblem (leaf and globe) and the NEXUS-E lettering are unchanged. Only the second line changed, from',
    'NIGERIAN ENVIRONMENTAL EXPERTISE EXCHANGE to AFRICAN ENVIRONMENTAL EXPERTISE EXCHANGE.',
    '',
    'nexus-e-african-logo-for-dark-backgrounds   .svg and .png (transparent, 3000 px wide): white lettering, lime accent',
    'nexus-e-african-logo-for-light-backgrounds  .svg and .png (transparent, 3000 px wide): deep green lettering, blue accent',
    'nexus-e-african-logo-on-dark-green          .png (3000 px wide) on the deep green #06361e',
    'nexus-e-african-logo-print-one-colour-black .svg and .png (transparent, 3000 px wide): one solid colour for print',
    'nexus-e-african-logo-print-one-colour-white .svg and .png (transparent, 3000 px wide): one solid colour on dark material',
    '',
    'The SVG files contain the lettering as outlines, so they need no fonts installed.',
    '',
  ].join('\r\n'),
)
console.log('Logo files written to', outDir)
for (const f of fs.readdirSync(outDir)) console.log(' ', f, `${Math.round(fs.statSync(path.join(outDir, f)).size / 1024)} KB`)
