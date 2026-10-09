import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { ABOUT, AUDIENCE, CTA, DIRECTORY, FAQ, HERO, HERO_HOOKS, HOW, PRIVACY, STEPS, WHY } from './pages/home/content.ts'

// The product reaches beyond Nigeria, so the public copy is neutral. The brand name and a few fields keep the word.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

test('the home page copy and the rotating hero lines do not say Nigeria or Nigerian', () => {
  const copy = JSON.stringify({ HERO, HERO_HOOKS, ABOUT, HOW, WHY, AUDIENCE, PRIVACY, DIRECTORY, CTA, STEPS, FAQ })
  assert.doesNotMatch(copy, /nigeria/i)
})

test('the page title, meta description, social text, footer and directory and profile descriptions are neutral', () => {
  const index = read('index.html')
  const head = index.replace(/<meta property="og:image:alt"[^>]*>/, '') // the image text carries the brand name
  assert.doesNotMatch(head, /nigeria/i)
  assert.match(index, /<title>NEXUS-E \| Verified Registry of Environmental Experts<\/title>/)
  assert.match(index, /og:description" content="Register once as an environmental professional and be discovered for projects, research and development finance\."/)
  assert.doesNotMatch(read('src/pages/Home.tsx'), /nigeria/i)
  assert.doesNotMatch(read('src/components/Footer.tsx'), /nigeria/i)
  assert.doesNotMatch(read('src/pages/Directory.tsx'), /nigeria/i)
  assert.doesNotMatch(read('src/pages/ExpertProfile.tsx'), /nigeria/i)
})

test('what keeps the word: the brand wordmark, the Outside Nigeria and Nigeria form options, the admin hint', () => {
  assert.match(read('src/components/Logo.tsx'), /Nigerian Environmental/)
  const options = read('src/lib/options.ts')
  assert.match(options, /'Outside Nigeria'/)
  assert.match(options, /AVAILABILITY = \['State only', 'Nigeria'/)
  assert.match(read('src/pages/admin/OpportunityEdit.tsx'), /Nigerian time/)
})

test('"Benin 2026" is gone from the README as well', () => {
  assert.doesNotMatch(read('README.md'), /benin/i)
})
