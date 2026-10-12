import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  affiliationProblem, affiliationsPayload, INSTITUTION_CATEGORIES, kindOf, legacyFields, MAX_AFFILIATIONS, newEntry, searchInstitutions,
  type Institution,
} from './lib/institutions.ts'
import { institutionsToCsv } from './pages/admin/csv.ts'
import { en } from './i18n/en.ts'
import { fr } from './i18n/fr.ts'
import { ar } from './i18n/ar.ts'
import { pt } from './i18n/pt.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

const NES: Institution = { id: 'a', name: 'Nigerian Environmental Society (NES)', acronym: 'NES', country: 'Nigeria', category: 'professional_body' }
const IEPN: Institution = { id: 'b', name: 'Institute of Environmental Practitioners of Nigeria (IEPN)', acronym: 'IEPN', country: 'Nigeria', category: 'professional_body' }
const IUCN: Institution = { id: 'c', name: 'International Union for Conservation of Nature (IUCN)', acronym: 'IUCN', country: null, category: 'ngo_network' }

test('four categories are kept separate, and only NGOs and networks are the NGO list', () => {
  assert.deepEqual([...INSTITUTION_CATEGORIES], ['professional_body', 'statutory_council', 'scientific_society', 'ngo_network'])
  assert.equal(kindOf('ngo_network'), 'ngo')
  for (const c of ['professional_body', 'statutory_council', 'scientific_society'] as const) assert.equal(kindOf(c), 'professional')
})

test('searching matches a name, an acronym or a country, ignoring case and accents', () => {
  const all = [NES, IEPN, IUCN]
  assert.deepEqual(searchInstitutions(all, 'nes').map((i) => i.id), ['a'])
  assert.deepEqual(searchInstitutions(all, 'IEPN').map((i) => i.id), ['b'])
  assert.deepEqual(searchInstitutions(all, 'nigeria').map((i) => i.id), ['a', 'b'])
  assert.deepEqual(searchInstitutions(all, 'conservation nature').map((i) => i.id), ['c'])
  assert.deepEqual(searchInstitutions(all, '').length, 3)
  assert.deepEqual(searchInstitutions(all, 'zzz'), [])
})

test('an entry that is not in the list ("Other") has a name and no institution; the payload keeps them apart', () => {
  const other = { ...newEntry('professional', null, '  Ghana Society of Ecologists  '), membership_number: ' 42 ' }
  assert.equal(other.institution_id, null)
  assert.equal(other.name, 'Ghana Society of Ecologists')
  const chosen = newEntry('professional', NES)
  const [a, b] = affiliationsPayload([{ ...chosen, other: false }, { ...other, other: true }])
  assert.equal(a.institution_id, 'a')
  assert.equal(a.other_name, null)
  assert.equal(b.institution_id, null)
  assert.equal(b.other_name, 'Ghana Society of Ecologists')
  assert.equal(b.membership_number, '42')
})

test('professional bodies carry a category, number and licence; NGOs carry only an affiliation type', () => {
  const body = { ...newEntry('professional', NES), membership_category: 'Fellow', membership_number: 'N-1', licence_status: 'Active', affiliation_type: 'partner' }
  const ngo = { ...newEntry('ngo', IUCN), membership_category: 'Fellow', membership_number: 'X', licence_status: 'Y', affiliation_type: 'consultant' }
  const [p, n] = affiliationsPayload([body, ngo])
  assert.deepEqual([p.membership_category, p.membership_number, p.licence_status, p.affiliation_type], ['Fellow', 'N-1', 'Active', ''])
  assert.deepEqual([n.membership_category, n.membership_number, n.licence_status, n.affiliation_type], ['', '', '', 'consultant'])
})

test('registering needs nothing from this section: an empty list is a valid, empty payload', () => {
  assert.deepEqual(affiliationsPayload([]), [])
  assert.deepEqual(legacyFields([]), { memberships: [], nes_number: '', iepn_status: '' })
})

test('the older directory fields are still filled from the new choices', () => {
  const nes = { ...newEntry('professional', NES), membership_number: ' 123 ' }
  const iepn = { ...newEntry('professional', IEPN), licence_status: 'Registered' }
  const iucn = newEntry('ngo', IUCN)
  const other = newEntry('professional', null, 'Some Society')
  const f = legacyFields([nes, iepn, iucn, other])
  assert.deepEqual(f.memberships.sort(), ['IEPN', 'IUCN', 'NES', 'Others'])
  assert.equal(f.nes_number, '123')
  assert.equal(f.iepn_status, 'Registered')
})

