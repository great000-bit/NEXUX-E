import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { EXPERTISE } from './lib/options.ts'
import { FILTER_OPTIONS } from './lib/directoryFilters.ts'
import { validateOpportunity } from './lib/opportunities.ts'

// The expertise sectors: one list in the code, one matching check in the database.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

const ORIGINAL = [
  'ESIA and Safeguards', 'Biodiversity and Ecosystems', 'Water and Hydrogeology', 'Geology and Earth Sciences',
  'Climate Change and Carbon', 'Social and Economic Studies', 'Gender and Inclusion', 'Pollution and Environmental Quality',
  'GIS and Remote Sensing', 'Marine and Blue Economy', 'Environmental Engineering', 'Policy, Governance and Regulation',
  'ESG and Sustainability', 'Occupational and Community Health', 'Other Specialised Expertise',
]
const ADDED = ['Environmental Educator', 'Environmental IT', 'Environmental Media']

test('the list keeps the original fifteen sectors in their order and ends with the three new ones', () => {
  assert.equal(EXPERTISE.length, 18)
  assert.deepEqual([...EXPERTISE].slice(0, 15), ORIGINAL)
  assert.deepEqual([...EXPERTISE].slice(15), ADDED)
  assert.equal(new Set(EXPERTISE).size, 18, 'no repeats')
})

test('the directory filter offers every sector, including the new ones', () => {
  assert.deepEqual([...FILTER_OPTIONS.expertise], [...EXPERTISE])
  for (const s of ADDED) assert.ok(FILTER_OPTIONS.expertise.includes(s as never), s)
})

test('the registration form, admin filter, opportunity editor and home page all read the one list', () => {
  assert.match(read('src/pages/Register.tsx'), /options=\{EXPERTISE\}/)
  assert.match(read('src/pages/Register.tsx'), /options=\{EXPERTISE\.filter/)
  assert.match(read('src/pages/admin/Dashboard.tsx'), /options=\{EXPERTISE\}/)
  assert.match(read('src/pages/admin/OpportunityEdit.tsx'), /options=\{EXPERTISE\}/)
  assert.match(read('src/pages/home/HomeSections.tsx'), /EXPERTISE\.map/)
  // No second hard-coded copy of a sector name in the app source, apart from the list and the icon map.
  for (const f of ['src/pages/Register.tsx', 'src/pages/admin/Dashboard.tsx', 'src/lib/directoryFilters.ts', 'src/pages/admin/csv.ts']) {
    for (const s of ADDED) assert.ok(!read(f).includes(s), `${f} must not hard-code ${s}`)
  }
})

test('the database check on opportunities lists the same eighteen sectors, in a migration that only widens it', () => {
  const sql = read('supabase/migrations/20261013000001_more_expertise_sectors.sql')
  for (const s of EXPERTISE) assert.ok(sql.includes(`'${s}'`), `${s} is in the migration`)
  assert.match(sql, /cardinality\(expertise_needed\) between 1 and 18/)
  assert.doesNotMatch(sql, /\b(delete|truncate|update|drop table|drop column)\b/i, 'no destructive statements')
  assert.match(sql, /drop constraint if exists opportunities_expertise_needed_check/)
  // The migration's list is exactly the app's list, nothing more.
  const inList = [...sql.slice(sql.indexOf('array[')).matchAll(/'([^']+)'/g)].map((m) => m[1])
  assert.deepEqual(inList, [...EXPERTISE])
})

test('an opportunity can ask for the new sectors, and still cannot ask for an unknown one', () => {
  const base = { title: 'Wetland survey', description: 'A short description of the work to be done here.', opp_type: 'Consulting', location: 'Lagos', deadline: '2099-01-01', status: 'draft' }
  const ok = validateOpportunity({ ...base, expertise_needed: ['Environmental IT', 'Environmental Media', 'Environmental Educator'] } as never)
  assert.equal((ok as Record<string, string>).expertise_needed, undefined)
  const bad = validateOpportunity({ ...base, expertise_needed: ['Astrology'] } as never)
  assert.ok((bad as Record<string, string>).expertise_needed)
})
