import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { AFRICAN_COUNTRIES, COUNTRIES, DEFAULT_COUNTRY, hasStateList, isCountry } from './lib/countries.ts'
import { emptyForm, isValidPhone, normalisePhone, toPayload, validateStep, type FormData } from './lib/form.ts'
import { EMPTY_FILTERS, filtersFromParams, paramsFromFilters, searchArgs } from './lib/directoryFilters.ts'
import { interestToCsv, toCsv } from './pages/admin/csv.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

const ada: FormData = {
  ...emptyForm,
  full_name: 'Ada Obi', title: 'Dr', organisation: 'Ada Labs', position: 'Lead', state: 'Lagos',
  email: 'ada@example.org', phone: '08031234567',
}

test('the country list is every African country plus Other, with Nigeria as the default', () => {
  assert.equal(AFRICAN_COUNTRIES.length, 54)
  assert.equal(COUNTRIES.length, 55)
  assert.equal(new Set(COUNTRIES).size, 55)
  assert.equal(COUNTRIES.at(-1), 'Other')
  assert.equal(DEFAULT_COUNTRY, 'Nigeria')
  assert.equal(emptyForm.country, 'Nigeria')
  assert.ok(isCountry('Kenya') && !isCountry('Narnia'))
  assert.ok(hasStateList('Nigeria') && !hasStateList('Kenya') && !hasStateList('Other'))
})

test('the database accepts exactly the same countries as the form offers', () => {
  const sql = read('supabase/migrations/20261015000001_country.sql')
  const inList = /experts_country_valid check \(country in \(([^;]*)\)\);/.exec(sql)?.[1] ?? ''
  const fromDb = [...inList.matchAll(/'((?:[^']|'')*)'/g)].map((m) => m[1].replace(/''/g, "'"))
  assert.deepEqual(fromDb, [...COUNTRIES])
})

test('the migration is additive: existing rows become Nigeria, nothing is removed, the unique indexes are untouched', () => {
  const sql = read('supabase/migrations/20261015000001_country.sql')
  assert.match(sql, /add column if not exists country text not null default 'Nigeria'/)
  assert.doesNotMatch(sql, /\b(drop table|drop column|truncate|delete from public\.experts|update public\.experts)\b/i)
  assert.doesNotMatch(sql, /create unique index|drop index|drop constraint (if exists )?experts_(email|phone)/i)
  // An older form sends no country: the function falls back to Nigeria, and the search keeps working without p_country.
  assert.match(sql, /coalesce\(nullif\(btrim\(payload ->> 'country'\), ''\), 'Nigeria'\)/)
  assert.match(sql, /p_country text default null/)
  assert.match(sql, /drop function if exists public\.directory_search\(text, text, text, text, text, text, text, text, text, int, int\)/)
})

test('Nigerian numbers keep working in local and international form', () => {
  assert.equal(normalisePhone('0803 123 4567', 'Nigeria'), '2348031234567')
  assert.equal(normalisePhone('0803 123 4567'), '2348031234567', 'Nigeria is the default')
  assert.equal(normalisePhone('+234 803 123 4567', 'Nigeria'), '2348031234567')
  assert.equal(normalisePhone('00234 803 123 4567', 'Nigeria'), '2348031234567')
  assert.ok(isValidPhone('0803 123 4567') && isValidPhone('+2348031234567'))
})

test('outside Nigeria a phone number needs its country code (E.164), and the same number is stored the same way as the database', () => {
  // These three results match what the staging database returned for the same input.
  assert.equal(normalisePhone('+254 712 345 678', 'Kenya'), '254712345678')
  assert.equal(normalisePhone('+20 10 1234 5678', 'Egypt'), '201012345678')
  assert.equal(normalisePhone('00254712345678', 'Kenya'), '254712345678')
  assert.ok(isValidPhone('+254 712 345 678', 'Kenya'))
  assert.ok(isValidPhone('00254712345678', 'Kenya'))
  assert.ok(!isValidPhone('0712345678', 'Kenya'), 'a local number is ambiguous outside Nigeria')
  assert.ok(!isValidPhone('01012345678', 'Egypt'), 'an eleven digit local Egyptian number is not mistaken for a Nigerian one')
  assert.ok(isValidPhone('+123456789012345', 'Ghana'), 'fifteen digits is the E.164 maximum')
  assert.ok(!isValidPhone('+1234567890123456', 'Ghana'), 'sixteen digits is too long')
  assert.ok(!isValidPhone('+12345', 'Ghana'), 'too short')
  assert.ok(isValidPhone('+254 712 345 678', 'Nigeria'), 'a Nigerian resident may still give a foreign number')
})

