import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildSingle, buildSummary, buildTest, formatTime, needsSummary, type Registration } from './compose.ts'

const reg = (n: number): Registration => ({
  id: n, expertId: `NEX-${String(n).padStart(6, '0')}`, primaryExpertise: 'Water and Hydrogeology', country: 'Kenya',
  registeredAt: `2026-10-12T20:${String(n % 60).padStart(2, '0')}:00.000Z`,
})
const URL_ = 'https://register.nexuse.org/admin'

test('a single email: subject names the Expert ID; body has the five facts and the link; nothing personal', () => {
  const e = buildSingle(reg(123), 4, URL_)
  assert.equal(e.subject, 'New NEXUS-E registration NEX-000123')
  for (const part of ['Expert ID: NEX-000123', 'Primary expertise: Water and Hydrogeology', 'Country: Kenya', 'Registered: ', 'Registrations today: 4', URL_]) {
    assert.ok(e.text.includes(part), part)
  }
  assert.doesNotMatch(e.text + e.html, /@|phone|whatsapp|full name/i, 'no contact detail')
  assert.doesNotMatch(e.text, /!|free|offer|unlock/i, 'no marketing wording')
})

test('more than five waiting is one summary: count, every Expert ID, the time range', () => {
  assert.equal(needsSummary(5), false)
  assert.equal(needsSummary(6), true)
  const rs = [1, 2, 3, 4, 5, 6, 7, 8].map(reg)
  const e = buildSummary(rs, 8, URL_)
  assert.equal(e.subject, '8 new NEXUS-E registrations')
  assert.match(e.text, /8 new registrations/)
  for (const r of rs) assert.ok(e.text.includes(r.expertId))
  assert.match(e.text, /From: .*\nTo: /)
})

test('the test email is clearly a test and carries no registration', () => {
  const e = buildTest(URL_)
  assert.equal(e.subject, 'TEST notification')
  assert.doesNotMatch(e.text, /NEX-\d/)
})

test('times are shown in Lagos time', () => {
  assert.equal(formatTime('2026-10-12T20:04:00.000Z'), '12 Oct 2026, 21:04 (Lagos time)')
})

test('html is escaped', () => {
  const r = { ...reg(1), primaryExpertise: '<script>x</script>' }
  assert.doesNotMatch(buildSingle(r, 1, URL_).html, /<script>/)
})