test('problems: a typed name needs two letters, and nothing may be over its limit', () => {
  assert.equal(affiliationProblem({ ...newEntry('professional', null, 'A'), other: true }), 'name')
  assert.equal(affiliationProblem({ ...newEntry('professional', null, 'Ab'), other: true }), null)
  assert.equal(affiliationProblem({ ...newEntry('professional', NES), membership_number: 'x'.repeat(81) }), 'long')
  assert.equal(affiliationProblem({ ...newEntry('professional', NES), licence_status: 'x'.repeat(121) }), 'long')
  assert.equal(MAX_AFFILIATIONS, 20)
})

test('the institutions CSV carries every field the brief names, one row each, with a byte order mark', () => {
  const csv = institutionsToCsv([
    {
      id: '1', name: 'Nigerian Environmental Society (NES)', acronym: 'NES', country: 'Nigeria', coverage: 'national', category: 'professional_body',
      specialisation: 'Impact assessment', website: null, public_contact: null, verification_status: 'unverified', verification_date: null,
      evidence_source: 'Client document', suggested_by: null, status: 'approved', experts: 2,
    } as never,
  ])
  assert.ok(csv.startsWith('﻿'))
  const [head, row] = csv.slice(1).split('\r\n')
  for (const h of ['Organisation name', 'Acronym', 'Country', 'Geographic coverage', 'Category', 'Specialisation', 'Website', 'Public contact', 'Verification status', 'Verification date', 'Evidence source', 'Suggested by', 'Status']) {
    assert.ok(head.split(',').map((x) => x.replace(/"/g, '')).includes(h), h)
  }
  assert.match(row, /unverified/)
})

// ---- the seed ----

type SeedRow = { name: string; acronym: string; country: string; coverage: string; category: string; evidence_source: string }
const seed = JSON.parse(read('supabase/seed/institutions.json')) as SeedRow[]

test('the seed has 61 records across the four categories, none duplicated, every one unverified in the SQL', () => {
  assert.equal(seed.length, 61)
  const keys = seed.map((r) => `${r.name.toLowerCase()}|${r.country.toLowerCase()}`)
  assert.equal(new Set(keys).size, keys.length, 'no duplicates')
  for (const r of seed) assert.ok((INSTITUTION_CATEGORIES as readonly string[]).includes(r.category), r.name)
  const counts = Object.fromEntries(INSTITUTION_CATEGORIES.map((c) => [c, seed.filter((r) => r.category === c).length]))
  assert.deepEqual(counts, { professional_body: 15, statutory_council: 2, scientific_society: 2, ngo_network: 42 })
  const sql = read('supabase/migrations/20261016000002_institutions_seed.sql')
  assert.match(sql, /'unverified', 'approved'/)
  assert.doesNotMatch(sql, /'verified'/, 'no seeded record is verified')
  for (const r of seed) assert.match(r.evidence_source, /Not verified/, r.name)
})

test('the organisations the brief names are all present', () => {
  const need = ['NES', 'IEPN', 'EHCON', 'NSE', 'EAPASA', 'SACNASP', 'EIK', 'IAIA', 'NCF', 'Wetlands International', 'IUCN', 'WWF', 'BirdLife', 'AWF', 'WCS', 'HOMEF', 'ERA', 'Green Belt Movement']
  const hay = seed.map((r) => `${r.name} ${r.acronym}`.toLowerCase())
  for (const n of need) assert.ok(hay.some((h) => h.includes(n.toLowerCase())), `${n} is missing from the seed`)
})

// ---- the migration ----

const mig = read('supabase/migrations/20261016000001_institutions.sql')

test('the migration is additive: it creates tables with IF NOT EXISTS, adds columns, and never drops or truncates', () => {
  assert.doesNotMatch(mig, /\bdrop\s+(table|column|schema)\b/i)
  assert.doesNotMatch(mig, /\btruncate\b/i)
  assert.doesNotMatch(mig, /alter\s+table\s+public\.experts\s+(drop|alter\s+column|rename)/i)
  for (const m of mig.matchAll(/create table\s+(?!if not exists)/gi)) assert.fail(`create table without IF NOT EXISTS at ${m.index}`)
  assert.match(mig, /alter table public\.experts add column if not exists affiliations_public boolean not null default false/)
  // The only rows it changes in existing tables is the new consent column, and only by an expert's own choice.
  const updates = [...mig.matchAll(/update\s+public\.(\w+)/gi)].map((m) => m[1])
  assert.ok(updates.every((t) => ['experts', 'institutions', 'expert_affiliations'].includes(t)), updates.join(','))
  const expertUpdate = mig.slice(mig.indexOf('update public.experts'), mig.indexOf('update public.experts') + 200)
  assert.match(expertUpdate, /set affiliations_public/)
})

test('the new tables are locked: row level security on, no policies, no direct grants', () => {
  assert.match(mig, /alter table public\.institutions enable row level security/)
  assert.match(mig, /alter table public\.expert_affiliations enable row level security/)
  assert.doesNotMatch(mig, /create policy/i)
  assert.match(mig, /revoke all on public\.institutions from anon, authenticated/)
  assert.match(mig, /revoke all on public\.expert_affiliations from anon, authenticated/)
})

test('the institution record has every field in the brief, and a status that can only be approved or pending', () => {
  const table = mig.slice(mig.indexOf('create table if not exists public.institutions'), mig.indexOf('alter table public.institutions enable'))
  for (const col of ['name', 'acronym', 'country', 'coverage', 'category', 'specialisation', 'website', 'public_contact', 'verification_status', 'verification_date', 'evidence_source', 'suggested_by', 'status']) {
    assert.match(table, new RegExp(`\\b${col}\\b`), col)
  }
  assert.match(table, /status[^\n]*check \(status in \('approved', 'pending'\)\)/)
  assert.match(table, /professional_body[^\n]*statutory_council[^\n]*scientific_society[^\n]*ngo_network/)
})

test('private details stay private: no public function returns a membership number or licence, and pending items are never public', () => {
  const funcs = mig.split(/create or replace function /).slice(1)
  const named = (n: string) => funcs.find((f) => f.startsWith(`public.${n}`)) ?? ''
  for (const n of ['public_institutions', 'directory_search', 'directory_profile']) {
    const body = named(n)
    assert.ok(body, n)
    assert.doesNotMatch(body, /membership_number|licence_status/, `${n} must not read private details`)
  }
  assert.match(named('public_institutions'), /status = 'approved'/)
  assert.match(named('directory_profile'), /affiliations_public/)
  assert.match(named('directory_profile'), /status = 'approved'/)
  assert.match(named('directory_search'), /affiliations_public/)
})

test('the admin functions are guarded and the portal ones are for the server only', () => {
  const funcs = mig.split(/create or replace function /).slice(1)
  for (const n of ['admin_list_institutions', 'admin_save_institution', 'admin_merge_institutions', 'admin_expert_affiliations', 'admin_registration_stats']) {
    const body = funcs.find((f) => f.startsWith(`public.${n}`)) ?? ''
    assert.match(body, /is_admin\(\)/, n)
  }
  assert.match(mig, /grant execute on function public\.portal_get_affiliations\(text\), public\.portal_set_affiliations_public\(text, boolean\) to service_role/)
})

test('a suggestion typed under Other is saved pending, and never as approved', () => {
  const reg = mig.slice(mig.indexOf('create or replace function public.register_expert'), mig.indexOf('create or replace function public.directory_search'))
  assert.match(reg, /'pending'/)
  assert.match(reg, /invalid_affiliation/)
  assert.match(reg, /too_many_affiliations/)
  assert.match(reg, /affiliations_public/)
})

// ---- wording ----

test('everything declared is self-declared: no text says a membership is verified, and none calls the registry a licence', () => {
  const dicts = { en, fr, ar, pt }
  for (const [code, d] of Object.entries(dicts)) {
    assert.ok(d.register.fields.aff.selfDeclared.length > 10, `${code} has the self-declared line`)
    assert.ok(d.profile.affiliationsNote.length > 20, `${code} has the profile note`)
  }
  const aff = JSON.stringify([en.register.fields.aff, en.dashboard.affiliations, en.profile.affiliationsNote])
  assert.match(aff, /self-declared/i)
  assert.doesNotMatch(aff, /statutory licen[cs]/i)
  assert.doesNotMatch(en.register.fields.aff.consent, /verified/i, 'showing memberships never says verified')
  assert.equal(en.dashboard.affiliations.statusRegistered, 'Registered')
  assert.equal(en.dashboard.affiliations.statusEvidenceSubmitted, 'Evidence Submitted')
  assert.equal(en.dashboard.affiliations.statusVerified, 'Verified')
})

test('the registry is never described as a statutory licence anywhere in the English text', () => {
  const text = JSON.stringify(en)
  assert.doesNotMatch(text, /(is|as|are) a statutory licen[cs]e/i)
  assert.match(text, /does not replace (a )?statutory or professional licen[cs](e|ing)/i)
})

test('the form section is collapsed, optional and one toggle', () => {
  const sec = read('src/components/AffiliationsSection.tsx')
  assert.match(sec, /aria-expanded/)
  assert.equal(en.register.fields.aff.toggle, 'Add memberships and affiliations (optional)')
  const reg = read('src/pages/Register.tsx')
  assert.match(reg, /AffiliationsSection/)
})
