import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Tests for what visitors can see: no email address on the public site, and a logo-only header in the admin area.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n') // same text on every checkout
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name)
    return e.isDirectory() ? walk(rel) : [rel]
  })

test('no email address appears anywhere in the public site: source, public files or index.html', () => {
  const files = [...walk('src'), ...walk('public'), 'index.html'].filter((f) => !/\.(woff2|png|jpg|ico)$/.test(f))
  const offenders: string[] = []
  for (const f of files) {
    const text = read(f)
    if (/greatemmanwori@gmail/i.test(text)) offenders.push(f)
    // This file talks about the address, so it is the one place that names it.
    if (f.endsWith('publicSurface.test.ts')) continue
    if (/mailto:/i.test(text)) offenders.push(f + ' (mailto)')
  }
  assert.deepEqual(offenders.filter((f) => !f.endsWith('publicSurface.test.ts')), [])
})

test('the footer has no Contact column and no email link, and still shows the developer credit', () => {
  const footer = read('src/components/Footer.tsx')
  assert.doesNotMatch(footer, /Contact<|CONTACT_EMAIL|mailto/)
  assert.match(footer, /Designed and built by Great Emman-Wori/)
  assert.match(footer, /md:grid-cols-\[1\.6fr_1fr\]/, 'two balanced columns on desktop')
  assert.doesNotMatch(read('src/lib/config.ts'), /CONTACT_EMAIL|VITE_CONTACT_EMAIL/)
  assert.doesNotMatch(read('.env.example'), /VITE_CONTACT_EMAIL/)
})

test('on admin routes the header is the logo alone, on the left', () => {
  const nav = read('src/components/Navbar.tsx')
  const adminBranch = nav.slice(nav.indexOf("if (pathname.startsWith('/admin'))"), nav.indexOf('return (\n    <header', nav.indexOf("if (pathname.startsWith('/admin'))") + 40))
  assert.ok(adminBranch.length > 50, 'the admin branch exists')
  assert.match(adminBranch, /<Logo onDark \/>/)
  assert.match(adminBranch, /justify-start/)
  assert.doesNotMatch(adminBranch, /NAV_LINKS|nav-pill|Directory|Verify my profile|shield-check|menu/, 'no pill nav, no shield, no Verify link, no menu button')
  // The public header is unchanged.
  for (const label of ['Directory', 'Verify my profile', 'Register now']) assert.match(nav, new RegExp(label))
  assert.match(nav, /nav-pill glass hidden/)
})
