import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  daysLeft, deadlineNote, describeLogEntry, EMPTY_OPP, formatDay, nigeriaToday, OPP_ERRORS, validateOpportunity,
  type OppForm,
} from './opportunities.ts'

// 2026-11-10 at 23:30 UTC is already 2026-11-11 00:30 in Nigeria (UTC+1).
const LATE_EVENING_UTC = Date.UTC(2026, 10, 10, 23, 30)
const NOON = Date.UTC(2026, 10, 11, 12, 0)

test('today in Nigeria is one hour ahead of UTC', () => {
  assert.equal(nigeriaToday(LATE_EVENING_UTC), '2026-11-11')
  assert.equal(nigeriaToday(NOON), '2026-11-11')
  assert.equal(nigeriaToday(Date.UTC(2026, 10, 10, 22, 59)), '2026-11-10')
})

test('a deadline stays open through its whole day in Nigeria and closes the next morning', () => {
  assert.equal(daysLeft('2026-11-11', NOON), 0)
  assert.equal(deadlineNote('2026-11-11', NOON), 'Closes today')
  assert.equal(deadlineNote('2026-11-12', NOON), '1 day left')
  assert.equal(deadlineNote('2026-11-21', NOON), '10 days left')
  assert.equal(deadlineNote('2026-11-10', NOON), 'Closed')
  // Just after midnight in Nigeria, the 10th is over even though it is still the 10th in UTC.
  assert.equal(deadlineNote('2026-11-10', LATE_EVENING_UTC), 'Closed')
})

test('a deadline is shown as the same calendar day for everyone', () => {
  assert.equal(formatDay('2026-11-12'), '12 November 2026')
  assert.equal(formatDay('2027-01-01'), '1 January 2027')
})

const good: OppForm = {
  title: 'Wetland survey in the Niger Delta',
  description: 'A six week field survey of mangrove health.',
  opp_type: 'Field Surveys',
  expertise_needed: ['Biodiversity and Ecosystems'],
  location: 'Bayelsa',
  deadline: '2026-12-01',
  status: 'draft',
}

test('a complete opportunity has no problems', () => {
  assert.deepEqual(validateOpportunity(good, NOON), {})
  assert.deepEqual(validateOpportunity({ ...good, status: 'open' }, NOON), {})
})

test('every missing or bad part gets its own friendly message', () => {
  const e = validateOpportunity(EMPTY_OPP, NOON)
  assert.deepEqual(Object.keys(e).sort(), ['deadline', 'description', 'expertise_needed', 'location', 'opp_type', 'title'])
  assert.match(e.opp_type ?? '', /Choose the type/)
  assert.ok(validateOpportunity({ ...good, title: 'x'.repeat(141) }, NOON).title)
  assert.ok(validateOpportunity({ ...good, opp_type: 'Astrology' }, NOON).opp_type)
  assert.ok(validateOpportunity({ ...good, expertise_needed: ['Astrology'] }, NOON).expertise_needed)
  assert.ok(validateOpportunity({ ...good, deadline: '12/01/2026' }, NOON).deadline)
})

test('a past deadline can be saved as a draft or closed, but not opened', () => {
  const past = { ...good, deadline: '2026-11-01' }
  assert.deepEqual(validateOpportunity({ ...past, status: 'draft' }, NOON), {})
  assert.deepEqual(validateOpportunity({ ...past, status: 'closed' }, NOON), {})
  assert.match(validateOpportunity({ ...past, status: 'open' }, NOON).deadline ?? '', /already passed/)
})

test('copy has no em or en dashes', () => {
  const dash = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`)
  for (const text of Object.values(OPP_ERRORS)) assert.ok(!dash.test(text), text)
  for (const a of ['created', 'published', 'closed', 'reopened', 'set_to_draft', 'updated', 'deleted']) {
    assert.ok(!dash.test(describeLogEntry(a, { changed: ['title'], interested_experts: 2 })), a)
  }
})

test('the change log reads as plain sentences', () => {
  assert.equal(describeLogEntry('updated', { changed: ['title', 'deadline'] }), 'Edited: title, deadline.')
  assert.equal(describeLogEntry('deleted', { interested_experts: 3 }), 'Deleted. 3 expert(s) had expressed interest.')
  assert.match(describeLogEntry('published', { also_changed: ['deadline'] }), /Also changed: deadline/)
})
