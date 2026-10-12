import type { InterestedExpert } from '../../lib/opportunities'
import { isStatus, STATUS_LABEL } from '../../lib/verification'

const statusLabel = (s: string) => (isStatus(s) ? STATUS_LABEL[s] : s)

export type Expert = {
  id: string
  expert_id: string
  full_name: string
  title: string
  organisation: string
  position: string
  /** Older rows and records from an older server have none: they were all registered in Nigeria. */
  country?: string
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
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  verified_at: string | null
  review_message: string | null
  created_at: string
}

/** One expert's declared memberships and affiliations, by name. Self-declared; a number or licence is never here. */
export type AffiliationName = { name: string; acronym: string | null; kind: 'professional' | 'ngo'; pending: boolean }
export type AffiliationsByExpert = Record<string, AffiliationName[]>

/** "Name (NES); Name (suggested, not yet reviewed)". Falls back to the older membership list when nothing was declared. */
export function affiliationsText(e: Expert, byExpert?: AffiliationsByExpert): string {
  const items = byExpert?.[e.expert_id]
  if (items?.length) {
    return items.map((i) => (i.pending ? `${i.name} (suggested, not yet reviewed)` : i.acronym && !i.name.includes(i.acronym) ? `${i.name} (${i.acronym})` : i.name)).join('; ')
  }
  return e.memberships.join('; ')
}

/**
 * The default export. Contact details are included only for an expert who agreed to be contacted, and membership
 * numbers and licence details are never included (they stay in the expert's own record and the review screen).
 */
function columns(byExpert?: AffiliationsByExpert): { header: string; get: (e: Expert) => string }[] {
  const contact = (e: Expert, v: string | null | undefined) => (e.consent_contact ? (v ?? '') : '')
  return [
    { header: 'Expert ID', get: (e) => e.expert_id },
    { header: 'Registered at', get: (e) => e.created_at },
    { header: 'Country', get: (e) => e.country ?? 'Nigeria' },
    { header: 'Primary expertise', get: (e) => e.primary_expertise },
    { header: 'Verification status', get: (e) => statusLabel(e.verification_status) },
    { header: 'Memberships and affiliations (self-declared)', get: (e) => affiliationsText(e, byExpert) },
    { header: 'Consent to be contacted', get: (e) => (e.consent_contact ? 'Yes' : 'No') },
    { header: 'Title', get: (e) => contact(e, e.title) },
    { header: 'Full name', get: (e) => contact(e, e.full_name) },
    { header: 'Email', get: (e) => contact(e, e.email) },
    { header: 'Phone', get: (e) => contact(e, e.phone) },
    { header: 'Organisation', get: (e) => e.organisation },
    { header: 'Position', get: (e) => e.position },
    { header: 'State or region', get: (e) => e.state },
    { header: 'Secondary expertise', get: (e) => e.secondary_expertise.join('; ') },
    { header: 'Years of experience', get: (e) => e.years_experience },
    { header: 'Highest qualification', get: (e) => e.qualification },
    { header: 'Assignments', get: (e) => e.assignments.join('; ') },
    { header: 'Availability', get: (e) => e.availability },
    { header: 'Discoverable', get: (e) => (e.discoverable ? 'Yes' : 'No') },
    { header: 'Evidence submitted at', get: (e) => e.submitted_at ?? '' },
    { header: 'Reviewed at', get: (e) => e.reviewed_at ?? '' },
    { header: 'Verified at', get: (e) => e.verified_at ?? '' },
  ]
}

/** Quote a cell, and defuse spreadsheet formulas (=, +, -, @) typed into the public form. */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}

export function toCsv(rows: Expert[], byExpert?: AffiliationsByExpert): string {
  const cols = columns(byExpert)
  const lines = [cols.map((c) => cell(c.header)).join(',')]
  for (const r of rows) lines.push(cols.map((c) => cell(c.get(r))).join(','))
  // BOM so Excel reads UTF-8 names correctly.
  return '﻿' + lines.join('\r\n')
}

const INTEREST_COLUMNS: { header: string; get: (e: InterestedExpert) => string }[] = [
  { header: 'Expert ID', get: (e) => e.expert_id },
  { header: 'Expressed interest at', get: (e) => e.interested_at },
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
  { header: 'Assignments', get: (e) => e.assignments.join('; ') },
  { header: 'Availability', get: (e) => e.availability },
  { header: 'Profile URL', get: (e) => e.profile_url ?? '' },
  { header: 'Verification status', get: (e) => statusLabel(e.verification_status) },
  { header: 'Country', get: (e) => e.country ?? 'Nigeria' },
]

/** The experts who are interested in one opportunity, with the details they registered. */
export function interestToCsv(rows: InterestedExpert[]): string {
  const lines = [INTEREST_COLUMNS.map((c) => cell(c.header)).join(',')]
  for (const r of rows) lines.push(INTEREST_COLUMNS.map((c) => cell(c.get(r))).join(','))
  return '﻿' + lines.join('\r\n')
}

export type InstitutionRow = {
  id: string
  name: string
  acronym: string | null
  country: string | null
  coverage: string
  category: string
  specialisation: string | null
  website: string | null
  public_contact: string | null
  verification_status: string
  verification_date: string | null
  evidence_source: string | null
  suggested_by: string | null
  status: string
  experts: number
  created_at: string
  updated_at: string
}

const CATEGORY_NAME: Record<string, string> = {
  professional_body: 'Professional body',
  statutory_council: 'Statutory or regulatory council',
  scientific_society: 'Scientific society',
  ngo_network: 'NGO or conservation network',
}

const INSTITUTION_COLUMNS: { header: string; get: (i: InstitutionRow) => string }[] = [
  { header: 'Organisation name', get: (i) => i.name },
  { header: 'Acronym', get: (i) => i.acronym ?? '' },
  { header: 'Country', get: (i) => i.country ?? '' },
  { header: 'Geographic coverage', get: (i) => i.coverage },
  { header: 'Category', get: (i) => CATEGORY_NAME[i.category] ?? i.category },
  { header: 'Specialisation', get: (i) => i.specialisation ?? '' },
  { header: 'Website', get: (i) => i.website ?? '' },
  { header: 'Public contact', get: (i) => i.public_contact ?? '' },
  { header: 'Verification status', get: (i) => i.verification_status },
  { header: 'Verification date', get: (i) => i.verification_date ?? '' },
  { header: 'Evidence source', get: (i) => i.evidence_source ?? '' },
  { header: 'Suggested by', get: (i) => i.suggested_by ?? '' },
  { header: 'Status', get: (i) => i.status },
  { header: 'Experts', get: (i) => String(i.experts ?? 0) },
]

/** The institutions table, one row each, ready for a spreadsheet. */
export function institutionsToCsv(rows: InstitutionRow[]): string {
  const lines = [INSTITUTION_COLUMNS.map((c) => cell(c.header)).join(',')]
  for (const r of rows) lines.push(INSTITUTION_COLUMNS.map((c) => cell(c.get(r))).join(','))
  return '﻿' + lines.join('\r\n')
}

/** A file name that is safe on every system, built from an opportunity title. */
export function csvFileName(prefix: string, title: string, date: Date = new Date()): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'opportunity'
  return `${prefix}-${slug}-${date.toISOString().slice(0, 10)}.csv`
}

export function downloadCsvText(text: string, filename: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadCsv(rows: Expert[], filename: string, byExpert?: AffiliationsByExpert) {
  const blob = new Blob([toCsv(rows, byExpert)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
