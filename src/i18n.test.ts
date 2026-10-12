import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { en } from './i18n/en.ts'
import { fr } from './i18n/fr.ts'
import { ar } from './i18n/ar.ts'
import { pt } from './i18n/pt.ts'
import { fmt } from './i18n/types.ts'
import { withEnglishFallback } from './i18n/fallback.ts'
import { DEFAULT_LOCALE, LOCALES, localeInfo, PLANNED_LANGUAGES } from './i18n/locales.ts'
import { COUNTRIES } from './lib/countries.ts'
import { EXPERTISE, ASSIGNMENTS, QUALIFICATIONS, YEARS, MEMBERSHIPS } from './lib/options.ts'

// The dictionaries are typed against English, so the compiler already rejects a missing key. These tests also check
// what types cannot: list lengths, placeholders, dashes, and text that was left in English by mistake.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const walk = (dir: string): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))

/** Every string in a dictionary, keyed by its path (lists by position). */
function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value }
  if (Array.isArray(value)) return Object.assign({}, ...value.map((v, i) => flatten(v, `${prefix}[${i}]`)))
  if (value && typeof value === 'object') {
    return Object.assign({}, ...Object.entries(value).map(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k)))
  }
  return {}
}

const EN = flatten(en)
const OTHERS = { fr: flatten(fr), ar: flatten(ar), pt: flatten(pt) }
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

test('every language has exactly the same keys and list lengths as English', () => {
  for (const [code, dict] of Object.entries(OTHERS)) {
    assert.deepEqual(Object.keys(dict).sort(), Object.keys(EN).sort(), code)
  }
})

test('placeholders such as {n} survive translation, and no text is empty', () => {
  for (const [code, dict] of Object.entries(OTHERS)) {
    for (const [key, text] of Object.entries(dict)) {
      assert.ok(text.trim().length > 0, `${code} ${key} is empty`)
      assert.equal(placeholders(text), placeholders(EN[key]), `${code} ${key}: placeholders differ from English`)
    }
  }
})

