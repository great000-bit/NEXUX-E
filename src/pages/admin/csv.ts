export type Expert = {
  id: string
  expert_id: string
  full_name: string
  title: string
  organisation: string
  position: string
  state: string
  phone: string | null
  email: string | null
  primary_expertise: string
  secondary_expertise: string[]
  years_experience: string
  qualification: string
  memberships: string[]
  nes_number: string | null
  iepn_status: string | null
  assignments: string[]
  availability: string
  profile_url: string | null
  discoverable: boolean
  consent_contact: boolean
  consent_at: string
  verification_status: string
  created_at: string
}

const COLUMNS: { header: string; get: (e: Expert) => string }[] = [
  { header: 'Expert ID', get: (e) => e.expert_id },
  { header: 'Registered at', get: (e) => e.created_at },
  { header: 'Title', get: (e) => e.title },
  { header: 'Full name', get: (e) => e.full_name },
  { header: 'Organisation', get: (e) => e.organisation },
  { header: 'Position', get: (e) => e.position },
  { header: 'State', get: (e) => e.state },
  { header: 'Phone', get: (e) => e.phone ?? '' },
  { header: 'Email', get: (e) => e.email ?? '' },
  { header: 'Primary expertise', get: (e) => e.primary_expertise },
  { header: 'Secondary expertise', get: (e) => e.secondary_expertise.join('; ') },
  { header: 'Years of experience', get: (e) => e.years_experience },
  { header: 'Highest qualification', get: (e) => e.qualification },
  { header: 'Memberships', get: (e) => e.memberships.join('; ') },
  { header: 'NES number', get: (e) => e.nes_number ?? '' },
  { header: 'IEPN status', get: (e) => e.iepn_status ?? '' },
  { header: 'Assignments', get: (e) => e.assignments.join('; ') },
  { header: 'Availability', get: (e) => e.availability },
  { header: 'Profile URL', get: (e) => e.profile_url ?? '' },
  { header: 'Discoverable', get: (e) => (e.discoverable ? 'Yes' : 'No') },
  { header: 'Consent to be contacted', get: (e) => (e.consent_contact ? 'Yes' : 'No') },
  { header: 'Consent recorded at', get: (e) => e.consent_at },
  { header: 'Verification status', get: (e) => e.verification_status },
]

/** Quote a cell, and defuse spreadsheet formulas (=, +, -, @) typed into the public form. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(rows: Expert[]): string {
  const lines = [COLUMNS.map((c) => cell(c.header)).join(',')]
  for (const r of rows) lines.push(COLUMNS.map((c) => cell(c.get(r))).join(','))
  // BOM so Excel reads UTF-8 names correctly.
  return '﻿' + lines.join('\r\n')
}

export function downloadCsv(rows: Expert[], filename: string) {
  const blob = new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
