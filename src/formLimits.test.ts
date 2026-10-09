import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { FIELD_LIMITS, emptyForm, toPayload, validateStep, type FormData } from './lib/form.ts'

// Field lengths: the form stops typing at a limit, names a value that is still too long, and never sends more.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

const base: FormData = {
  ...emptyForm,
  full_name: 'Ada Obi', title: 'Dr', organisation: 'Ada Labs', position: 'Lead', state: 'Lagos',
  email: 'ada@example.org', phone: '08031234567',
}

test('every limit is positive and the database backstop is wider than the form limit', () => {
  const db: Record<string, number> = { full_name: 200, organisation: 300, position: 200, email: 320, phone: 40, state: 200, profile_url: 600, nes_number: 100, iepn_status: 200 }
  for (const [k, limit] of Object.entries(FIELD_LIMITS)) {
    assert.ok(limit > 0, k)
    assert.ok(db[k] > limit, `${k}: database limit ${db[k]} must be wider than the form limit ${limit}`)
  }
  const limits = read('supabase/migrations/20261014000001_field_length_limits.sql')
  const country = read('supabase/migrations/20261015000001_country.sql')
  for (const [k, v] of Object.entries(db)) assert.match(limits + country, new RegExp(`experts_len_${k} check \\(.*<= ${v}\\)`), k)
  assert.doesNotMatch(limits, /\b(delete|truncate|update)\b/i, 'no data is touched')
  // The country migration only adds: no expert row is changed or removed, and no table or column is dropped.
  assert.doesNotMatch(country, /\b(delete from public\.experts|update public\.experts|truncate|drop table|drop column)\b/i)
})

test('a value over the limit is named on its screen, and a value at the limit is fine', () => {
  assert.deepEqual(validateStep(0, base), {})
  assert.deepEqual(validateStep(0, { ...base, full_name: 'N'.repeat(FIELD_LIMITS.full_name) }), {})
  const e = validateStep(0, { ...base, full_name: 'N'.repeat(FIELD_LIMITS.full_name + 1), organisation: 'O'.repeat(500) })
  assert.match(e.full_name ?? '', /120 characters or fewer/)
  assert.match(e.organisation ?? '', /200 characters or fewer/)
  assert.match(validateStep(2, { ...base, profile_url: 'https://example.org/' + 'a'.repeat(400), availability: 'Nigeria', discoverable: 'no', consent_contact: true }).profile_url ?? '', /300 characters or fewer/)
})

test('the payload never carries more than the limit, whatever the form held', () => {
  const p = toPayload({ ...base, full_name: 'N'.repeat(900), organisation: 'O'.repeat(900), position: 'P'.repeat(900), email: 'e'.repeat(900) + '@x.org', phone: '1'.repeat(900), profile_url: 'a'.repeat(900) })
  assert.equal(p.full_name.length, FIELD_LIMITS.full_name)
  assert.equal(p.organisation.length, FIELD_LIMITS.organisation)
  assert.equal(p.position.length, FIELD_LIMITS.position)
  assert.equal(p.email.length, FIELD_LIMITS.email)
  assert.equal(p.phone.length, FIELD_LIMITS.phone)
  assert.equal(p.profile_url.length, FIELD_LIMITS.profile_url)
})

test('every text input stops at its limit', () => {
  assert.match(read('src/components/fields.tsx'), /maxLength=\{FIELD_LIMITS\[fieldKey\]\}/)
})

test('registration uses plain fetch, so Try again works after a dropped connection', () => {
  const api = read('src/lib/api.ts')
  assert.match(api, /rpcCall\('register_expert'/)
  assert.doesNotMatch(api, /import\('\.\/supabase'\)/)
  const rest = read('src/lib/rest.ts')
  assert.match(rest, /status: 0/)
  assert.match(rest, /request timed out/)
})
