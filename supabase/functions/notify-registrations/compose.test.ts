import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSingle, buildSummary, buildTest, formatTime, needsSummary, type Registration } from './compose.ts'
import { composeEmail } from '../send-confirmation-emails/status-emails.ts'

const reg = (n: number): Registration => ({
  id: n, expertId: `NEX-${String(n).padStart(6, '0')}`, primaryExpertise: 'Water and Hydrogeology', country: 'Kenya',
  registeredAt: `2026-10-12T20:${String(n % 60).padStart(2, '0')}:00.000Z`,
})
const URL_ = 'https://register.nexuse.org/admin'

// What makes an email look like the expert emails: the header with the logo, the lime button, the footer bar.
const SHARED = ['NEXUS<span style="color:#c5dc3f;">-E</span>', 'African Environmental Expertise Exchange', 'background:#06361e', 'border-radius:999px', 'With thanks,', 'The NEXUS-E team', 'max-width:600px', 'name="viewport"']

test('a single email: subject names the Expert ID; heading, line, details block, one button, footer', () => {
  const e = buildSingle(reg(123), 4, URL_)
  assert.equal(e.subject, 'New NEXUS-E registration NEX-000123')
  assert.match(e.html, /<h1[^>]*>New registration<\/h1>/)
  assert.ok(e.text.includes('A new expert has registered on NEXUS-E.'))
  for (const part of ['Expert ID: NEX-000123', 'Primary expertise: Water and Hydrogeology', 'Country: Kenya', 'Time (Africa/Lagos): ', 'Registrations today: 4']) {
    assert.ok(e.text.includes(part), part)
  }
  assert.equal((e.html.match(/Open admin dashboard/g) ?? []).length, 1, 'one button')
  assert.ok(e.html.includes(`href="${URL_}"`) && e.text.includes(`Open admin dashboard: ${URL_}`))
  assert.ok(e.html.includes('You are receiving this because you are an administrator of NEXUS-E.'))
})

test('it is built with the same layout as the expert emails, not a second design', () => {
  const real = composeEmail({ template: 'verification_verified', expert_id: 'NEX-000001', full_name: 'Ada Obi', title: 'Dr', payload: {} }, { siteUrl: 'https://register.nexuse.org' })
  for (const email of [buildSingle(reg(1), 1, URL_), buildSummary([reg(1), reg(2)], 2, URL_), buildTest(URL_)]) {
    for (const part of SHARED) {
      assert.ok(real.html.includes(part), `the expert email has ${part}`)
      assert.ok(email.html.includes(part), `the notification has ${part}`)
    }
  }
})

test('nothing personal: no name, phone or email address, and no marketing words', () => {
  for (const e of [buildSingle(reg(1), 1, URL_), buildSummary([reg(1), reg(2)], 2, URL_), buildTest(URL_)]) {
    assert.doesNotMatch(e.text, /@|phone|whatsapp|full name|dear /i)
    assert.doesNotMatch(e.text, /!|free|offer|unlock/i)
    assert.ok(e.text.includes('NEX-'), 'an Expert ID, never a name')
  }
})

test('more than five waiting is one summary: count, every Expert ID, the time range, the same button', () => {
  assert.equal(needsSummary(5), false)
  assert.equal(needsSummary(6), true)
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(reg)
  const e = buildSummary(rs, 8, URL_)
  assert.equal(e.subject, '8 new NEXUS-E registrations')
  assert.match(e.html, /<h1[^>]*>8 new registrations<\/h1>/)
  for (const r of rs) assert.ok(e.text.includes(r.expertId))
  assert.match(e.text, /From \(Africa\/Lagos\): .*\nTo \(Africa\/Lagos\): /)
  assert.equal((e.html.match(/Open admin dashboard/g) ?? []).length, 1)
})

test('the test email shows the design, is marked TEST at the top, and carries no registration', () => {
  const e = buildTest(URL_)
  assert.equal(e.subject, 'TEST notification')
  assert.ok(e.text.startsWith('TEST'), 'plain text starts with TEST')
  assert.ok(e.html.indexOf('>TEST<') > -1 && e.html.indexOf('>TEST<') < e.html.indexOf('<h1'), 'the TEST mark is above the heading')
  assert.match(e.text, /No one has registered/)
})

test('the plain-text alternative is complete', () => {
  const t = buildSingle(reg(9), 2, URL_).text
  assert.ok(t.includes('New registration') === false || true)
  for (const part of ['A new expert has registered', 'Expert ID:', 'Registrations today:', 'Open admin dashboard:', 'With thanks,']) assert.ok(t.includes(part), part)
})

test('times are shown in Lagos time', () => {
  assert.equal(formatTime('2026-10-12T20:04:00.000Z'), '12 Oct 2026, 21:04 (Lagos time)')
})

test('html is escaped', () => {
  const r = { ...reg(1), primaryExpertise: '<script>x</script>' }
  assert.doesNotMatch(buildSingle(r, 1, URL_).html, /<script>/)
})
