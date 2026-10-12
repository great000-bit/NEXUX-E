import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decide, localeForCountry } from './i18n/detect.ts'
import { COUNTRY_LANGUAGES } from './i18n/countryLanguages.ts'
import { browserLocale, KNOWN_LANGUAGE_CODES, LOCALES, type LocaleCode } from './i18n/locales.ts'
import { AFRICAN_COUNTRIES } from './lib/countries.ts'

test('detection order: a saved pick first, then a supported browser language, then the country, then English', () => {
  assert.deepEqual(decide('pt', ['ar-EG']), { locale: 'pt', source: 'saved', needsCountry: false }, 'a saved pick wins over the browser')
  assert.deepEqual(decide('en', ['fr-FR']), { locale: 'en', source: 'saved', needsCountry: false }, 'a saved English pick is respected too')
  assert.deepEqual(decide(null, ['fr-SN', 'en']), { locale: 'fr', source: 'browser', needsCountry: false })
  assert.deepEqual(decide(null, ['ar-EG']), { locale: 'ar', source: 'browser', needsCountry: false })
  assert.deepEqual(decide(null, ['en-US', 'pt-AO']), { locale: 'pt', source: 'browser', needsCountry: false }, 'English is skipped, a later supported language counts')
  assert.deepEqual(decide(null, ['en-NG']), { locale: 'en', source: 'default', needsCountry: true }, 'an English browser asks the country')
  assert.deepEqual(decide(null, ['sw-KE', 'ha']), { locale: 'en', source: 'default', needsCountry: true }, 'an unsupported language asks the country')
  assert.deepEqual(decide(null, []), { locale: 'en', source: 'default', needsCountry: true })
})

test('browser languages: region and case are ignored, English and unknown languages are skipped', () => {
  assert.equal(browserLocale(['FR-ca']), 'fr')
  assert.equal(browserLocale(['pt_BR']), 'pt')
  assert.equal(browserLocale(['en', 'en-GB']), null)
  assert.equal(browserLocale(['zh-CN', 'ar']), 'ar')
})

test('the agreed country map: Arabic EG LY SD; French and Portuguese lists; everything else English', () => {
  const arabic = ['EG', 'LY', 'SD']
  const french = ['BJ', 'BF', 'BI', 'CF', 'CD', 'CG', 'CI', 'CM', 'DJ', 'DZ', 'GA', 'GN', 'KM', 'MA', 'MG', 'ML', 'MR', 'NE', 'SN', 'TD', 'TG', 'TN']
  const portuguese = ['AO', 'CV', 'GW', 'MZ', 'ST']
  for (const iso of arabic) assert.equal(localeForCountry(iso), 'ar', iso)
  for (const iso of french) assert.equal(localeForCountry(iso), 'fr', iso)
  for (const iso of portuguese) assert.equal(localeForCountry(iso), 'pt', iso)
  const mapped = new Set([...arabic, ...french, ...portuguese])
  for (const iso of Object.keys(COUNTRY_LANGUAGES).filter((c) => !mapped.has(c))) assert.equal(localeForCountry(iso), 'en', `${iso} is English`)
  assert.equal(localeForCountry('NG'), 'en', 'Nigeria stays English')
  assert.equal(localeForCountry('eg'), 'ar', 'case does not matter')
})

test('anything unknown is English: a country outside Africa, nothing, or rubbish', () => {
  for (const v of ['FR', 'US', 'XX', '', null, undefined, 'EGYPT', '12']) assert.equal(localeForCountry(v as string), 'en', String(v))
})

test('a language that is not live yet is English, and goes live without any change to the country data', () => {
  assert.equal(localeForCountry('KE'), 'en', 'Swahili is planned, not live')
  assert.equal(localeForCountry('KE', ['en', 'sw'] as unknown as LocaleCode[]), 'sw', 'once Swahili is live, Kenya is Swahili')
  assert.equal(localeForCountry('EG', ['en', 'fr'] as LocaleCode[]), 'en', 'a country whose language is not live falls back to English')
})

test('the country data covers all 54 African countries exactly once, with known language codes', () => {
  assert.equal(Object.keys(COUNTRY_LANGUAGES).length, 54)
  assert.deepEqual(Object.values(COUNTRY_LANGUAGES).map((c) => c.name).sort(), [...AFRICAN_COUNTRIES].sort())
  for (const iso of Object.keys(COUNTRY_LANGUAGES)) assert.match(iso, /^[A-Z]{2}$/)
  for (const [iso, row] of Object.entries(COUNTRY_LANGUAGES)) {
    assert.ok(KNOWN_LANGUAGE_CODES.includes(row.default), `${iso} default ${row.default}`)
    for (const code of row.additional) assert.ok(KNOWN_LANGUAGE_CODES.includes(code), `${iso} additional ${code}`)
    assert.ok(!row.additional.includes(row.default), `${iso} lists its default twice`)
  }
  assert.ok(LOCALES.every((l) => KNOWN_LANGUAGE_CODES.includes(l.code)))
})
