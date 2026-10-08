import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// Regression tests for Phase 3 (directory and opportunities). They read the source files, so they catch a
// privacy mistake before it can ship: a public page that reaches private columns, a migration that is not
// additive, or a function opened to the wrong people.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const MIGRATION = 'supabase/migrations/20261011000001_phase3_directory_and_opportunities.sql'

const PUBLIC_FILES = [
  'src/pages/Directory.tsx',
  'src/pages/ExpertProfile.tsx',
  'src/lib/directory.ts',
  'src/lib/directoryFilters.ts',
  'src/components/VerifiedBadge.tsx',
]
const NEW_COPY_FILES = [
  ...PUBLIC_FILES,
  'src/components/ListingCard.tsx',
  'src/components/OpportunitiesSection.tsx',
  'src/components/OppBadge.tsx',
  'src/pages/admin/Opportunities.tsx',
  'src/pages/admin/OpportunityEdit.tsx',
  'src/lib/opportunities.ts',
  'supabase/functions/send-confirmation-emails/status-emails.ts',
]

// ---------- The public pages only ever see public data ----------

test('public pages reach the data only through the two directory functions, never a table', () => {
  for (const f of PUBLIC_FILES) {
    const src = read(f)
    assert.doesNotMatch(src, /\.from\(/, `${f} must not read a table`)
    assert.doesNotMatch(src, /service_role|SERVICE_ROLE/i, f)
  }
  const api = read('src/lib/directory.ts')
  const calls = [...api.matchAll(/\.rpc\('([a-z_]+)'/g)].map((m) => m[1]).sort()
  assert.deepEqual(calls, ['directory_profile', 'directory_search'])
})

test('public pages never mention contact details, evidence or private fields', () => {
  for (const f of ['src/pages/Directory.tsx', 'src/pages/ExpertProfile.tsx', 'src/lib/directory.ts']) {
    const code = read(f).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
    for (const secret of ['phone', 'email', 'nes_number', 'iepn_status', 'expert_files', 'storage_path', 'verification_status', 'review_message', 'discoverable']) {
      // the visible sentence "Phone numbers, email addresses and documents are never shown" is allowed
      const withoutNotice = code.replace(/Phone numbers, email addresses and documents are never shown[^.<`'"]*/g, '')
      assert.ok(!new RegExp(`\\b${secret}\\b`, 'i').test(withoutNotice), `${f} mentions ${secret}`)
    }
  }
})

test('only listed experts are offered to search engines, and everything else says noindex', () => {
  const profile = read('src/pages/ExpertProfile.tsx')
  assert.equal((profile.match(/'index, follow'/g) ?? []).length, 1, 'index only in the listed branch')
  assert.ok(profile.indexOf("'index, follow'") < profile.indexOf("'noindex, follow'"))
  assert.match(profile, /profile\s*\?/, 'the index branch is the one that has a profile')
  const robots = read('public/robots.txt')
  assert.match(robots, /Disallow: \/admin/)
  assert.match(robots, /Disallow: \/verify/)
  assert.doesNotMatch(robots, /Disallow: \/experts/)
})

test('a malformed Expert ID never reaches the network, so it is "not found" at once', () => {
  const api = read('src/lib/directory.ts')
  assert.match(api, /EXPERT_ID_PATTERN\.test\(expertId\)\)\s*return \{ ok: true, profile: null \}/)
  assert.match(read('src/pages/ExpertProfile.tsx'), /if \(!valid\) return/)
})

test('profile links only open as web links, in a new tab, without passing on the referrer', () => {
  const page = read('src/pages/ExpertProfile.tsx')
  assert.match(page, /safeProfileUrl\(/)
  assert.match(page, /rel="noopener noreferrer nofollow"/)
})

// ---------- The database changes are additive and closed to the public ----------

test('the Phase 3 migration only adds: nothing is dropped, truncated or altered, and no existing policy is touched', () => {
  const sql = read(MIGRATION)
  const code = sql.replace(/--.*$/gm, '')
  assert.doesNotMatch(code, /\bdrop\s+(table|column|policy|function|index|trigger|constraint|schema)\b/i)
  assert.doesNotMatch(code, /^\s*truncate\b/im, 'no TRUNCATE statements (the trigger clause "before truncate" is fine)')
  assert.doesNotMatch(code, /alter\s+column/i)
  assert.doesNotMatch(code, /alter\s+table\s+public\.experts\s+(drop|alter|rename)/i)
  assert.doesNotMatch(code, /create\s+policy[^;]*on\s+public\.experts/i)
  assert.doesNotMatch(code, /delete\s+from\s+public\.experts\b/i)
  // The only thing written to an expert's row is their own listing choice, for the signed in expert.
  const updates = [...code.matchAll(/update\s+public\.experts\b([^;]*);/gi)].map((m) => m[1].replace(/\s+/g, ' ').trim())
  assert.deepEqual(updates, ['set discoverable = p_value, discoverable_updated_at = now() where expert_id = p_expert_id'])
  // Every change to an existing table is "add column if not exists".
  const alters = [...code.matchAll(/alter\s+table\s+public\.(\w+)\s+([^;]+);/gi)].filter((m) => !/enable row level security/i.test(m[2]))
  for (const m of alters) assert.match(m[2], /^add column if not exists/i, `${m[1]}: ${m[2]}`)
})

test('the public (anon) role can run exactly the two directory functions and nothing else in the new migration', () => {
  const code = read(MIGRATION).replace(/--.*$/gm, '')
  const grants = [...code.matchAll(/grant\s+[^;]*?\s+to\s+([^;]+);/gi)]
  const toAnon = grants.filter((g) => /\banon\b/.test(g[1]))
  assert.equal(toAnon.length, 2)
  for (const g of toAnon) assert.match(g[0], /public\.directory_(search|profile)\(/)
  assert.doesNotMatch(code, /grant\s+select[^;]*on\s+public\.(opportunities|opportunity_interest)\b/i, 'no table grants to API roles')
})

test('every new table is locked down: row level security on, nothing granted to anon', () => {
  const code = read(MIGRATION).replace(/--.*$/gm, '')
  for (const t of ['opportunities', 'opportunity_interest', 'opportunity_audit']) {
    assert.match(code, new RegExp(`alter table public\\.${t} enable row level security`), t)
  }
  assert.match(code, /revoke all on public\.opportunities, public\.opportunity_interest, public\.opportunity_audit from anon, authenticated/)
})

test('the directory shows only Verified AND discoverable experts, in both functions', () => {
  const code = read(MIGRATION).replace(/--.*$/gm, '')
  const search = code.slice(code.indexOf('function public.directory_search'), code.indexOf('function public.directory_profile'))
  const profile = code.slice(code.indexOf('function public.directory_profile'), code.indexOf('revoke all on function public.directory_search'))
  for (const [name, body] of [['search', search], ['profile', profile]]) {
    assert.match(body, /verification_status = 'verified'/, name)
    assert.match(body, /discoverable is true/, name)
    assert.doesNotMatch(body, /e\.(email|phone|nes_number|iepn_status|evidence_consent_at|reviewed_by|review_message|consent_at)\b/, `${name} must not return private columns`)
  }
})

test('admin functions check the allow-list first, and expert functions are for the service role only', () => {
  const code = read(MIGRATION).replace(/--.*$/gm, '')
  for (const fn of ['admin_save_opportunity', 'admin_delete_opportunity', 'admin_list_opportunities', 'admin_opportunity_interest', 'admin_opportunity_log']) {
    const body = code.slice(code.indexOf(`function public.${fn}`))
    const firstIf = body.slice(body.indexOf('begin'), body.indexOf('begin') + 120)
    assert.match(firstIf, /if not public\.is_admin\(\)/, fn)
  }
  assert.match(code, /grant execute on function public\.portal_list_opportunities\(text\), public\.portal_set_interest\(text, uuid, boolean\) to service_role/)
  assert.match(code, /grant execute on function public\.portal_set_discoverable\(text, boolean\) to service_role/)
})

test('interest needs a Verified expert and an open, unexpired opportunity, and the admin is told once', () => {
  const code = read(MIGRATION).replace(/--.*$/gm, '')
  assert.match(code, /if v_status <> 'verified' then\s+raise exception 'not_verified'/)
  assert.match(code, /v_opp\.status <> 'open' or v_opp\.deadline < public\.nigeria_today\(\)/)
  assert.match(code, /'opportunity_interest', p_opportunity_id::text/)
  assert.match(code, /on conflict do nothing/)
})

test('the opportunity log is append only and records every admin change', () => {
  const code = read(MIGRATION).replace(/--.*$/gm, '')
  assert.match(code, /before update or delete on public\.opportunity_audit/)
  assert.match(code, /before truncate on public\.opportunity_audit/)
  for (const action of ['created', 'published', 'closed', 'reopened', 'set_to_draft', 'updated', 'deleted']) {
    assert.match(code, new RegExp(`'${action}'`), action)
  }
  assert.ok((code.match(/insert into public\.opportunity_audit/g) ?? []).length >= 5)
})

// ---------- The expert portal only ever acts on the signed in expert ----------

test('directory choice and interest use the session expert, never an ID sent by the browser', () => {
  const fn = read('supabase/functions/expert-portal/index.ts')
  for (const rpcName of ['portal_set_discoverable', 'portal_list_opportunities', 'portal_set_interest']) {
    const call = fn.slice(fn.indexOf(`'${rpcName}'`), fn.indexOf(`'${rpcName}'`) + 140)
    assert.match(call, /p_expert_id: expertId/, rpcName)
    assert.doesNotMatch(call, /body\.expert_id/, rpcName)
  }
  assert.match(fn, /typeof body\.value !== 'boolean'/)
})

test('phase 3 actions sit behind the session check', () => {
  const fn = read('supabase/functions/expert-portal/index.ts')
  assert.ok(fn.indexOf("action === 'set_discoverable'") > fn.indexOf("'session_expired'"))
  assert.ok(fn.indexOf("action === 'interest'") > fn.indexOf("'session_expired'"))
  assert.ok(fn.indexOf("action === 'opportunities'") > fn.indexOf("'session_expired'"))
})

// ---------- Existing behaviour is kept ----------

test('registration does not depend on any Phase 3 code, so it cannot be slowed or broken by it', () => {
  for (const f of ['src/pages/Register.tsx', 'src/pages/Registered.tsx', 'src/lib/form.ts', 'src/lib/api.ts']) {
    assert.doesNotMatch(read(f), /lib\/(directory|directoryFilters|opportunities|meta)\b|ListingCard|OpportunitiesSection|admin_save_opportunity|directory_search/, f)
  }
})

test('the admin keeps its Registrations and Verification tabs and adds Opportunities', () => {
  const area = read('src/pages/admin/AdminArea.tsx')
  assert.match(area, />Registrations</)
  assert.match(area, />Verification</)
  assert.match(area, />Opportunities</)
  assert.match(area, /flex flex-wrap gap-1/, 'three tabs must wrap on a 360 px phone')
})

test('verified experts see opportunities first, everyone else keeps the evidence steps first', () => {
  const page = read('src/pages/VerifyDashboard.tsx')
  const verifiedBlock = page.indexOf("status === 'verified' && (")
  const evidence = page.indexOf('{/* Evidence */}')
  const others = page.indexOf("status !== 'verified' && (")
  assert.ok(verifiedBlock > 0 && verifiedBlock < evidence && evidence < others)
})

test('no em or en dashes in any new copy', () => {
  const dash = new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`)
  for (const f of NEW_COPY_FILES) assert.ok(!dash.test(read(f)), f)
  assert.ok(!dash.test(read('public/robots.txt')))
})
