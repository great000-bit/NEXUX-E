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

test('the original columns are still there, in their original order', () => {
  const head = parse(toCsv([row]))[0].split(',').map((h) => h.replace(/"/g, ''))
  const original = [
    'Expert ID', 'Registered at', 'Title', 'Full name', 'Organisation', 'Position', 'State', 'Phone', 'Email',
    'Primary expertise', 'Secondary expertise', 'Years of experience', 'Highest qualification', 'Memberships',
    'NES number', 'IEPN status', 'Assignments', 'Availability', 'Profile URL', 'Discoverable',
    'Consent to be contacted', 'Consent recorded at', 'Verification status',
  ]
  assert.deepEqual(head.slice(0, original.length), original)
})

test('verification columns are added at the end and show readable status names', () => {
  const [head, line] = parse(toCsv([row]))
  const names = head.split(',').map((h) => h.replace(/"/g, ''))
  assert.deepEqual(names.slice(-5), ['Evidence submitted at', 'Reviewed at', 'Reviewed by', 'Verified at', 'Country'])
  assert.ok(line.includes('"Verified"'))
  assert.ok(line.includes('"admin@example.org"'))
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
  assert.ok(line.includes('"ada@example.org"') && line.includes('"Verified"'))
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
    pending: 'Pending', under_review: 'Under review', more_evidence: 'More evidence needed', verified: 'Verified', not_verified: 'Not verified',
  }
  for (const [raw, label] of Object.entries(labels)) {
    assert.ok(parse(toCsv([{ ...row, verification_status: raw }]))[1].includes(`"${label}"`), raw)
  }
})
