import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ABOUT, AUDIENCE, CTA, DIRECTORY, FAQ, HERO, HERO_HOOKS, HOW, PRIVACY, STEPS, WHY } from './pages/home/content.ts'

// The product is African: the brand name is the African Environmental Expertise Exchange, and nothing visible says Nigerian.
// "Nigeria" stays in the registration form only where it is a real choice (a country and a list of states).

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name)
    return e.isDirectory() ? walk(rel) : [rel]
  })

test('the home page copy and the rotating hero lines never say Nigerian, and name Africa', () => {
  const copy = JSON.stringify({ HERO, HERO_HOOKS, ABOUT, HOW, WHY, AUDIENCE, PRIVACY, DIRECTORY, CTA, STEPS, FAQ })
  assert.doesNotMatch(copy, /nigeria/i)
  assert.match(copy, /Africa/)
  assert.ok(HERO_HOOKS.includes('Where African environmental expertise gets noticed.'))
  assert.equal(ABOUT.title, "Africa's Verified Environmental Experts Registry")
})

test('the logo wordmark, page title, meta and social text, footer and descriptions use the African name', () => {
  assert.match(read('src/components/Logo.tsx'), /African Environmental\n\s*<br \/>\n\s*Expertise Exchange/)
  const index = read('index.html')
  assert.match(index, /<title>NEXUS-E \| African Environmental Expertise Exchange<\/title>/)
  assert.match(index, /name="description" content="Register as an environmental expert on NEXUS-E, the African Environmental Expertise Exchange/)
  assert.match(index, /og:image:alt" content="NEXUS-E, the African Environmental Expertise Exchange\./)
  assert.match(index, /og:description" content="Register once as an environmental professional and be discovered for projects, research and development finance\."/)
  assert.doesNotMatch(index, /nigeria/i)
  const footer = read('src/components/Footer.tsx')
  assert.match(footer, /Africa&rsquo;s Verified Environmental Experts Registry/)
  assert.match(footer, /A brighter Africa/)
  assert.doesNotMatch(footer, /nigeria/i)
  assert.match(read('src/pages/Directory.tsx'), /across Africa/)
  assert.match(read('src/pages/ExpertProfile.tsx'), /the African Environmental Expertise Exchange/)
  assert.match(read('src/pages/Home.tsx'), /African Environmental Expertise Exchange/)
})

test('every email says the African name, and none says Nigerian', () => {
  for (const f of ['supabase/functions/send-confirmation-emails/email.ts', 'supabase/functions/send-confirmation-emails/status-emails.ts', 'supabase/functions/expert-portal/mail.ts']) {
    assert.doesNotMatch(read(f), /nigerian/i, f)
  }
  assert.match(read('supabase/functions/send-confirmation-emails/email.ts'), /African Environmental Expertise Exchange/)
  assert.match(read('supabase/functions/send-confirmation-emails/status-emails.ts'), /African Environmental Expertise Exchange/)
})

test('the admin hint says West Africa Time, which is what the deadline rule really uses (UTC+1)', () => {
  const hint = read('src/pages/admin/OpportunityEdit.tsx')
  assert.match(hint, /West Africa Time \(UTC\+1\)/)
  assert.doesNotMatch(hint, /nigerian/i)
  assert.match(read('src/lib/opportunities.ts'), /3_600_000/, 'one hour ahead of UTC')
})

test('the share image carries the African name', () => {
  assert.match(read('scripts/generate-brand.mjs'), /AFRICAN ENVIRONMENTAL EXPERTISE EXCHANGE/)
  assert.doesNotMatch(read('scripts/generate-brand.mjs'), /NIGERIAN/)
})

test('the word Nigerian appears nowhere visible; Nigeria remains only as a country choice and in internal names', () => {
  const offenders: string[] = []
  for (const f of [...walk('src'), ...walk('public'), 'index.html', ...walk('supabase/functions')].filter((f) => /\.(tsx?|css|html|svg|json)$/.test(f) && !/\.test\./.test(f))) {
    const text = read(f)
    if (/nigerian/i.test(text)) offenders.push(f)
  }
  assert.deepEqual(offenders, [])
})

test('"Benin 2026" stays gone', () => {
  assert.doesNotMatch(read('README.md'), /benin/i)
})
