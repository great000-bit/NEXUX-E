import { test } from 'node:test'
import assert from 'node:assert/strict'
import { emptyForm, errorList, firstInvalidStep, normalisePhone, toPayload, validateStep, type FormData } from './form.ts'
import { ASSIGNMENTS, EXPERTISE, STATES } from './options.ts'

// Regression tests: these pin down how registration behaved before Phase 2, and must keep passing.

const valid: FormData = {
  ...emptyForm,
  full_name: 'Ada Obi',
  title: 'Dr',
  organisation: 'Delta State University',
  position: 'Lecturer',
  state: 'Delta',
  email: 'Ada.Obi@Example.org ',
  phone: '0803 123 4567',
  primary_expertise: 'ESIA and Safeguards',
  years_experience: '5 to 10',
  qualification: 'HND',
  availability: 'Nigeria',
  discoverable: 'yes',
  consent_contact: true,
}

test('the PRD lists are intact: 15 expertise areas, 13 assignment options, 37 states plus outside Nigeria', () => {
  assert.equal(EXPERTISE.length, 15)
  assert.equal(ASSIGNMENTS.length, 13)
  assert.equal(STATES.length, 38)
})

test('a complete registration passes every screen', () => {
  for (const step of [0, 1, 2] as const) assert.deepEqual(validateStep(step, valid), {}, `screen ${step + 1}`)
  assert.equal(firstInvalidStep(valid), null)
})

test('screen 1: every required field is checked, and email is required while phone is optional', () => {
  const e = validateStep(0, emptyForm)
  for (const k of ['full_name', 'title', 'organisation', 'position', 'state', 'email'] as const) assert.ok(e[k], k)
  assert.equal(e.phone, undefined, 'an empty phone is fine')
  assert.deepEqual(validateStep(0, { ...valid, phone: '' }), {}, 'email alone is enough')
  const noEmail = validateStep(0, { ...valid, email: '' })
  assert.match(noEmail.email ?? '', /Enter your email address, like name@example.com/)
  assert.equal(noEmail.phone, undefined, 'a phone number does not replace the email')
  assert.ok(validateStep(0, { ...valid, email: '   ' }).email, 'spaces do not count')
})

test('screen 1: bad phone and email are named individually, and a bad phone is still caught when email is fine', () => {
  assert.ok(validateStep(0, { ...valid, phone: '123' }).phone)
  assert.match(validateStep(0, { ...valid, phone: '123' }).phone ?? '', /or leave it empty/)
  assert.ok(validateStep(0, { ...valid, email: 'ada@@example' }).email)
  assert.ok(validateStep(0, { ...valid, email: 'ada@example' }).email)
  assert.equal(validateStep(0, { ...valid, email: 'ada@example.org' }).email, undefined)
})

test('screen 2: required choices and the maximum of three secondary areas', () => {
  const e = validateStep(1, emptyForm)
  for (const k of ['primary_expertise', 'years_experience', 'qualification'] as const) assert.ok(e[k], k)
  assert.ok(validateStep(1, { ...valid, secondary_expertise: ['a', 'b', 'c', 'd'] }).secondary_expertise)
  assert.equal(validateStep(1, { ...valid, secondary_expertise: ['a', 'b', 'c'] }).secondary_expertise, undefined)
})

test('screen 3: availability, discoverability and consent are required; the link is optional but must be a link', () => {
  const e = validateStep(2, emptyForm)
  for (const k of ['availability', 'discoverable', 'consent_contact'] as const) assert.ok(e[k], k)
  assert.equal(validateStep(2, { ...valid, profile_url: '' }).profile_url, undefined)
  assert.equal(validateStep(2, { ...valid, profile_url: 'linkedin.com/in/ada' }).profile_url, undefined)
  assert.ok(validateStep(2, { ...valid, profile_url: 'not a link' }).profile_url)
  assert.ok(validateStep(2, { ...valid, profile_url: 'javascript:alert(1)' }).profile_url)
})

test('phone numbers are normalised so every Nigerian format is the same number', () => {
  for (const raw of ['08031234567', '0803 123 4567', '+234 803 123 4567', '2348031234567', '002348031234567']) {
    assert.equal(normalisePhone(raw), '2348031234567', raw)
  }
})

test('the registration payload is cleaned the way the server expects', () => {
  const p = toPayload({ ...valid, profile_url: 'linkedin.com/in/ada', memberships: ['NES'], nes_number: ' 123 ', iepn_status: 'x', secondary_expertise: ['ESIA and Safeguards', 'Water and Hydrogeology'] })
  assert.equal(p.email, 'ada.obi@example.org')
  assert.equal(p.profile_url, 'https://linkedin.com/in/ada')
  assert.equal(p.discoverable, true)
  assert.equal(p.nes_number, '123')
  assert.equal(p.iepn_status, '', 'IEPN detail is only sent when IEPN is ticked')
  assert.deepEqual(p.secondary_expertise, ['Water and Hydrogeology'], 'the primary area is dropped from the secondary list')
  assert.equal(p.website, '', 'the honeypot is sent empty')
  assert.deepEqual(Object.keys(p).sort(), [
    'availability', 'consent_contact', 'discoverable', 'email', 'full_name', 'iepn_status', 'memberships', 'nes_number',
    'organisation', 'phone', 'position', 'primary_expertise', 'profile_url', 'qualification', 'secondary_expertise',
    'state', 'title', 'website', 'years_experience', 'assignments',
  ].sort())
})

test('error messages are plain, specific and free of dashes', () => {
  const all = [0, 1, 2].flatMap((s) => Object.values(validateStep(s as 0 | 1 | 2, emptyForm)))
  assert.ok(all.length >= 12)
  for (const m of all) {
    assert.ok(m && m.length > 15, `too terse: ${m}`)
    assert.ok(!new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`).test(m), m)
  }
})

test('errors are listed in the order they appear on the page', () => {
  const list = errorList(validateStep(0, emptyForm))
  assert.deepEqual(list.map((i) => i.key), ['full_name', 'title', 'organisation', 'position', 'state', 'email'])
  assert.ok(list.every((i) => i.label && i.anchor))
})

test('the earliest broken screen is found first', () => {
  const found = firstInvalidStep({ ...valid, qualification: '', consent_contact: false })
  assert.equal(found?.step, 1)
  assert.equal(firstInvalidStep({ ...valid, consent_contact: false })?.step, 2)
})
