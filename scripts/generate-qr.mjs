// Generates the flier QR code as a vector SVG and a 2000px transparent PNG, then decodes both
// to prove they scan. Run with: npm run qr
//
// Spec: error correction H, quiet zone of 4 modules, dark green modules on a white SVG background,
// no logo overlay, production URL only.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { PNG } from 'pngjs'
import jsQR from 'jsqr'
import { Resvg } from '@resvg/resvg-js'

const URL_TO_ENCODE = 'https://register.nexuse.org/?src=flier'
const EXPECTED_HOST = 'register.nexuse.org'
const DARK = '#06361e' // deep green from the flier palette (--color-green-900)
const QUIET = 4 // modules
const PNG_SIZE = 2000
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/qr')

// Safety rails: never ship a QR that points at a dev or preview address.
const host = new URL(URL_TO_ENCODE).hostname
if (host !== EXPECTED_HOST || /localhost|127\.0\.0\.1|vercel\.app|netlify\.app|pages\.dev/i.test(URL_TO_ENCODE)) {
  throw new Error(`Refusing to encode ${URL_TO_ENCODE}`)
}

const qr = QRCode.create(URL_TO_ENCODE, { errorCorrectionLevel: 'H' })
const n = qr.modules.size
const get = (x, y) => qr.modules.data[y * n + x] === 1
const total = n + QUIET * 2

// ---------- SVG: one path, white background, crisp edges ----------
let d = ''
for (let y = 0; y < n; y++) {
  let x = 0
  while (x < n) {
    if (!get(x, y)) { x++; continue }
    let run = 1
    while (x + run < n && get(x + run, y)) run++
    d += `M${x + QUIET} ${y + QUIET}h${run}v1h-${run}z`
    x += run
  }
}
const svg =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" width="${total * 10}" height="${total * 10}" shape-rendering="crispEdges" role="img" aria-label="QR code for ${URL_TO_ENCODE}">\n` +
  `<title>NEXUS-E registration QR code</title>\n` +
  `<rect width="${total}" height="${total}" fill="#ffffff"/>\n` +
  `<path fill="${DARK}" d="${d}"/>\n` +
  `</svg>\n`

// ---------- PNG: transparent background, whole-pixel modules, centred ----------
const scale = Math.floor(PNG_SIZE / total)
const drawn = total * scale
const offset = Math.floor((PNG_SIZE - drawn) / 2)
const png = new PNG({ width: PNG_SIZE, height: PNG_SIZE })
const r = parseInt(DARK.slice(1, 3), 16), g = parseInt(DARK.slice(3, 5), 16), b = parseInt(DARK.slice(5, 7), 16)
for (let my = 0; my < n; my++) {
  for (let mx = 0; mx < n; mx++) {
    if (!get(mx, my)) continue
    const x0 = offset + (mx + QUIET) * scale
    const y0 = offset + (my + QUIET) * scale
    for (let y = y0; y < y0 + scale; y++) {
      for (let x = x0; x < x0 + scale; x++) {
        const i = (y * PNG_SIZE + x) * 4
        png.data[i] = r; png.data[i + 1] = g; png.data[i + 2] = b; png.data[i + 3] = 255
      }
    }
  }
}

fs.mkdirSync(OUT, { recursive: true })
fs.writeFileSync(path.join(OUT, 'nexus-e-flier-qr.svg'), svg)
fs.writeFileSync(path.join(OUT, 'nexus-e-flier-qr.png'), PNG.sync.write(png))

// ---------- Verify: decode both files from disk ----------
function decode(rgba, width, height) {
  return jsQR(new Uint8ClampedArray(rgba), width, height, { inversionAttempts: 'dontInvert' })
}
// Composite the transparent PNG on white, the way it will sit on a printed flier.
const readBack = PNG.sync.read(fs.readFileSync(path.join(OUT, 'nexus-e-flier-qr.png')))
const flat = Buffer.from(readBack.data)
for (let i = 0; i < flat.length; i += 4) {
  const a = flat[i + 3] / 255
  for (let c = 0; c < 3; c++) flat[i + c] = Math.round(flat[i + c] * a + 255 * (1 - a))
  flat[i + 3] = 255
}
const fromPng = decode(flat, readBack.width, readBack.height)
const raster = new Resvg(fs.readFileSync(path.join(OUT, 'nexus-e-flier-qr.svg'), 'utf8'), { fitTo: { mode: 'width', value: 1200 } }).render()
const fromSvg = decode(raster.pixels, raster.width, raster.height)

const report = {
  encoded: URL_TO_ENCODE,
  version: qr.version,
  errorCorrection: 'H',
  modules: n,
  quietZoneModules: QUIET,
  pngSize: `${readBack.width}x${readBack.height}`,
  pngPixelsPerModule: scale,
  pngTransparentCorner: readBack.data[3] === 0,
  decodedFromPng: fromPng?.data ?? null,
  decodedFromSvg: fromSvg?.data ?? null,
}
console.log(JSON.stringify(report, null, 2))

const ok = fromPng?.data === URL_TO_ENCODE && fromSvg?.data === URL_TO_ENCODE && report.pngTransparentCorner
if (!ok) {
  console.error('QR verification FAILED')
  process.exit(1)
}
console.log('QR verification passed')
