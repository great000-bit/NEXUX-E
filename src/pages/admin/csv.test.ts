import { test } from 'node:test'
import assert from 'node:assert/strict'
import { csvFileName, interestToCsv, toCsv, type Expert } from './csv.ts'
import type { InterestedExpert } from '../../lib/opportunities.ts'

// Regression tests for the admin CSV export.

const row: Expert = {
  id: 'u1',
  expert_id: 'NEX-000001',
  full_name: 'Ada "The Great" Obi',
  title: 'Dr',
  organisation: 'Delta, State University',
  position: 'Lecturer',
  state: 'Delta',
  phone: '2348031234567',
  email: 'ada@example.org',
  primary_expertise: 'ESIA and Safeguards',
  secondary_expertise: ['Water and Hydrogeology', 'GIS and Remote Sensing'],
  years_experience: '5 to 10',
  qualification: 'HND',
  memberships: ['NES'],
  nes_number: null,
  iepn_status: null,
  assignments: ['Consulting'],
  availability: 'Nigeria',
  profile_url: null,
  discoverable: true,
  consent_contact: true,
  consent_at: '2026-10-08T00:00:00Z',
  verification_status: 'verified',
  submitted_at: '2026-10-08T01:00:00Z',
  reviewed_at: '2026-10-08T02:00:00Z',
  reviewed_by: 'admin@example.org',
  verified_at: '2026-10-08T02:00:00Z',
  review_message: null,
  created_at: '2026-10-07T23:00:00Z',
}

const parse = (csv: string) => csv.replace('﻿', '').split('\r\n')

