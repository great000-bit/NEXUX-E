// Generates the brand files in /public from one vector emblem:
//   logo-mark-light.svg   the emblem lifted for dark backgrounds
//   favicon.svg, favicon-32.png, apple-touch-icon.png   the emblem on a deep green rounded square
//   og-image.png          the 1200 by 630 image shown when the site is shared
// Run with: npm run brand
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = (f) => path.join(root, 'public', f)

// The same shapes as src/components/Logo.tsx. Colours are the dark-background palette.
const emblem = (id) => `
  <defs>
    <linearGradient id="${id}b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6f2d0"/><stop offset="1" stop-color="#9fd0a6"/></linearGradient>
    <linearGradient id="${id}u" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6cc3ff"/><stop offset="1" stop-color="#2b9cf0"/></linearGradient>
    <linearGradient id="${id}l" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#62aa2a"/><stop offset="1" stop-color="#c5dc3f"/></linearGradient>
    <clipPath id="${id}g"><circle cx="82" cy="132" r="31"/></clipPath>
  </defs>
  <path d="M60 98C62 52 100 14 163 4C160 56 122 96 60 98Z" fill="url(#${id}l)"/>
  <path d="M66 94C92 66 122 38 156 10" stroke="#f3fbd3" stroke-width="2.2" stroke-linecap="round" fill="none" opacity=".85"/>
  <path d="M138 78C158 120 146 170 92 206C128 166 136 124 118 92C126 90 132 85 138 78Z" fill="url(#${id}u)"/>
  <path d="M44 100C14 114 2 152 18 182C32 208 66 214 92 206C58 202 34 184 32 154C30 130 36 112 44 100Z" fill="url(#${id}b)"/>
  <circle cx="28" cy="80" r="12" fill="#c5dc3f"/>
  <circle cx="82" cy="132" r="33" fill="#fff"/>
  <circle cx="82" cy="132" r="31" fill="#cfe9f8"/>
  <g clip-path="url(#${id}g)" fill="#1f8a4f">
    <path d="M62 112c8-8 20-8 24-2 3 5-3 9 1 14s-4 10-10 8-6 6-12 4-9-12-3-24Z"/>
    <path d="M92 138c6-4 14-2 18 4s-2 16-10 18-12-8-8-22Z"/>
    <path d="M70 150c6 2 10 8 8 14s-12 6-14-2 0-10 6-12Z"/>
  </g>
  <circle cx="82" cy="132" r="31" fill="none" stroke="#06361e" stroke-width="2.2"/>`

const write = (file, data) => fs.writeFileSync(out(file), data)
const png = (svg, width, opts = {}) => new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: true, defaultFontFamily: 'Segoe UI' }, ...opts }).render().asPng()

// 1. The light mark on its own (transparent background).
const mark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 170 215" role="img" aria-label="NEXUS-E emblem, light version for dark backgrounds">${emblem('m')}</svg>`
write('logo-mark-light.svg', mark)

// 2. The favicon: the emblem on a deep green rounded square, so it reads on any browser theme.
const badge = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">
  <rect width="64" height="64" rx="14" fill="#06361e"/>
  <g transform="translate(13.8 9) scale(0.214)">${emblem('f')}</g>
</svg>`
write('favicon.svg', badge(64))
write('favicon-32.png', png(badge(64), 32))
write('apple-touch-icon.png', png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#06361e"/><g transform="translate(13.8 9) scale(0.214)">${emblem('a')}</g></svg>`, 180))

// 3. The social share image.
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <defs>
    <radialGradient id="ga" cx="0.86" cy="0.02" r="0.62"><stop offset="0" stop-color="#c4e0cd" stop-opacity=".55"/><stop offset=".45" stop-color="#96c2a6" stop-opacity=".2"/><stop offset="1" stop-color="#58886c" stop-opacity="0"/></radialGradient>
    <radialGradient id="gb" cx="0.04" cy="1" r="0.55"><stop offset="0" stop-color="#9ec4b0" stop-opacity=".34"/><stop offset="1" stop-color="#649a7c" stop-opacity="0"/></radialGradient>
    <radialGradient id="gc" cx="0.74" cy="0.64" r="0.3"><stop offset="0" stop-color="#c5dc3f" stop-opacity=".16"/><stop offset="1" stop-color="#78aa5a" stop-opacity="0"/></radialGradient>
    <linearGradient id="gt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset=".55" stop-color="#e4f3c4"/><stop offset="1" stop-color="#c5dc3f"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="#03110a"/>
  <rect width="1200" height="630" fill="url(#ga)"/><rect width="1200" height="630" fill="url(#gb)"/><rect width="1200" height="630" fill="url(#gc)"/>
  <rect x="24" y="24" width="1152" height="582" rx="34" fill="none" stroke="#ffffff" stroke-opacity=".1"/>
  <g transform="translate(76 66) scale(0.27)">${emblem('o')}</g>
  <text x="152" y="108" font-family="Segoe UI" font-weight="700" font-size="46" fill="#ffffff" letter-spacing="-1.5">NEXUS<tspan fill="#c5dc3f">-E</tspan></text>
  <text x="153" y="134" font-family="Segoe UI" font-weight="600" font-size="15" fill="#ffffff" fill-opacity=".72" letter-spacing="2.4">AFRICAN ENVIRONMENTAL EXPERTISE EXCHANGE</text>
  <text x="76" y="318" font-family="Segoe UI" font-weight="600" font-size="86" fill="#ffffff" letter-spacing="-3.2">Don't just be qualified.</text>
  <text x="76" y="418" font-family="Segoe UI" font-weight="600" font-size="86" fill="url(#gt)" letter-spacing="-3.2">Be found.</text>
  <text x="78" y="486" font-family="Segoe UI" font-size="26" fill="#ffffff" fill-opacity=".84">Register once and be discovered for projects, research and development finance.</text>
  <rect x="76" y="528" width="330" height="48" rx="24" fill="#c5dc3f"/>
  <text x="241" y="560" text-anchor="middle" font-family="Segoe UI" font-weight="700" font-size="21" fill="#04140d">Join the founding experts</text>
  <text x="1124" y="560" text-anchor="end" font-family="Segoe UI" font-weight="600" font-size="22" fill="#ffffff" fill-opacity=".78">register.nexuse.org</text>
</svg>`
write('og-image.png', png(og, 1200))

console.log('Brand files written to public/: logo-mark-light.svg, favicon.svg, favicon-32.png, apple-touch-icon.png, og-image.png')
