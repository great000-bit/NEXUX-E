// Pure helpers for the public directory: which filters exist, how they live in the address bar,
// and how a person's name and links are shown. No network and no browser APIs, so tests can run them.
import { ASSIGNMENTS, AVAILABILITY, EXPERTISE, MEMBERSHIPS, QUALIFICATIONS, STATES, YEARS } from './options'

export const PAGE_SIZE = 12

export const SORTS = [
  { value: 'name', label: 'Name, A to Z' },
  { value: 'experience', label: 'Most experience first' },
  { value: 'newest', label: 'Recently verified first' },
] as const
export type Sort = (typeof SORTS)[number]['value']

export type Filters = {
  q: string
  expertise: string
  state: string
  qualification: string
  years: string
  membership: string
  assignment: string
  availability: string
  sort: Sort
  page: number
}

export const EMPTY_FILTERS: Filters = {
  q: '',
  expertise: '',
  state: '',
  qualification: '',
  years: '',
  membership: '',
  assignment: '',
  availability: '',
  sort: 'name',
  page: 1,
}

/** Each filter and the list of values it may hold. Anything else in the address bar is ignored. */
export const FILTER_OPTIONS = {
  expertise: EXPERTISE,
  state: STATES,
  qualification: QUALIFICATIONS,
  years: YEARS,
  membership: MEMBERSHIPS,
  assignment: ASSIGNMENTS,
  availability: AVAILABILITY,
} as const

export type FilterKey = keyof typeof FILTER_OPTIONS
export const FILTER_KEYS = Object.keys(FILTER_OPTIONS) as FilterKey[]

export const MAX_QUERY_LENGTH = 80

const isOneOf = (list: readonly string[], v: string) => list.includes(v)

/** Reads the address bar. Unknown values and nonsense page numbers fall back to the defaults. */
export function filtersFromParams(params: URLSearchParams): Filters {
  const f: Filters = { ...EMPTY_FILTERS }
  f.q = (params.get('q') ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH)
  for (const key of FILTER_KEYS) {
    const v = params.get(key) ?? ''
    if (isOneOf(FILTER_OPTIONS[key], v)) f[key] = v
  }
  const sort = params.get('sort') ?? ''
  if (SORTS.some((s) => s.value === sort)) f.sort = sort as Sort
  const page = Number.parseInt(params.get('page') ?? '1', 10)
  f.page = Number.isFinite(page) && page >= 1 && page <= 1000 ? page : 1
  return f
}

/** Only values that differ from the defaults go in the address, so links stay short. */
export function paramsFromFilters(f: Filters): Record<string, string> {
  const out: Record<string, string> = {}
  if (f.q) out.q = f.q
  for (const key of FILTER_KEYS) if (f[key]) out[key] = f[key]
  if (f.sort !== 'name') out.sort = f.sort
  if (f.page > 1) out.page = String(f.page)
  return out
}

/** How many filters (not counting the search words, sort or page) are switched on. */
export function activeFilterCount(f: Filters): number {
  return FILTER_KEYS.filter((k) => f[k]).length
}

export const hasAnyFilter = (f: Filters) => Boolean(f.q) || activeFilterCount(f) > 0

export const pageCount = (total: number) => Math.max(1, Math.ceil(total / PAGE_SIZE))

/** The arguments of the database function that searches the directory. */
export function searchArgs(f: Filters) {
  return {
    p_q: f.q || null,
    p_expertise: f.expertise || null,
    p_state: f.state || null,
    p_qualification: f.qualification || null,
    p_years: f.years || null,
    p_membership: f.membership || null,
    p_assignment: f.assignment || null,
    p_availability: f.availability || null,
    p_sort: f.sort,
    p_limit: PAGE_SIZE,
    p_offset: (f.page - 1) * PAGE_SIZE,
  }
}

export const EXPERT_ID_PATTERN = /^NEX-\d{6}$/

/** "Dr Ada Obi". The title is left out when it is "Other" or the name already begins with it. */
export function displayName(title: string, fullName: string): string {
  const name = fullName.trim().replace(/\s+/g, ' ')
  const t = title.trim()
  if (!t || t.toLowerCase() === 'other') return name
  return name.toLowerCase().startsWith(`${t.toLowerCase()} `) ? name : `${t} ${name}`
}

/** Only web links are ever turned into a link on a profile. */
export function safeProfileUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? u.toString() : null
  } catch {
    return null
  }
}

/** "linkedin.com/in/ada" for showing on the page. */
export function linkLabel(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`.slice(0, 60)
  } catch {
    return url.slice(0, 60)
  }
}
