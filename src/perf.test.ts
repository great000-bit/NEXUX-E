import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Speed rules for the public pages: no heavy client on the directory, early chunk and connection hints, stable height.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

test('the public directory and profile talk to the database with plain fetch, not the Supabase client', () => {
  const dir = read('src/lib/directory.ts')
  assert.doesNotMatch(dir, /from '\.\/supabase'|@supabase\/supabase-js/)
  assert.match(dir, /publicRpc\('directory_search'/)
  assert.match(dir, /publicRpc\('directory_profile'/)
  const rest = read('src/lib/rest.ts')
  assert.match(rest, /AbortController/)
  assert.match(rest, /catch \{\n\s+return \{ ok: false \}/, 'a failure is a result, never a thrown error')
  // Only the admin area still loads the full client.
  for (const f of ['src/pages/Directory.tsx', 'src/pages/ExpertProfile.tsx', 'src/pages/home/HomeSections.tsx', 'src/pages/home/Hero.tsx', 'src/pages/Register.tsx', 'src/pages/Verify.tsx']) {
    assert.doesNotMatch(read(f), /lib\/supabase'/, f)
  }
})

test('the build starts the home, directory and profile chunks from the HTML, and opens the database connection early', () => {
  const cfg = read('vite.config.ts')
  for (const file of ['/src/pages/Home.tsx', '/src/pages/Directory.tsx', '/src/pages/ExpertProfile.tsx']) assert.ok(cfg.includes(file), file)
  assert.match(cfg, /preconnectDatabase\(\)/)
  assert.match(cfg, /rel: 'preconnect'/)
  assert.match(cfg, /config\.env\.VITE_SUPABASE_URL/, 'the address comes from the build environment, so staging never names production')
})

test('every state of the profile page holds a minimum height, so the footer never jumps when the answer arrives', () => {
  const p = read('src/pages/ExpertProfile.tsx')
  assert.match(p, /function Frame[\s\S]*min-h-\[85svh\]/)
  assert.equal((p.match(/<Frame>/g) ?? []).length, 4, 'loading, error, not found and found are all framed')
})

test('the long-lived font and asset files are cached for a year and nothing else is', () => {
  const v = JSON.parse(read('vercel.json')) as { headers?: { source: string; headers: { key: string; value: string }[] }[] }
  const long = (v.headers ?? []).filter((h) => h.headers.some((x) => /immutable/.test(x.value))).map((h) => h.source)
  assert.deepEqual(long.sort(), ['/assets/(.*)', '/fonts/(.*)'].sort())
})

test('page titles follow the page, private flows say noindex, and the home and register pages name their canonical address', () => {
  const hook = read('src/lib/pageInfo.ts')
  assert.match(hook, /document\.title = previousTitle/)
  assert.match(hook, /noindex, nofollow/)
  for (const f of ['src/pages/Verify.tsx', 'src/pages/VerifyDashboard.tsx', 'src/pages/Registered.tsx', 'src/pages/NotFound.tsx']) {
    assert.match(read(f), /usePageInfo\(\{[^}]*noindex: true/, f + ' is noindex')
  }
  assert.match(read('src/pages/Home.tsx'), /canonicalPath: '\/'/)
  assert.match(read('src/pages/Register.tsx'), /canonicalPath: '\/register'/)
  assert.match(read('src/pages/Register.tsx'), /title: 'Register as an expert \| NEXUS-E'/)
  // The hero's corner labels are links, so they are 44 px tall.
  assert.match(read('src/pages/home/home.css'), /\.reel-node \{ --reel-h: 2\.75rem; \}/)
})
