import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { en } from './i18n/en.ts'
import { fr } from './i18n/fr.ts'
import { pt } from './i18n/pt.ts'
import { fmt } from './i18n/types.ts'
import { DEFAULT_LOCALE, LOCALES, localeInfo, matchLocale, prefersOtherLanguage } from './i18n/locales.ts'
import { COUNTRIES } from './lib/countries.ts'
import { EXPERTISE, ASSIGNMENTS, QUALIFICATIONS, YEARS, MEMBERSHIPS } from './lib/options.ts'

// The other languages are typed against English, so the compiler already rejects a missing key. These tests also check
// what types cannot: list lengths, placeholders, dashes, and text that was left in English by mistake.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

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
const OTHERS = { fr: flatten(fr), pt: flatten(pt) }
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
  // Brand names, acronyms and a few words that are the same in every language are allowed to match.
  const SAME_OK = /^(NEXUS-E|NES|IEPN|NSE|NIA|NITP|NIM|ESG|HND|Congo|Ghana|Angola|Togo|Mali|Niger|Gabon|Kenya|Sierra Leone|Eswatini|Botswana|Burundi|Djibouti|Lesotho|Madagascar|Malawi|Mozambique|Rwanda|Senegal|Seychelles|Zimbabwe|Cabo Verde|Burkina Faso|Uganda|Infrastructure|International|Consulting|Expertise)/
  for (const [code, dict] of Object.entries(OTHERS)) {
    for (const [key, text] of Object.entries(dict)) {
      if (key.startsWith('meta.')) continue
      if (EN[key].length > 25 && text === EN[key]) assert.fail(`${code} ${key} is still English`)
      void SAME_OK
    }
  }
})

test('the translated option labels cover every stored value', () => {
  const groups: [keyof typeof en.options, readonly string[]][] = [
    ['expertise', EXPERTISE], ['assignments', ASSIGNMENTS], ['qualifications', QUALIFICATIONS], ['years', YEARS],
    ['memberships', MEMBERSHIPS], ['countries', COUNTRIES],
  ]
  for (const dict of [en, fr, pt]) {
    for (const [group, values] of groups) {
      assert.deepEqual(Object.keys(dict.options[group]).sort(), [...values].sort(), `${dict.meta.code} ${group}`)
    }
  }
})

test('the language registry is ready for Arabic and Swahili: each language carries its direction', () => {
  assert.deepEqual(LOCALES.map((l) => l.code), ['en', 'fr', 'pt'])
  assert.equal(DEFAULT_LOCALE, 'en')
  for (const l of LOCALES) assert.ok(l.dir === 'ltr' || l.dir === 'rtl')
  assert.equal(localeInfo('fr').native, 'Français')
  assert.equal(localeInfo('pt').native, 'Português')
})

test('the browser language is matched, and only a non-English browser sees the first visit prompt', () => {
  assert.equal(matchLocale(['fr-CM', 'en']), 'fr')
  assert.equal(matchLocale(['pt-AO']), 'pt')
  assert.equal(matchLocale(['ar-EG', 'en-GB']), 'en')
  assert.equal(matchLocale(['sw-KE']), null)
  assert.equal(prefersOtherLanguage(['en-NG']), false)
  assert.equal(prefersOtherLanguage(['en-GB', 'fr']), false)
  assert.equal(prefersOtherLanguage(['fr-SN', 'en']), true)
  assert.equal(prefersOtherLanguage(['sw-KE']), true)
  assert.equal(prefersOtherLanguage([]), false)
})

test('fmt fills placeholders and leaves unknown ones visible', () => {
  assert.equal(fmt('Step {n} of {total}', { n: 2, total: 3 }), 'Step 2 of 3')
  assert.equal(fmt('Hello {name}', {}), 'Hello {name}')
})

test('the language feature is switched off: English only, no picker, no prompt, no stored choice, no other language loaded', () => {
  const provider = read('src/i18n/I18nProvider.tsx')
  assert.match(provider, /root\.lang = 'en'/)
  assert.match(provider, /root\.dir = 'ltr'/)
  assert.doesNotMatch(provider, /localStorage|navigator\.language|role="dialog"|loadMessages|import\(/)
  const core = read('src/i18n/index.ts')
  assert.doesNotMatch(core, /localStorage|import\(|storedLocale|loadMessages/)
  assert.doesNotMatch(read('src/main.tsx'), /initI18n/)
  assert.doesNotMatch(read('src/components/Navbar.tsx'), /LanguagePicker/)
  // Nothing in the compiled source imports the other languages, so they are never bundled.
  const walk = (dir: string): string[] => fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
  for (const f of walk('src').filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f))) {
    assert.doesNotMatch(read(f), /from '(\.\.?\/)+(i18n\/)?(fr|pt)'|import\('(\.\.?\/)+(i18n\/)?(fr|pt)'\)/, f)
  }
  assert.ok(fs.existsSync(path.join(root, 'src/i18n/fr.ts')) && fs.existsSync(path.join(root, 'src/i18n/pt.ts')), 'the translation files are kept for later')
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
  // The complete dictionary is the two halves together.
  assert.deepEqual(Object.keys(en).sort(), [...Object.keys(en)].sort())
  assert.ok(en.hero && en.register && en.dashboard)
})
