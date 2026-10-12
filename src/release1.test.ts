import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { EMPTY_FILTERS, filtersFromParams, paramsFromFilters, searchArgs, activeFilterCount } from './lib/directoryFilters.ts'
import { en } from './i18n/en.ts'
import { LOCALES } from './i18n/locales.ts'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')
const sql = read('supabase/migrations/20261018000001_search_filters.sql')

test('the new filters live in the address bar, and nonsense is ignored', () => {
  const id = '0b1c2d3e-aaaa-bbbb-cccc-1234567890ab'
  const f = filtersFromParams(new URLSearchParams(`consulting=limited&body=${id}&ngo=${id.toUpperCase()}`))
  assert.equal(f.consulting, 'limited')
  assert.equal(f.body, id)
  assert.equal(f.ngo, id)
  assert.deepEqual(paramsFromFilters(f), { consulting: 'limited', body: id, ngo: id })
  const bad = filtersFromParams(new URLSearchParams('consulting=always&body=NES&ngo=1%3Bdrop%20table'))
  assert.equal(bad.consulting, '')
  assert.equal(bad.body, '')
  assert.equal(bad.ngo, '')
  assert.equal(activeFilterCount(f), 3)
})

test('the search sends the new filters to the database, and nothing when they are off', () => {
  const id = '0b1c2d3e-aaaa-bbbb-cccc-1234567890ab'
  const on = searchArgs({ ...EMPTY_FILTERS, consulting: 'available', body: id })
  assert.equal(on.p_consulting, 'available')
  assert.equal(on.p_body, id)
  assert.equal(on.p_ngo, null)
  const off = searchArgs(EMPTY_FILTERS)
  assert.deepEqual([off.p_consulting, off.p_body, off.p_ngo], [null, null, null])
})

test('the migration is additive: nothing existing is dropped except the superseded search function', () => {
  assert.doesNotMatch(sql, /\bdrop\s+(table|column|schema|policy\s+(?!if exists experts_public_listed))/i)
  assert.doesNotMatch(sql, /\btruncate\b|\bdelete\s+from\b/i)
  const drops = [...sql.matchAll(/drop function if exists ([^;]+);/g)].map((m) => m[1])
  assert.equal(drops.length, 1)
  assert.match(drops[0], /directory_search\(text, text, text, text, text, text, text, text, text, int, int, text\)$/)
  assert.match(sql, /add column if not exists consulting_availability/)
})

test('the new search arguments sit at the end, so older calls keep working', () => {
  const start = sql.indexOf('create or replace function public.directory_search(')
  const sig = sql.slice(start, sql.indexOf('returns jsonb', start))
  assert.ok(sig.indexOf('p_country') < sig.indexOf('p_consulting'))
  assert.ok(sig.indexOf('p_consulting') < sig.indexOf('p_body') && sig.indexOf('p_body') < sig.indexOf('p_ngo'))
  assert.match(sig, /p_ngo uuid default null/)
})

test('discoverability is enforced in the database: a policy for Verified and discoverable only, on public columns only', () => {
  assert.match(sql, /create policy experts_public_listed on public\.experts for select to anon\s+using \(verification_status = 'verified' and discoverable is true\)/)
  const grant = sql.slice(sql.indexOf('grant select ('), sql.indexOf('on public.experts to anon'))
  for (const secret of ['email', 'phone', 'nes_number', 'iepn_status', 'profile_url', 'review_message', 'evidence_consent_at', 'consent_contact', 'reviewed_by']) {
    assert.ok(!new RegExp(`\\b${secret}\\b`).test(grant), `${secret} must not be readable by the public role`)
  }
  // And the search itself repeats the rule.
  const fn = sql.slice(sql.indexOf('create or replace function public.directory_search('))
  assert.match(fn, /e\.verification_status = 'verified'\s+and e\.discoverable is true/)
})

test('affiliations are searchable only when the expert made them public, and only approved institutions count', () => {
  const body = sql.slice(sql.indexOf('and (p_body is null'), sql.indexOf('),\n  ranked'))
  assert.equal((body.match(/e\.affiliations_public/g) ?? []).length, 2)
  assert.equal((body.match(/i\.status = 'approved'/g) ?? []).length, 2)
  assert.doesNotMatch(sql.slice(sql.indexOf('create or replace function public.directory_search(')), /membership_number|licence_status/)
})

test('search is quick: trigram indexes for the words, partial indexes for the filters', () => {
  assert.match(sql, /gin_trgm_ops/)
  for (const col of ['full_name', 'organisation', '"position"']) assert.ok(sql.includes(`(${col} extensions.gin_trgm_ops)`), col)
  assert.match(sql, /experts_listed_filters_idx/)
})

test('the portal can only set a known consulting value, and only the server role may call it', () => {
  assert.match(sql, /p_value not in \('available', 'limited', 'not_available'\)/)
  assert.match(sql, /grant execute on function public\.portal_set_consulting\(text, text\) to service_role/)
  const fn = read('supabase/functions/expert-portal/index.ts')
  assert.match(fn, /action === 'set_consulting'/)
  assert.match(fn, /\['available', 'limited', 'not_available'\]\.includes/)
})

test('the new texts exist in every language', () => {
  assert.ok(en.dashboard.consulting.title && en.directory.filterLabels.ngo && en.options.consulting.not_available)
  for (const l of LOCALES) assert.ok(fs.existsSync(path.join(root, `src/i18n/${l.code}.ts`)), l.code)
})

test('the directory never shows contact details, numbers or evidence', () => {
  const page = read('src/pages/Directory.tsx') + read('src/pages/ExpertProfile.tsx')
  assert.doesNotMatch(page, /\.email|\.phone|nes_number|membership_number|licence/)
})