test('no dashes in any language, as everywhere else on the site', () => {
  const bad = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`)
  for (const [code, dict] of Object.entries({ en: EN, ...OTHERS })) {
    for (const [key, text] of Object.entries(dict)) assert.ok(!bad.test(text), `${code} ${key}`)
  }
})

test('nothing visible says Nigerian in any language', () => {
  for (const [code, dict] of Object.entries({ en: EN, ...OTHERS })) {
    for (const [key, text] of Object.entries(dict)) assert.doesNotMatch(text, /nigerian|nig[ée]rian|nigeriano/i, `${code} ${key}`)
  }
})

test('long texts were really translated, not left in English', () => {
  for (const [code, dict] of Object.entries(OTHERS)) {
    for (const [key, text] of Object.entries(dict)) {
      if (key.startsWith('meta.')) continue
      if (EN[key].length > 25 && text === EN[key]) assert.fail(`${code} ${key} is still English`)
    }
  }
})

test('Arabic is Arabic: every long text has Arabic letters in it', () => {
  for (const [key, text] of Object.entries(OTHERS.ar)) {
    if (key.startsWith('meta.') || EN[key].length < 25) continue
    assert.match(text, /[\u0600-\u06FF]/, key)
  }
})

test('the translated option labels cover every stored value', () => {
  const groups: [keyof typeof en.options, readonly string[]][] = [
    ['expertise', EXPERTISE], ['assignments', ASSIGNMENTS], ['qualifications', QUALIFICATIONS], ['years', YEARS],
    ['memberships', MEMBERSHIPS], ['countries', COUNTRIES],
  ]
  for (const dict of [en, fr, ar, pt]) {
    for (const [group, values] of groups) {
      assert.deepEqual(Object.keys(dict.options[group]).sort(), [...values].sort(), `${dict.meta.code} ${group}`)
    }
  }
})

test('the registry carries each language: name, own name, direction and font; Arabic is right to left with its own font', () => {
  assert.deepEqual(LOCALES.map((l) => l.code), ['en', 'fr', 'ar', 'pt'])
  assert.equal(DEFAULT_LOCALE, 'en')
  for (const l of LOCALES) {
    assert.ok(l.name && l.native, l.code)
    assert.ok(l.dir === 'ltr' || l.dir === 'rtl')
    assert.ok(l.font === 'latin' || l.font === 'arabic')
  }
  assert.equal(localeInfo('ar').dir, 'rtl')
  assert.equal(localeInfo('ar').font, 'arabic')
  assert.equal(localeInfo('ar').native, 'العربية')
  assert.deepEqual(['fr', 'pt', 'en'].map((c) => localeInfo(c as 'fr').dir), ['ltr', 'ltr', 'ltr'])
  // The later tiers are known by name, so adding one is a new file, not a redesign.
  const later = ['sw', 'am', 'ha', 'yo', 'ig', 'zu', 'xh', 'af', 'so', 'om', 'mg', 'rw', 'sn', 'ti', 'rn', 'tn', 'st', 'ny', 'wo', 'ln', 'es']
  for (const code of later) assert.ok(PLANNED_LANGUAGES.some((p) => p.code === code), code)
})

test('fmt fills placeholders and leaves unknown ones visible', () => {
  assert.equal(fmt('Step {n} of {total}', { n: 2, total: 3 }), 'Step 2 of 3')
  assert.equal(fmt('Hello {name}', {}), 'Hello {name}')
})

test('per-key English fallback: a missing or empty text, and a list of the wrong length, fall back to English', () => {
  const base = { a: 'one', b: { c: 'two', d: ['x', 'y'] }, e: [{ q: 'q1' }, { q: 'q2' }] }
  assert.deepEqual(withEnglishFallback(base, {}), base)
  assert.deepEqual(withEnglishFallback(base, { a: 'uno', b: { c: '' } }), { ...base, a: 'uno' })
  assert.deepEqual(withEnglishFallback(base, { b: { d: ['solo'] } }), base, 'half a list is not used')
  assert.deepEqual(withEnglishFallback(base, { b: { d: ['u', 'v'] }, e: [{ q: 'Q1' }, { q: 'Q2' }] }), { a: 'one', b: { c: 'two', d: ['u', 'v'] }, e: [{ q: 'Q1' }, { q: 'Q2' }] })
  assert.deepEqual(withEnglishFallback(base, null), base)
})

test('only English is bundled with the page: every other language loads on demand, and the Arabic font only for Arabic', () => {
  const index = read('src/i18n/index.ts')
  for (const code of ['fr', 'ar', 'pt']) assert.match(index, new RegExp(`import\\('\\./${code}'\\)`), code)
  assert.doesNotMatch(index, /^import .* from '\.\/(fr|ar|pt)'/m)
  for (const f of walk('src').filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
    if (f.endsWith(path.join('i18n', 'index.ts'))) continue
    assert.doesNotMatch(read(f), /from '(\.\.?\/)+(i18n\/)?(fr|ar|pt)'/, f)
    if (!f.endsWith(path.join('i18n', 'fonts.ts'))) assert.doesNotMatch(read(f), /@fontsource/, `${f}: the Arabic font is loaded only by fonts.ts`)
  }
  const fonts = read('src/i18n/fonts.ts')
  assert.match(fonts, /if \(font === 'arabic'\)/)
  assert.match(fonts, /import\('@fontsource\/noto-sans-arabic\/arabic-400\.css'\)/)
  assert.doesNotMatch(fonts, /^import .*fontsource/m)
})

test('the page follows the language: lang and dir are set, the admin area stays English, a pick is saved, detection never overrides it', () => {
  const p = read('src/i18n/I18nProvider.tsx')
  assert.match(p, /root\.lang = effective/)
  assert.match(p, /root\.dir = info\.dir/)
  assert.match(p, /const effective: LocaleCode = isAdmin \? 'en' : locale/)
  assert.match(p, /storeLocale\(code\)/)
  assert.match(p, /picked\.current = true/)
  assert.match(p, /if \(!live \|\| picked\.current \|\| code === DEFAULT_LOCALE\) return/)
  // Detection never saves anything: only a visitor's own pick is stored.
  assert.equal((p.match(/storeLocale\(/g) ?? []).length, 1)
  assert.doesNotMatch(read('src/i18n/index.ts'), /storeLocale\(d\.|storeLocale\(start/)
  // Storage reads and writes are guarded.
  const core = read('src/i18n/index.ts')
  assert.match(core, /try \{\n\s+const v = localStorage\.getItem/)
  assert.match(core, /try \{\n\s+localStorage\.setItem/)
})

test('there is a permanent picker in the header, a labelled native select', () => {
  const picker = read('src/components/LanguagePicker.tsx')
  assert.match(picker, /<select/)
  assert.match(picker, /sr-only/)
  assert.match(picker, /lang=\{l\.code\}/)
  assert.match(picker, /LOCALES\.map/)
  assert.match(read('src/components/Navbar.tsx'), /<LanguagePicker/)
  assert.match(read('src/main.tsx'), /initI18n\(\)\.then/)
})

test('no popup, no banner: nothing asks the visitor which language they want', () => {
  for (const f of ['src/i18n/I18nProvider.tsx', 'src/i18n/index.ts', 'src/main.tsx', 'src/App.tsx', 'src/components/Layout.tsx']) {
    assert.doesNotMatch(read(f), /role="dialog"|FirstVisitPrompt|aria-modal/, f)
  }
})

test('right to left: public pages use logical (start and end) positions, and Arabic has its own rules', () => {
  const physical = /["' ](pl|pr|ml|mr|left|right|text-left|text-right|rounded-l|rounded-r|border-l|border-r|space-x)-[a-z0-9[\]./%]+/
  for (const f of walk('src').filter((f) => /\.tsx$/.test(f) && !/admin/.test(f) && !/\.test\./.test(f))) {
    const lines = read(f).split('\n').filter((l) => /className=/.test(l))
    for (const line of lines) assert.doesNotMatch(line, physical, `${f}: ${line.trim().slice(0, 90)}`)
  }
  const css = read('src/index.css')
  assert.match(css, /html\[lang='ar'\] \{/)
  assert.match(css, /Noto Sans Arabic/)
  assert.match(css, /\[dir='rtl'\] input\[type='email'\]/)
  assert.match(css, /\[dir='rtl'\] svg\[data-flip\]/)
  assert.match(read('src/components/icons.tsx'), /data-flip=\{name === 'arrow-right'/)
  assert.match(read('src/pages/Registered.tsx'), /id="expert-id"\n\s+dir="ltr"/)
  // Home page styles use inline start and end for anything that sits at one side.
  const home = read('src/pages/home/home.css') + read('src/pages/home/sections.css')
  assert.match(home, /\.hero-cue \{ position: absolute; inset-inline-start/)
  assert.match(home, /\.hero-tagline \{ position: absolute; inset-inline-end/)
})

test('the registration page does not carry the home page words: the site half of English is loaded only by the pages that read it', () => {
  const core = read('src/i18n/enCore.ts')
  assert.doesNotMatch(core, /pages\/home\/content/)
  for (const key of ['hero', 'home', 'verify', 'dashboard', 'files', 'portal', 'directory', 'profile']) {
    assert.doesNotMatch(core, new RegExp(`^  ${key}: `, 'm'), `${key} belongs to the site half`)
    assert.match(read('src/i18n/enSite.ts'), new RegExp(`^  ${key}: `, 'm'), key)
  }
  for (const page of ['Home', 'Directory', 'ExpertProfile', 'Verify', 'VerifyDashboard', 'admin/Admin']) {
    assert.match(read(`src/pages/${page}.tsx`), /i18n\/enSite/, `${page} loads the site half`)
  }
  const app = read('src/App.tsx')
  assert.match(app, /const Verify = lazy\(/)
  assert.match(app, /const VerifyDashboard = lazy\(/)
  assert.ok(en.hero && en.register && en.dashboard)
})

test('the privacy line about the country is on the home page in every language, in one sentence', () => {
  assert.equal(en.home.privacy.languageNote, 'We use your country only to pick your language and never store your IP.')
  for (const dict of [fr, ar, pt]) assert.ok(dict.home.privacy.languageNote.length > 20)
})
