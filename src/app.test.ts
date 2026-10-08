import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Regression tests about the printed flier: the QR code and the ?src=flier parameter it carries.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const publicFiles = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name)
    if (e.isDirectory()) return e.name === 'admin' ? [] : publicFiles(rel)
    return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : []
  })

test('no public page reads the query string, so ?src=flier changes nothing', () => {
  const offenders = publicFiles('src').filter((f) => /(?<!tab\.)location\.search|useSearchParams|URLSearchParams|window\.location\.href|document\.location/.test(read(f)))
  assert.deepEqual(offenders, [])
})

test('the app has no redirect or route that depends on a src parameter', () => {
  for (const f of publicFiles('src')) assert.ok(!/[?&]src=|\bsrc\s*===?\s*['"]flier/.test(read(f)), f)
})

test('the QR SVG points at the live domain, never localhost or a preview address', () => {
  const svg = read('public/qr/nexus-e-flier-qr.svg')
  assert.ok(svg.includes('https://register.nexuse.org/?src=flier'))
  assert.ok(!/localhost|127\.0\.0\.1|vercel\.app|netlify\.app|pages\.dev/i.test(svg))
})

test('the QR SVG is dark green on white, with a quiet zone of at least 4 modules and no logo', () => {
  const svg = read('public/qr/nexus-e-flier-qr.svg')
  assert.match(svg, /<rect[^>]*fill="#ffffff"/i, 'white background')
  assert.match(svg, /<path fill="#06361e"/i, 'dark green modules')
  assert.ok(!/<image|<text|<circle/.test(svg), 'nothing drawn over the code')
  const total = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1])
  const modules = total - 8 // 4 modules of quiet zone on each side
  assert.ok(modules >= 21 && modules % 4 === 1, `a real QR size, got ${modules}`)
  // The first dark module of the top finder pattern starts exactly at the 4 module margin.
  assert.match(svg, /M4 4h7v1h-7z/)
})

test('the QR PNG is 2000 px with a real alpha channel (transparent background)', () => {
  const png = fs.readFileSync(path.join(root, 'public/qr/nexus-e-flier-qr.png'))
  assert.equal(png.subarray(1, 4).toString(), 'PNG')
  assert.equal(png.readUInt32BE(16), 2000, 'width')
  assert.equal(png.readUInt32BE(20), 2000, 'height')
  assert.equal(png[25], 6, 'colour type 6 means RGBA')
})
