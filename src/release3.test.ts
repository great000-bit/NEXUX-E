import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { composeEmail } from '../supabase/functions/send-confirmation-emails/status-emails.ts'
import { en } from './i18n/en.ts'
import { STATUS_LABEL } from './lib/verification.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const sql = read('supabase/migrations/20261020000001_admin_verification.sql')

test('the migration is additive and the merge log cannot be edited', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema)\b/i)
  assert.doesNotMatch(sql, /\btruncate\b/i)
  const deletes = [...sql.matchAll(/delete from public\.(\w+)/g)].map((m) => m[1])
  assert.deepEqual(deletes, ['expert_affiliations'])
  assert.match(sql, /alter table public\.verification_checklists enable row level security/)
  assert.match(sql, /alter table public\.expert_merge_log enable row level security/)
})

test('approving needs all four criteria and an administrator', () => {
  assert.match(sql, /checklist_incomplete/)
  assert.match(sql, /is_admin\(\)/)
})

test('the status wording is "Verified by NEXUS-E review" and never licensed, accredited or certified', () => {
  assert.equal(STATUS_LABEL.verified, 'Verified by NEXUS-E review')
  assert.equal(en.common.verifiedBadge, 'Verified by NEXUS-E review')
  assert.match(en.common.verifiedDisclaimer, /not a licence, an accreditation or a certification/)
  assert.doesNotMatch(en.common.verifiedBadge, /licen[cs]ed|accredited|certified/i)
})

test('the admin pages and the badge exist and use the shared pieces', () => {
  assert.match(read('src/pages/admin/AdminArea.tsx'), /path="duplicates"/)
  assert.match(read('src/pages/admin/Review.tsx'), /ReviewChecklist/)
  assert.match(read('src/components/VerifiedBadge.tsx'), /m\.common\.verifiedBadge/)
  for (const f of ['src/pages/ExpertProfile.tsx', 'src/pages/Verify.tsx', 'src/pages/VerifyDashboard.tsx', 'src/pages/Directory.tsx']) {
    assert.match(read(f), /verifiedDisclaimer/, f)
  }
})

test('the verified email uses the new wording and makes no licensing claim', () => {
  const mail = composeEmail({ template: 'verification_verified', expert_id: 'NEX-000042', full_name: 'Ada Obi', title: 'Dr', payload: {} }, { siteUrl: 'https://register.nexuse.org' })
  assert.match(mail.text, /Verified by NEXUS-E review/)
  assert.match(mail.text, /not a licence/)
})