test('the default export starts with the columns the brief asks for, in order', () => {
  const head = parse(toCsv([row]))[0].split(',').map((h) => h.replace(/"/g, ''))
  assert.deepEqual(head.slice(0, 6), [
    'Expert ID', 'Registered at', 'Country', 'Primary expertise', 'Verification status', 'Memberships and affiliations (self-declared)',
  ])
})

test('no membership number, licence detail or other private field is in the default export', () => {
  const head = parse(toCsv([row]))[0]
  for (const bad of ['NES number', 'IEPN', 'licence', 'Licence', 'number', 'Profile URL']) assert.ok(!head.includes(bad), bad)
  const line = parse(toCsv([{ ...row, nes_number: 'SECRET-123', iepn_status: 'LICENCE-XYZ' }]))[1]
  assert.ok(!line.includes('SECRET-123') && !line.includes('LICENCE-XYZ'))
})

test('contact details are included only for an expert who agreed to be contacted', () => {
  const yes = parse(toCsv([{ ...row, consent_contact: true }]))[1]
  const no = parse(toCsv([{ ...row, consent_contact: false }]))[1]
  for (const v of [row.email, row.phone, 'Ada']) {
    assert.ok(v && yes.includes(v), 'included with consent')
    assert.ok(v && !no.includes(v), 'left out without consent')
  }
  assert.ok(no.includes('"No"'))
})

test('declared memberships and affiliations are listed by name; a suggestion is marked; the older list is the fallback', () => {
  const by = {
    [row.expert_id]: [
      { name: 'Nigerian Environmental Society (NES)', acronym: 'NES', kind: 'professional' as const, pending: false },
      { name: 'Some Society', acronym: null, kind: 'professional' as const, pending: true },
      { name: 'Nature Kenya', acronym: null, kind: 'ngo' as const, pending: false },
    ],
  }
  const line = parse(toCsv([row], by))[1]
  assert.ok(line.includes('"Nigerian Environmental Society (NES); Some Society (suggested, not yet reviewed); Nature Kenya"'))
  const fallback = parse(toCsv([{ ...row, memberships: ['NES', 'IUCN'] }]))[1]
  assert.ok(fallback.includes('"NES; IUCN"'))
})

test('verification dates come after, and show readable status names', () => {
  const [head, line] = parse(toCsv([row]))
  const names = head.split(',').map((h) => h.replace(/"/g, ''))
  assert.deepEqual(names.slice(-3), ['Evidence submitted at', 'Reviewed at', 'Verified at'])
  assert.ok(line.includes('"Verified by NEXUS-E review"'))
})

test('commas and quotes inside cells are escaped, and the file starts with a BOM for Excel', () => {
  const csv = toCsv([row])
  assert.ok(csv.startsWith('﻿'))
  assert.ok(csv.includes('"Delta, State University"'))
  assert.ok(csv.includes('"Ada ""The Great"" Obi"'))
})

test('spreadsheet formulas typed into the public form cannot run', () => {
  const evil = { ...row, full_name: '=HYPERLINK("http://evil")', organisation: '+cmd', position: '@SUM(1)', email: '-1+1' }
  const line = parse(toCsv([evil]))[1]
  for (const bad of ['"=HYPERLINK', '"+cmd', '"@SUM', '"-1+1']) assert.ok(!line.includes(bad), bad)
  assert.ok(line.includes('"\'=HYPERLINK'))
})

const interested: InterestedExpert = {
  expert_id: 'NEX-000006',
  title: 'Dr',
  full_name: 'Ada "The Great" Obi',
  organisation: 'Delta, State University',
  position: 'Lecturer',
  state: 'Delta',
  email: 'ada@example.org',
  phone: '2348031234567',
  primary_expertise: 'ESIA and Safeguards',
  secondary_expertise: ['Water and Hydrogeology', 'GIS and Remote Sensing'],
  years_experience: '5 to 10',
  qualification: 'HND',
  memberships: ['NES'],
  assignments: ['Consulting', 'Research'],
  availability: 'Nigeria',
  profile_url: null,
  verification_status: 'verified',
  interested_at: '2026-10-08T03:52:21Z',
}

test('the interested experts export has the registered details, readable status and a BOM', () => {
  const csv = interestToCsv([interested])
  const [head, line] = parse(csv)
  const names = head.split(',').map((h) => h.replace(/"/g, ''))
  assert.deepEqual(names.slice(0, 4), ['Expert ID', 'Expressed interest at', 'Title', 'Full name'])
  assert.ok(names.includes('Email') && names.includes('Phone') && names.includes('Assignments'))
  assert.ok(csv.startsWith('﻿'))
  assert.ok(line.includes('"ada@example.org"') && line.includes('"Verified by NEXUS-E review"'))
  assert.ok(line.includes('"Water and Hydrogeology; GIS and Remote Sensing"'))
  assert.ok(line.includes('"Ada ""The Great"" Obi"'))
})

test('the interested experts export cannot run spreadsheet formulas, and an empty list is just the header', () => {
  const evil = { ...interested, full_name: '=HYPERLINK("http://evil")', organisation: '+cmd', email: '@x' }
  const line = parse(interestToCsv([evil]))[1]
  for (const bad of ['"=HYPERLINK', '"+cmd', '"@x']) assert.ok(!line.includes(bad), bad)
  assert.equal(parse(interestToCsv([])).length, 1)
})

test('the export file name is safe on every system', () => {
  const when = new Date('2026-10-08T10:00:00Z')
  assert.equal(csvFileName('interested', 'Wetland survey: Niger Delta / phase 2!', when), 'interested-wetland-survey-niger-delta-phase-2-2026-10-08.csv')
  assert.equal(csvFileName('interested', '!!!', when), 'interested-opportunity-2026-10-08.csv')
  assert.ok(!/[\\/:*?"<>|\s]/.test(csvFileName('interested', '..\\evil/../name', when)))
})

test('every status has a readable label in the export', () => {
  const labels: Record<string, string> = {
    pending: 'Registered', under_review: 'Evidence Submitted', more_evidence: 'More information needed', verified: 'Verified by NEXUS-E review', not_verified: 'Not verified',
  }
  for (const [raw, label] of Object.entries(labels)) {
    assert.ok(parse(toCsv([{ ...row, verification_status: raw }]))[1].includes(`"${label}"`), raw)
  }
})
