// Live regression checks against a real Supabase project, using only the public (anon) key.
//
//   node scripts/regression-live.mjs            read-only checks, safe to run any time
//   node scripts/regression-live.mjs --write    also registers one clearly labelled test expert and tries duplicates
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY from .env.local. Never prints the key.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const env = Object.fromEntries(
  fs.readFileSync(path.join(root, '.env.local'), 'utf8')
    .split(/\r?\n/).filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const URL_ = env.VITE_SUPABASE_URL
const KEY = env.VITE_SUPABASE_ANON_KEY
const WRITE = process.argv.includes('--write')
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

let passed = 0
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) passed++
  else failures.push(`${name}${detail ? ` (${detail})` : ''}`)
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail ? `  [${detail}]` : ''}`)
}

const rpc = async (fn, args = {}) => {
  const r = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: 'POST', headers: H, body: JSON.stringify(args) })
  const text = await r.text()
  let json
  try { json = JSON.parse(text) } catch { json = null }
  return { status: r.status, json }
}
const register = (p) => rpc('register_expert', { payload: base(p) })

const base = (p = {}) => ({
  full_name: 'TEST Regression (delete me)', title: 'Dr', organisation: 'Regression test', position: 'Tester', state: 'Edo',
  primary_expertise: 'ESIA and Safeguards', secondary_expertise: [], years_experience: '5 to 10', qualification: 'HND',
  memberships: [], assignments: [], availability: 'Nigeria', discoverable: false, consent_contact: true, website: '', ...p,
})

console.log(`Live regression against ${new URL(URL_).host}${WRITE ? ' (with writes)' : ' (read-only)'}\n`)

// ---- Registration rules still enforced by the database ----
const honey = await register({ website: 'bot', email: 'bot@example.org' })
check('honeypot returns a fake success and stores nothing', honey.json?.ok === true && honey.json?.expert_id === 'NEX-000000')
const expectError = async (label, p, code) => {
  const r = await register(p)
  check(`registration rejects: ${label}`, r.json?.ok === false && r.json?.error === code, `${r.status} ${JSON.stringify(r.json)}`)
}
await expectError('no email at all', {}, 'email_required')
await expectError('a phone number but no email', { phone: '08000009001' }, 'email_required')
await expectError('a badly formed email', { email: 'not-an-email' }, 'invalid_email')
await expectError('a badly formed phone', { phone: '123' }, 'invalid_phone')
await expectError('a script link as profile URL', { email: 'x.y@example.org', profile_url: 'javascript:alert(1)' }, 'invalid_url')
await expectError('more than three secondary areas', { email: 'x.z@example.org', secondary_expertise: ['a', 'b', 'c', 'd'] }, 'too_many_secondary')
await expectError('missing consent', { email: 'x.w@example.org', consent_contact: false }, 'consent_required')

// ---- Nothing is readable or callable by the public ----
for (const table of [
  'experts', 'email_outbox', 'admins', 'registration_attempts', 'expert_files', 'expert_sessions',
  'expert_login_codes', 'portal_attempts', 'verification_audit', 'verification_settings',
]) {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=*&limit=1`, { headers: H })
  check(`public cannot read ${table}`, r.status === 401 || r.status === 403 || r.status === 404, String(r.status))
}
const privateFns = [
  ['is_admin', {}], ['claim_outbox_emails', {}], ['get_function_secret', { p_name: 'resend_api_key' }],
  ['invoke_email_sender', { p_source: 'x' }], ['portal_session', { p_token_hash: 'x' }],
  ['portal_request_code', { p_email: 'a@b.co', p_ip_hash: 'x', p_code_hash: 'x' }],
  ['portal_submit', { p_expert_id: 'NEX-000001' }], ['system_retention_candidates', {}],
  ['admin_status_counts', {}], ['admin_review_expert', { p_expert_id: 'NEX-000001', p_decision: 'approve' }],
  ['admin_export_expert', { p_expert_id: 'NEX-000001' }],
]
for (const [fn, args] of privateFns) {
  const r = await rpc(fn, args)
  check(`public cannot call ${fn}`, r.status !== 200, String(r.status))
}

