// Turns supabase/seed/institutions.json into the seed migration. Run: node scripts/build-institutions-seed.mjs
// Every seeded record is "unverified": the client's document says current legal status must be confirmed first.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const seed = JSON.parse(fs.readFileSync(path.join(root, 'supabase', 'seed', 'institutions.json'), 'utf8'))
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)

const rows = seed.map(
  (s) => `  (${q(s.name)}, ${q(s.acronym)}, ${q(s.country)}, ${q(s.coverage)}, ${q(s.category)}, ${q(s.specialisation)}, ${q(s.evidence_source)})`,
)

const sql = `-- Seeds the institutions table from the client's institutional directory (October 2026), plus the bodies the developer
-- brief names that the document lacks (IAIA). ${seed.length} records.
--
-- Every record is approved (so it can be chosen in the registration form) and UNVERIFIED: the document says current legal
-- status, official contacts and membership claims must be confirmed before use. No website or contact is stored because
-- the document gives none. Safe to re-run: a record that already exists (same name and country) is left as it is.

insert into public.institutions (name, acronym, country, coverage, category, specialisation, evidence_source, verification_status, status)
select v.name, v.acronym, v.country, v.coverage, v.category, v.specialisation, v.evidence_source, 'unverified', 'approved'
from (values
${rows.join(',\n')}
) as v(name, acronym, country, coverage, category, specialisation, evidence_source)
on conflict ((lower(name)), (coalesce(country, ''))) do nothing;
`
const out = path.join(root, 'supabase', 'migrations', '20261016000002_institutions_seed.sql')
fs.writeFileSync(out, sql)
console.log('wrote', out, seed.length, 'records')
