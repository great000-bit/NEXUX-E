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

// The directory keeps its search filters in the address bar. It is the only public page that does, and it
// reads a fixed list of known keys (see the next test), so ?src=flier still changes nothing.
// rest.ts only builds the address of a database call; it never looks at the page's own query string.
const READS_ITS_OWN_FILTERS = [path.join('src', 'pages', 'Directory.tsx'), path.join('src', 'lib', 'directoryFilters.ts'), path.join('src', 'lib', 'rest.ts')]

test('no public page reads the query string, so ?src=flier changes nothing', () => {
  const offenders = publicFiles('src')
    .filter((f) => !READS_ITS_OWN_FILTERS.includes(f))
    .filter((f) => /(?<!tab\.)location\.search|useSearchParams|URLSearchParams|window\.location\.href|document\.location/.test(read(f)))
  assert.deepEqual(offenders, [])
})

test('the directory only reads its own filter keys, so ?src=flier (or anything else) changes nothing there either', async () => {
  const { filtersFromParams, EMPTY_FILTERS } = await import('./lib/directoryFilters.ts')
  assert.deepEqual(filtersFromParams(new URLSearchParams('src=flier')), EMPTY_FILTERS)
  assert.deepEqual(filtersFromParams(new URLSearchParams('src=flier&utm_source=print&ref=qr')), EMPTY_FILTERS)
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

test('the directory pages are lazy loaded, so the registration bundle does not grow with the database client', () => {
  const app = read('src/App.tsx')
  assert.doesNotMatch(app, /^import (Directory|ExpertProfile) from/m)
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/Directory'\)\)/)
  assert.match(app, /lazy\(\(\) => import\('\.\/pages\/ExpertProfile'\)\)/)
  for (const f of ['src/pages/Register.tsx', 'src/pages/Registered.tsx', 'src/pages/Home.tsx']) {
    assert.doesNotMatch(read(f), /lib\/directory|lib\/supabase/, f)
  }
})

// Regression tests for the admin screens at phone width (360 px) and the detail drawer.

test('the registration detail drawer clears its own state on close, so it can be opened again', () => {
  const src = read('src/pages/admin/Dashboard.tsx')
  assert.match(src, /const closeNow = \(\) => \{\s*ref\.current\?\.close\(\)\s*onClose\(\)\s*\}/)
  assert.match(src, /onClick=\{closeNow\}/, 'the Close button uses it')
})

test('admin detail rows stack on phones and sit in two columns from the sm breakpoint', () => {
  for (const file of ['src/pages/admin/Dashboard.tsx', 'src/pages/admin/Review.tsx']) {
    const src = read(file)
    assert.match(src, /grid-cols-1[^"]*sm:grid-cols-\[9rem_1fr\]/, file)
    assert.match(src, /min-w-0 break-words/, `${file}: long values such as emails must wrap`)
  }
})

test('the review screen cards can shrink, so a long email never makes the page scroll sideways', () => {
  const src = read('src/pages/admin/Review.tsx')
  assert.ok((src.match(/card min-w-0/g) ?? []).length >= 2)
})

test('admin tabs, sign out and file buttons have comfortable tap targets', () => {
  const area = read('src/pages/admin/AdminArea.tsx')
  assert.match(area, /min-h-11/)
  assert.match(area, /whitespace-nowrap/)
  assert.match(read('src/pages/admin/Review.tsx'), /min-h-12 w-full/)
})

test('the daily retention job also removes stored files that no record points to', () => {
  const fn = read('supabase/functions/verification-admin/index.ts')
  assert.match(fn, /system_orphan_files/)
  const sql = read('supabase/migrations/20261010000002_orphan_files.sql')
  assert.match(sql, /f\.state <> 'deleted'/, 'a file still counts when any live record uses it')
  assert.match(sql, /grant execute on function public\.system_orphan_files\(\) to service_role/)
  assert.match(sql, /revoke all on function public\.system_orphan_files\(\) from public, anon, authenticated/)
})
