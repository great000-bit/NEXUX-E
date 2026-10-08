import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activeFilterCount, displayName, EMPTY_FILTERS, EXPERT_ID_PATTERN, filtersFromParams, hasAnyFilter, linkLabel,
  MAX_QUERY_LENGTH, pageCount, PAGE_SIZE, paramsFromFilters, safeProfileUrl, searchArgs,
} from './directoryFilters.ts'

const parse = (qs: string) => filtersFromParams(new URLSearchParams(qs))

test('no address parameters means the plain first page, sorted by name', () => {
  assert.deepEqual(parse(''), EMPTY_FILTERS)
  assert.deepEqual(paramsFromFilters(EMPTY_FILTERS), {})
})

test('filters survive a round trip through the address bar', () => {
  const f = { ...EMPTY_FILTERS, q: 'wetland', state: 'Lagos', expertise: 'ESIA and Safeguards', sort: 'experience' as const, page: 3 }
  const back = parse(new URLSearchParams(paramsFromFilters(f)).toString())
  assert.deepEqual(back, f)
})

test('values that are not on the lists are ignored, so the address bar cannot inject anything', () => {
  const f = parse('state=Mars&expertise=%27%3B%20drop%20table&years=100&sort=password&membership=Other')
  assert.equal(f.state, '')
  assert.equal(f.expertise, '')
  assert.equal(f.years, '')
  assert.equal(f.sort, 'name')
  assert.equal(f.membership, '')
})

test('page numbers must be sensible, and search words are tidied and capped', () => {
  for (const bad of ['0', '-4', 'abc', '99999', '2.5e9', '']) {
    assert.ok(parse(`page=${bad}`).page >= 1 && parse(`page=${bad}`).page <= 1000)
  }
  assert.equal(parse('page=-4').page, 1)
  assert.equal(parse('page=abc').page, 1)
  assert.equal(parse('page=99999').page, 1)
  assert.equal(parse('page=7').page, 7)
  assert.equal(parse('q=%20%20Ada%20%20%20Obi%20').q, 'Ada Obi')
  assert.equal(parse(`q=${'x'.repeat(500)}`).q.length, MAX_QUERY_LENGTH)
})

test('the database call asks for one page at a time and only sends what was chosen', () => {
  const args = searchArgs({ ...EMPTY_FILTERS, state: 'Kano', page: 3 })
  assert.equal(args.p_limit, PAGE_SIZE)
  assert.equal(args.p_offset, 2 * PAGE_SIZE)
  assert.equal(args.p_state, 'Kano')
  assert.equal(args.p_q, null)
  assert.equal(args.p_expertise, null)
  assert.equal(args.p_sort, 'name')
})

test('counting filters leaves out the search words, sort and page', () => {
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, q: 'x', sort: 'newest', page: 2 }), 0)
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, state: 'Lagos', years: '30+' }), 2)
  assert.equal(hasAnyFilter({ ...EMPTY_FILTERS, q: 'x' }), true)
  assert.equal(hasAnyFilter(EMPTY_FILTERS), false)
})

test('page count never drops below one', () => {
  assert.equal(pageCount(0), 1)
  assert.equal(pageCount(PAGE_SIZE), 1)
  assert.equal(pageCount(PAGE_SIZE + 1), 2)
})

test('names: the title is used, except for Other or when the name already starts with it', () => {
  assert.equal(displayName('Dr', 'Ada Obi'), 'Dr Ada Obi')
  assert.equal(displayName('Other', 'Ada Obi'), 'Ada Obi')
  assert.equal(displayName('Dr', 'Dr Ada Obi'), 'Dr Ada Obi')
  assert.equal(displayName('Prof', '  Ada   Obi '), 'Prof Ada Obi')
})

test('a profile link is only ever a web link', () => {
  assert.equal(safeProfileUrl('https://www.linkedin.com/in/ada'), 'https://www.linkedin.com/in/ada')
  assert.equal(safeProfileUrl('http://example.org'), 'http://example.org/')
  assert.equal(safeProfileUrl('javascript:alert(1)'), null)
  assert.equal(safeProfileUrl('data:text/html,hi'), null)
  assert.equal(safeProfileUrl('not a url'), null)
  assert.equal(safeProfileUrl(null), null)
  assert.equal(linkLabel('https://www.linkedin.com/in/ada'), 'linkedin.com/in/ada')
})

test('only real Expert IDs reach the database', () => {
  assert.ok(EXPERT_ID_PATTERN.test('NEX-000042'))
  for (const bad of ['nex-000042', 'NEX-42', 'NEX-0000420', "NEX-000042'--", '', 'NEX-00004a']) {
    assert.ok(!EXPERT_ID_PATTERN.test(bad), bad)
  }
})
