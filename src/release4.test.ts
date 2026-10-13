import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { composeEmail } from '../supabase/functions/send-confirmation-emails/status-emails.ts'
import { shortlistToCsv, type ShortlistRow } from './pages/admin/csv.ts'
import { en } from './i18n/en.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const sql = read('supabase/migrations/20261021000001_opportunity_matching.sql')

test('the migration is additive and the new table is private', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i)
  assert.doesNotMatch(sql, /\btruncate\b/i)
  assert.doesNotMatch(sql, /delete from public\./)
  assert.match(sql, /alter table public\.opportunity_invitations enable row level security/)
  assert.match(sql, /revoke all on public\.opportunity_invitations from anon, authenticated/)
  assert.match(sql, /using \(public\.is_admin\(\)\)/)
})

test('only administrators match and invite, only the service role answers, and nobody is contacted automatically', () => {
  for (const fn of ['admin_match_experts', 'admin_invite_experts', 'admin_opportunity_invitations', 'admin_set_opportunity_matching']) {
    const body = sql.slice(sql.indexOf(`function public.${fn}(`))
    assert.match(body.slice(0, 900), /is_admin\(\)/, fn)
  }
  assert.match(sql, /grant execute on function\s+public\.portal_list_invitations\(text\),\s+public\.portal_respond_invitation\(text, uuid, text, boolean\)\s+to service_role/)
  assert.doesNotMatch(sql, /create trigger|cron\./i)
})

test('only experts who agreed to be listed can be suggested or invited, and every point has a reason', () => {
  assert.match(sql, /e\.discoverable is true and e\.merged_into is null/)
  assert.match(sql, /v_e\.discoverable is not true or v_e\.merged_into is not null/)
  for (const text of ['Primary expertise matches', 'A secondary expertise matches', 'Based in', 'meets the level asked for', 'Available for consulting', 'Verified by NEXUS-E review']) {
    assert.ok(sql.includes(text), text)
  }
  assert.doesNotMatch(sql, /\bai\b|embedding|openai/i)
})

test('contact details leave the database only when the expert agreed', () => {
  assert.match(sql, /'email', case when i\.share_contact then e\.email end/)
  assert.match(sql, /'phone', case when i\.share_contact then e\.phone end/)
  assert.match(sql, /check \(share_contact is false or response = 'interested'\)/)
})

const row = (over: Partial<ShortlistRow>): ShortlistRow => ({
  expert_id: 'NEX-000001', full_name: 'Ada Obi', title: 'Dr', organisation: 'Org', country: 'Kenya', primary_expertise: 'Water and Hydrogeology',
  verification_status: 'verified', response: 'interested', responded_at: null, share_contact: false, score: 80, email: 'ada@example.org', phone: '254700000000', ...over,
})

test('the shortlist lists only interested experts and shows contact details only for those who agreed', () => {
  const csv = shortlistToCsv([
    row({}),
    row({ expert_id: 'NEX-000002', full_name: 'Bayo Ade', share_contact: true, email: 'bayo@example.org', phone: '254711111111' }),
    row({ expert_id: 'NEX-000003', full_name: 'Cy Not', response: 'not_interested' }),
  ])
  assert.ok(!csv.includes('ada@example.org') && !csv.includes('254700000000'), 'withheld contact details leaked')
  assert.ok(csv.includes('bayo@example.org') && csv.includes('+254711111111'))
  assert.ok(!csv.includes('Cy Not'))
  assert.ok(!/licen[cs]e|membership|evidence/i.test(csv.split('\r\n')[0]), 'private columns in the header')
})

test('the expert portal serves invitations and answers, and the expert sees the invitation text', () => {
  const portal = read('supabase/functions/expert-portal/index.ts')
  assert.match(portal, /action === 'invitations'/)
  assert.match(portal, /action === 'respond_invitation'/)
  assert.ok(en.dashboard.invitations.shareContact.length > 20)
  assert.match(read('src/components/OpportunitiesSection.tsx'), /<InvitationsSection/)
})

test('the invitation email is plain, English, and promises no sharing without consent', () => {
  const mail = composeEmail({ template: 'opportunity_invitation', expert_id: 'NEX-000042', full_name: 'Ada Obi', title: 'Dr', payload: { opportunity_title: 'Water study', deadline: '2026-12-01' } }, { siteUrl: 'https://register.nexuse.org' })
  assert.match(mail.subject, /opportunity/i)
  assert.match(mail.text, /Water study/)
  assert.match(mail.text, /Nothing is shared with the organisation unless you choose/)
  assert.ok(!/[–—]/.test(mail.text))
})