// ---- Private evidence storage ----
const bucket = await fetch(`${URL_}/storage/v1/bucket/expert-evidence`, { headers: H })
check('the evidence bucket is not readable by the public key', bucket.status !== 200, String(bucket.status))
const listing = await fetch(`${URL_}/storage/v1/object/list/expert-evidence`, { method: 'POST', headers: H, body: JSON.stringify({ prefix: '', limit: 10 }) })
const listed = await listing.json().catch(() => [])
check('the public cannot list evidence files', Array.isArray(listed) ? listed.length === 0 : true)
const up = await fetch(`${URL_}/storage/v1/object/expert-evidence/experts/evil.png`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }, body: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }) })
check('the public cannot upload to evidence storage', up.status >= 400, String(up.status))
const pub = await fetch(`${URL_}/storage/v1/object/public/expert-evidence/anything.pdf`)
check('there are no public file URLs', pub.status >= 400, String(pub.status))

// ---- The expert portal behaves the same for everyone who is not signed in ----
const portal = async (body, headers = {}) => {
  const r = await fetch(`${URL_}/functions/v1/expert-portal`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) })
  return { status: r.status, json: await r.json().catch(() => null) }
}
const a = await portal({ action: 'request_code', email: `nobody.${Date.now()}@example.org` })
const b = await portal({ action: 'request_code', email: 'garbage' })
check('asking for a code never reveals whether an email is registered', a.status === 200 && b.status === 200 && a.json?.message === b.json?.message)
check('a wrong code is refused with a friendly message', (await portal({ action: 'verify_code', email: 'nobody@example.org', code: '000000' })).status === 401)
check('portal data needs a session', (await portal({ action: 'me' })).status === 401)
check('a made-up session is refused', (await portal({ action: 'me' }, { 'x-portal-session': 'f'.repeat(64) })).status === 401)
const admin = await fetch(`${URL_}/functions/v1/verification-admin`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` }, body: JSON.stringify({ action: 'delete_files', expert_id: 'NEX-000001' }) })
check('the admin function refuses the public key', admin.status === 401, String(admin.status))
const mail = await fetch(`${URL_}/functions/v1/send-confirmation-emails`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
check('the email sender refuses callers without the secret', mail.status === 401, String(mail.status))

// ---- Optional: a real registration, then duplicates ----
if (WRITE) {
  const stamp = Date.now().toString().slice(-6)
  const email = `greatemmanwori+reg${stamp}@gmail.com`
  const ok = await register({ email, phone: '+234 800 000 9' + stamp.slice(-3) })
  check('a valid registration returns an Expert ID in the NEX-000000 format', ok.json?.ok === true && /^NEX-\d{6}$/.test(ok.json?.expert_id ?? ''), JSON.stringify(ok.json))
  const dupEmail = await register({ email: email.toUpperCase(), phone: '08000009999' })
  check('the same email in capitals is a duplicate', dupEmail.json?.error === 'duplicate_email', JSON.stringify(dupEmail.json))
  const dupPhone = await register({ email: `other.${stamp}@example.org`, phone: '0800 000 9' + stamp.slice(-3) })
  check('the same phone in another format is a duplicate', dupPhone.json?.error === 'duplicate_phone', JSON.stringify(dupPhone.json))
  console.log(`\nCreated test expert ${ok.json?.expert_id}. Clean up with:\n  delete from public.email_outbox where expert_id = '${ok.json?.expert_id}';\n  delete from public.experts where expert_id = '${ok.json?.expert_id}';`)
}

console.log(`\n${passed} passed, ${failures.length} failed`)
if (failures.length) {
  console.log(`Failed:\n - ${failures.join('\n - ')}`)
  process.exitCode = 1
}