test('Nigeria asks for a state from the list; every other country asks for a state, province or region in words', () => {
  assert.deepEqual(validateStep(0, ada), {})
  assert.ok(validateStep(0, { ...ada, state: 'Outside Nigeria' }).state, 'the old "Outside Nigeria" answer is no longer a state')
  assert.ok(validateStep(0, { ...ada, state: 'Narnia' }).state)
  const kenya = { ...ada, country: 'Kenya', state: 'Nairobi County', phone: '+254 712 345 678' }
  assert.deepEqual(validateStep(0, kenya), {})
  assert.match(validateStep(0, { ...kenya, state: '' }).state ?? '', /state, province or region/)
  assert.match(validateStep(0, { ...kenya, phone: '0712345678' }).phone ?? '', /country code/)
  assert.ok(validateStep(0, { ...kenya, state: 'x'.repeat(500) }).state, 'a very long region is named, not cut silently')
  assert.ok(validateStep(0, { ...ada, country: '' }).country)
  assert.deepEqual(validateStep(0, { ...kenya, country: 'Other' }), {}, '"Other" works like any country without a list')
})

test('the payload carries the country, and a typed region is trimmed', () => {
  assert.equal(toPayload(ada).country, 'Nigeria')
  assert.equal(toPayload(ada).state, 'Lagos')
  const p = toPayload({ ...ada, country: 'Senegal', state: '  Dakar  ' })
  assert.equal(p.country, 'Senegal')
  assert.equal(p.state, 'Dakar')
})

test('an older saved draft with no country is treated as Nigeria', () => {
  const restored = { ...emptyForm, ...{ full_name: 'Ada' } }
  assert.equal(restored.country, 'Nigeria')
})

test('the directory can be filtered by country, in the address bar and in the database call', () => {
  assert.equal(EMPTY_FILTERS.country, '')
  const f = filtersFromParams(new URLSearchParams('country=Kenya&expertise=ESIA%20and%20Safeguards'))
  assert.equal(f.country, 'Kenya')
  assert.equal(filtersFromParams(new URLSearchParams('country=Narnia')).country, '', 'an unknown country is ignored')
  assert.equal(paramsFromFilters(f).country, 'Kenya')
  assert.equal(searchArgs(f).p_country, 'Kenya')
  assert.equal(searchArgs(EMPTY_FILTERS).p_country, null)
  // An old link with only a Nigerian state still works.
  assert.equal(filtersFromParams(new URLSearchParams('state=Lagos')).state, 'Lagos')
})

test('the admin exports end with a Country column, so the earlier columns keep their places', () => {
  const text = ['id', 'expert_id', 'full_name', 'title', 'organisation', 'position', 'years_experience', 'qualification', 'availability', 'created_at', 'consent_at', 'verification_status', 'primary_expertise', 'interested_at']
  const base = { ...Object.fromEntries(text.map((k) => [k, ''])), expert_id: 'NEX-000001', secondary_expertise: [], memberships: [], assignments: [], state: 'Nairobi', discoverable: true, consent_contact: true }
  const split = (csv: string) => csv.replace(String.fromCharCode(0xfeff), '').split(String.fromCharCode(13, 10))
  const lines = split(toCsv([{ ...base, country: 'Kenya' } as never]))
  assert.equal(lines[0].split(',').at(-1), '"Country"')
  assert.equal(lines[1].split(',').at(-1), '"Kenya"')
  assert.equal(split(toCsv([base as never]))[1].split(',').at(-1), '"Nigeria"', 'a row with no country is Nigeria')
  const interest = split(interestToCsv([{ ...base, country: 'Ghana' } as never]))
  assert.equal(interest[0].split(',').at(-1), '"Country"')
  assert.equal(interest[1].split(',').at(-1), '"Ghana"')
})
