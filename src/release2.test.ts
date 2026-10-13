import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { composeEmail } from '../supabase/functions/send-confirmation-emails/status-emails.ts'
import { toCsv } from './pages/admin/csv.ts'
import { en } from './i18n/en.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const sql = read('supabase/migrations/20261019000001_profile_evidence.sql')

test('the migration is additive: no table, column or data is dropped, and no row is deleted except a reference the expert removes', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i)
  assert.doesNotMatch(sql, /\btruncate\b/i)
  const deletes = [...sql.matchAll(/delete from public\.(\w+)/g)].map((m) => m[1])
  assert.deepEqual(deletes, ['expert_references'])
  assert.match(sql, /create table if not exists public\.expert_references/)
})

test('references are private: row level security on, no public grant, administrators read through a policy', () => {
  assert.match(sql, /alter table public\.expert_references enable row level security/)
  assert.match(sql, /revoke all on public\.expert_references from anon, authenticated/)
  assert.match(sql, /create policy expert_references_admin_read on public\.expert_references for select to authenticated using \(public\.is_admin\(\)\)/)
  assert.doesNotMatch(sql, /grant [a-z, ]+ on public\.expert_references to (anon|public)/)
})

test('no email, phone or contact detail is asked of a referee, and nobody is emailed', () => {
  const table = sql.slice(sql.indexOf('create table if not exists public.expert_references'), sql.indexOf('create index if not exists expert_references_expert_idx'))
  assert.doesNotMatch(table, /email|phone|contact/i)
  assert.doesNotMatch(sql, /email_outbox[^;]*referee|referee[^;]*email_outbox/i)
})

test('an administrator records the outcome of a reference check, and it is logged; the expert never sees it', () => {
  assert.match(sql, /admin_set_reference_outcome[\s\S]*is_admin\(\)/)
  assert.match(sql, /'reference_checked'/)
  const list = sql.slice(sql.indexOf('create or replace function public.portal_list_references'), sql.indexOf('create or replace function public.portal_add_reference'))
  assert.doesNotMatch(list, /outcome/)
})

test('a complete set is what submits: qualification, membership or licence, project role, one reference, and the evidence consent', () => {
  const fn = sql.slice(sql.indexOf('create or replace function public.portal_completion'), sql.indexOf('create or replace function public.portal_submit'))
  for (const part of ["f.kind = 'qualification'", "f.kind in ('membership', 'licence')", "f.kind = 'project_role'", 'expert_references', 'evidence_consent_at is not null']) {
    assert.ok(fn.includes(part), part)
  }
  assert.match(fn, /'complete', v_consent and v_qual and v_cred and v_role and v_ref/)
  const submit = sql.slice(sql.indexOf('create or replace function public.portal_submit'))
  assert.match(submit, /raise exception 'incomplete'/)
  assert.match(submit, /verification_status = 'under_review'/)
})

test('moving to Evidence Submitted is only ever done by the expert submitting: no frontend path sets a status', () => {
  const fn = read('supabase/functions/expert-portal/index.ts')
  assert.doesNotMatch(fn, /verification_status['"]?\s*[:=]\s*['"](verified|under_review|pending)/)
  assert.match(fn, /portal_submit/)
})

test('the administrator is told once through the existing outbox, with no name, phone or email', () => {
  assert.match(sql, /insert into public\.email_outbox \(expert_id, to_email, template, ref, payload\)\s+values \(p_expert_id, v_admin, 'evidence_submitted'/)
  assert.match(sql, /jsonb_build_object\('primary_expertise', v_expertise, 'country', v_country\)/)
  const mail = composeEmail(
    { template: 'evidence_submitted', expert_id: 'NEX-000123', full_name: 'Ada Obi', title: 'Dr', payload: { primary_expertise: 'Water and Hydrogeology', country: 'Kenya' } },
    { siteUrl: 'https://register.nexuse.org' },
  )
  assert.equal(mail.subject, 'Evidence submitted NEX-000123: NEXUS-E')
  assert.doesNotMatch(mail.html + mail.text, /Ada|Obi|@|phone/i)
  assert.match(mail.html, /Open review/)
  assert.ok(mail.html.includes('/admin/verification/NEX-000123'))
  // The same layout as the expert emails.
  const expert = composeEmail({ template: 'verification_verified', expert_id: 'NEX-000123', full_name: 'Ada Obi', title: 'Dr', payload: {} }, { siteUrl: 'https://register.nexuse.org' })
  for (const part of ['background:#06361e', 'African Environmental Expertise Exchange', 'border-radius:999px', 'The NEXUS-E team']) {
    assert.ok(expert.html.includes(part) && mail.html.includes(part), part)
  }
})

test('evidence and references never reach the directory, the public profile or the exports', () => {
  const publicSql = read('supabase/migrations/20261018000001_search_filters.sql')
  assert.doesNotMatch(publicSql, /expert_files|expert_references/)
  const text = ['id', 'expert_id', 'full_name', 'title', 'organisation', 'position', 'years_experience', 'qualification', 'availability', 'created_at', 'consent_at', 'verification_status', 'primary_expertise', 'state', 'country']
  const row = { ...Object.fromEntries(text.map((k) => [k, ''])), expert_id: 'NEX-000001', secondary_expertise: [], memberships: [], assignments: [], discoverable: true, consent_contact: true }
  const csv = toCsv([row as never])
  assert.doesNotMatch(csv, /reference|evidence file|referee|qualification certificate/i)
  assert.doesNotMatch(read('src/pages/ExpertProfile.tsx') + read('src/pages/Directory.tsx'), /expert_files|references|referee/i)
})

test('evidence uploads stay private with short lived links, type and size limits and a separate consent', () => {
  const fn = read('supabase/functions/expert-portal/index.ts')
  assert.match(fn, /createSignedUrl\(file\.storage_path, 60\)/)
  assert.match(fn, /MAX_BYTES/)
  assert.match(fn, /portal_record_consent/)
  assert.match(fn, /KINDS = \[[^\]]*'project_role'/)
  const schema = read('supabase/migrations/20261009000001_verification_schema.sql')
  assert.match(schema, /'expert-evidence', 'expert-evidence', false/)
  assert.match(schema, /array\['application\/pdf', 'image\/jpeg', 'image\/png'\]/)
})

test('the new expert-facing text says the right things', () => {
  const t = en.dashboard
  assert.match(t.references.help, /do not contact referees automatically/)
  assert.match(t.submitHint, /qualification[\s\S]*membership or licence[\s\S]*project role[\s\S]*reference/)
  assert.equal(Object.keys(t.completion.steps).length, 8)
  assert.doesNotMatch(JSON.stringify(t.completion) + JSON.stringify(t.references), /[–—]/, 'no dashes in the copy')
})
