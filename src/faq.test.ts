import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { en } from './i18n/en.ts'
import path from 'node:path'
import { FAQ, HERO } from './pages/home/content.ts'
import { faqJsonLd, faqJsonLdText } from './lib/faqSchema.ts'

// Tests for the FAQ section, its structured data, and the hero copy that changed with it.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

const COPY: [string, string][] = [
  ['What is NEXUS-E?', 'NEXUS-E is a verified registry of environmental professionals. You register once, build one professional profile, and get verified, so organisations looking for expertise can find you.'],
  ['What are the benefits of registering?', 'You get one verified professional profile that shows your expertise, experience and the areas you can work in. Verified experts can be found by people searching for the right specialist, and can express interest in project opportunities posted on the platform for projects, research and development finance.'],
  ['How do I get found?', 'Once your profile is verified and you have chosen to be listed, it appears in the searchable expert directory. People can search and filter by expertise and location. Keep your profile complete and up to date so the right opportunities match you.'],
  ['Is my profile secure?', 'Yes. Your phone number and email address are never shown publicly. Documents you upload for verification are kept in private storage and are used only to verify you. You sign in with a one-time code sent to your email, and you choose whether your profile is listed in the directory.'],
  ['How does verification work?', 'After you register, you upload supporting evidence of your qualifications and experience. Our team reviews it and your profile moves from Pending to Under review and then to Verified. If we need more evidence, we will tell you what to add.'],
  ['Does NEXUS-E replace professional licensing?', 'No. NEXUS-E does not replace statutory or professional licensing. It confirms your expertise on the registry and helps you be found.'],
]

test('the six questions and answers are exactly the supplied copy, in order, under the right heading', () => {
  assert.equal(FAQ.title, 'Frequently asked questions')
  assert.deepEqual(FAQ.items.map((i) => [i.q, i.a]), COPY)
  assert.doesNotMatch(JSON.stringify(FAQ), /—|–/, 'no em or en dashes')
})

test('the FAQPage structured data matches the visible text, and cannot close its script tag', () => {
  const ld = faqJsonLd(FAQ.items)
  assert.equal(ld['@context'], 'https://schema.org')
  assert.equal(ld['@type'], 'FAQPage')
  assert.equal(ld.mainEntity.length, 6)
  ld.mainEntity.forEach((m, i) => {
    assert.equal(m['@type'], 'Question')
    assert.equal(m.name, COPY[i][0])
    assert.equal(m.acceptedAnswer['@type'], 'Answer')
    assert.equal(m.acceptedAnswer.text, COPY[i][1])
  })
  const text = faqJsonLdText(FAQ.items)
  assert.deepEqual(JSON.parse(text), ld)
  assert.ok(!text.includes('<'))
  // It is added by the home page itself, straight away, from the same data the section renders.
  const home = read('src/pages/Home.tsx')
  assert.match(home, /application\/ld\+json/)
  assert.match(home, /faqJsonLdText\(m\.home\.faq\.items\)/)
  assert.deepEqual(en.home.faq.items, FAQ.items.map(({ q, a }) => ({ q, a })), 'the English dictionary is the same text')
  assert.match(home, /script\.remove\(\)/, 'removed when leaving the home page')
})

test('the section sits between the directory teaser and the closing call to action, and reads the one copy', () => {
  const sections = read('src/pages/home/HomeSections.tsx')
  assert.ok(sections.indexOf('<DirectoryTeaser />') < sections.indexOf('<Faq />'))
  assert.ok(sections.indexOf('<Faq />') < sections.indexOf('<FinalCta />'))
  const faq = read('src/pages/home/Faq.tsx')
  assert.match(faq, /FAQ\.items\.map/)
  assert.doesNotMatch(faq, /What is NEXUS-E\?/, 'no second copy of the text')
})

test('each question is a button wired with aria-expanded and aria-controls, one open at a time, first open', () => {
  const faq = read('src/pages/home/Faq.tsx')
  assert.match(faq, /useState\(0\)/, 'the first item is open by default')
  assert.match(faq, /<button\s[^>]*type="button"/)
  assert.match(faq, /aria-expanded=\{isOpen\}/)
  assert.match(faq, /aria-controls=\{`faq-a-\$\{i\}`\}/)
  assert.match(faq, /id=\{`faq-a-\$\{i\}`\}/)
  assert.match(faq, /aria-labelledby=\{`faq-q-\$\{i\}`\}/)
  assert.match(faq, /aria-hidden=\{!isOpen\}/, 'closed answers are hidden from assistive technology')
  assert.match(faq, /setOpen\(isOpen \? -1 : i\)/, 'a single state value means only one is open')
  assert.match(faq, /\{\.\.\.fadeUp\(i\)\}/, 'a short staggered AOS reveal')
})

test('the styles give 44 px targets, a visible focus ring, the lime accents, and instant motion for reduced motion', () => {
  const css = read('src/pages/home/sections.css')
  const q = css.match(/\.faq-q \{([^}]*)\}/)![1]
  const minH = Number(q.match(/min-height: ([\d.]+)rem/)![1])
  assert.ok(minH * 16 >= 44, 'tap target is ' + minH * 16 + ' px')
  assert.match(css, /\.faq-q:focus-visible \{[^}]*outline: 2px solid/)
  assert.match(css, /\.faq-item::before/)
  assert.match(css, /\.faq-item:hover \{[^}]*rgb\(197 220 63/)
  assert.match(css, /grid-template-rows: 0fr/)
  assert.match(css, /grid-template-rows: 1fr/)
  assert.match(css, /prefers-reduced-motion: reduce\) \{[^}]*\.faq-panel[^}]*transition: none/)
  assert.doesNotMatch(css.slice(css.indexOf('Frequently asked questions')), /backdrop-filter|filter: blur/, 'flat glass, no blur')
})

test('the hero pill and subline are the new copy, and "Benin 2026" is not visible anywhere on the public site', () => {
  assert.equal(HERO.eyebrow, 'Join the founding experts')
  assert.equal(HERO.subline, 'Register once as an environmental professional and be discovered for projects, research and development finance.')
  for (const f of ['src/pages/home/content.ts', 'src/pages/home/HomeSections.tsx', 'src/pages/home/Hero.tsx', 'index.html', 'scripts/generate-brand.mjs']) {
    assert.doesNotMatch(read(f), /benin/i, f)
  }
})
