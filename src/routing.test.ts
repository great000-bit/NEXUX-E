import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const vercel = JSON.parse(read('vercel.json')) as {
  rewrites: { source: string; destination: string }[]
  headers: { source: string; headers: { key: string; value: string }[] }[]
}

/** Does the address get the app shell? Mirrors how the rewrites in vercel.json are written: a path, with :name and :name* parts. */
function rewritten(pathname: string): boolean {
  return vercel.rewrites.some((r) => {
    const re = r.source
      .replace(/:(\w+)\*/g, '.*')
      .replace(/:(\w+)/g, '[^/]+')
    return new RegExp(`^${re}$`).test(pathname)
  })
}

test('every page route of the app is answered with the app shell', () => {
  const app = read('src/App.tsx')
  const paths = [...app.matchAll(/path="([^"]+)"/g)].map((m) => m[1]).filter((p) => p !== '*')
  assert.ok(paths.length >= 6)
  for (const p of paths) {
    const sample = '/' + p.replace(/\/\*$/, '/x').replace(':expertId', 'NEX-000001')
    assert.ok(rewritten(sample), `${sample} has no rewrite`)
  }
  for (const extra of ['/admin', '/admin/opportunities', '/experts/NEX-000123']) assert.ok(rewritten(extra), extra)
})

test('every rewrite uses only the simple pattern forms Vercel accepts (a path, :name, :name*): anything else fails the deployment', () => {
  for (const r of vercel.rewrites) assert.match(r.source, /^(\/[A-Za-z0-9-]+|\/:[A-Za-z]+\*?)+$/, r.source)
})

test('there is no catch-all rewrite, so an unknown address is a real 404, and /api is never rewritten', () => {
  for (const r of vercel.rewrites) {
    assert.doesNotMatch(r.source, /^\/\(\.\*\)$|\(\?!api\/\)/, `catch-all: ${r.source}`)
  }
  for (const unknown of ['/nope', '/api/geo', '/api/anything', '/assets/missing.js', '/register-now']) {
    assert.ok(!rewritten(unknown), `${unknown} must not be answered with the app shell`)
  }
})

test('the build writes dist/404.html, which Vercel serves with a 404 status', () => {
  assert.match(read('package.json'), /"build": "[^"]*node scripts\/postbuild\.mjs"/)
  const script = read('scripts/postbuild.mjs')
  assert.match(script, /index\.html/)
  assert.match(script, /404\.html/)
})

test('the sitemap lists only public pages; robots points at it and keeps private pages out', () => {
  const sitemap = read('public/sitemap.xml')
  const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])
  assert.deepEqual(locs, ['https://register.nexuse.org/', 'https://register.nexuse.org/register', 'https://register.nexuse.org/experts'])
  assert.doesNotMatch(sitemap, /admin|verify|registered/)
  const robots = read('public/robots.txt')
  assert.match(robots, /Sitemap: https:\/\/register\.nexuse\.org\/sitemap\.xml/)
  for (const d of ['/admin', '/verify', '/registered']) assert.match(robots, new RegExp(`Disallow: ${d}`))
})

test('the content security policy is report only, matches what the site loads, and nothing is enforced', () => {
  const all = vercel.headers.flatMap((h) => h.headers)
  assert.ok(all.some((h) => h.key === 'Content-Security-Policy-Report-Only'))
  assert.ok(!all.some((h) => h.key === 'Content-Security-Policy'), 'not enforced yet')
  const csp = all.find((h) => h.key === 'Content-Security-Policy-Report-Only')!.value
  for (const part of ["default-src 'self'", "connect-src 'self' https://*.supabase.co", "object-src 'none'", "frame-ancestors 'none'", "base-uri 'self'"]) {
    assert.ok(csp.includes(part), part)
  }
})

test('the Vite preset is switched off, because its own catch-all would turn every unknown address back into a 200', () => {
  const cfg = JSON.parse(read('vercel.json')) as Record<string, unknown>
  assert.equal(cfg.framework, null)
  assert.equal(cfg.outputDirectory, 'dist')
  assert.equal(cfg.buildCommand, 'npm run build')
})
