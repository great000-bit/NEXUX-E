import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { Notice, Spinner } from '../components/ui'
import { searchExperts, type Listing } from '../lib/directory'
import {
  activeFilterCount, displayName, FILTER_KEYS, FILTER_OPTIONS, filtersFromParams, hasAnyFilter,
  MAX_QUERY_LENGTH, pageCount, paramsFromFilters, PAGE_SIZE, SORTS, type FilterKey, type Filters, type Sort,
} from '../lib/directoryFilters'
import { usePageMeta } from '../lib/meta'

const FILTER_LABEL: Record<FilterKey, string> = {
  expertise: 'Expertise',
  state: 'State',
  qualification: 'Highest qualification',
  years: 'Years of experience',
  membership: 'Professional membership',
  assignment: 'Open to assignments in',
  availability: 'Geographic availability',
}

type Loaded = { key: string; ok: true; total: number; items: Listing[] } | { key: string; ok: false; message: string }

export default function Directory() {
  const [params, setParams] = useSearchParams()
  const filters = filtersFromParams(params)
  // The address bar is the single source of truth, so the Back button and shared links just work.
  const key = params.toString()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [retry, setRetry] = useState(0)
  const [showFilters, setShowFilters] = useState(() => activeFilterCount(filters) > 0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRun = useRef(true)

  const plain = !hasAnyFilter(filters) && filters.page === 1 && filters.sort === 'name'
  usePageMeta({
    title: 'Find a Verified Expert | NEXUS-E',
    description:
      'Search verified Nigerian environmental professionals by expertise, state, qualification and availability. Every expert listed here has been verified and has chosen to be listed.',
    robots: plain ? 'index, follow' : 'noindex, follow',
    path: '/experts',
  })

  useEffect(() => {
    let live = true
    searchExperts(filtersFromParams(new URLSearchParams(key))).then((res) => {
      if (live) setLoaded({ key, ...res })
    })
    return () => {
      live = false
    }
  }, [key, retry])

  // A link to a page past the end (an old bookmark, or experts who left the list) lands on the last real page.
  const lastPage = loaded?.key === key && loaded.ok ? pageCount(loaded.total) : null
  useEffect(() => {
    if (lastPage !== null && filters.page > lastPage) {
      setParams(paramsFromFilters({ ...filters, page: lastPage }), { replace: true })
    }
  }, [lastPage, filters, setParams])

  // After the person changes page, bring the top of the results into view for screen readers and thumbs.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    if (loaded?.key === key) headingRef.current?.focus({ preventScroll: false })
  }, [loaded, key])

  const apply = (next: Partial<Filters>, resetPage = true) => {
    const merged = { ...filters, ...next, page: resetPage ? 1 : (next.page ?? filters.page) }
    setParams(paramsFromFilters(merged))
  }

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const typed = String(new FormData(e.currentTarget).get('q') ?? '')
    apply({ q: typed.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH) })
  }

  const clearAll = () => setParams({})

  const current = loaded && loaded.key === key ? loaded : null
  const total = current?.ok ? current.total : 0
  const pages = pageCount(total)
  const from = (filters.page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, filters.page * PAGE_SIZE)
  const n = activeFilterCount(filters)

  return (
    <div>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">NEXUS-E directory</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-semibold text-green-900 outline-none sm:text-4xl">
          Find a Verified Expert
        </h1>
        <p className="mt-2 max-w-xl text-ink-700">
          Every expert here has had their credentials checked and has chosen to be listed. Phone numbers, email addresses and documents are never shown.
        </p>
      </header>

      <form role="search" onSubmit={submit} className="mt-6 space-y-3" aria-label="Search the directory">
        <div>
          <label htmlFor="directory-q" className="field-label">Search by name, organisation or expertise</label>
          <div className="flex gap-2">
            <input
              key={filters.q}
              id="directory-q"
              name="q"
              type="search"
              className="input min-w-0 flex-1"
              defaultValue={filters.q}
              maxLength={MAX_QUERY_LENGTH}
              autoComplete="off"
              enterKeyHint="search"
              placeholder="For example: Ada, wetlands, Lagos"
            />
            <button type="submit" className="btn btn-primary flex-none !px-5">Search</button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-ghost !min-h-11 !px-4"
            aria-expanded={showFilters}
            aria-controls="directory-filters"
            onClick={() => setShowFilters((v) => !v)}
          >
            {showFilters ? 'Hide filters' : 'Filters'}
            {n > 0 && <span className="ml-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">{n}</span>}
          </button>
          {hasAnyFilter(filters) && (
            <button type="button" className="min-h-11 rounded-full px-4 text-sm font-bold text-green-800 underline underline-offset-4" onClick={clearAll}>
              Clear everything
            </button>
          )}
          <div className="ml-auto flex items-center gap-2">
            <label htmlFor="directory-sort" className="text-sm font-bold text-ink-700">Sort</label>
            <select
              id="directory-sort"
              className="input !w-auto !py-2"
              value={filters.sort}
              onChange={(e) => apply({ sort: e.target.value as Sort })}
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
        </div>

        {showFilters && (
          <div id="directory-filters" className="card grid gap-4 p-4 sm:grid-cols-2" style={{ borderRadius: 'var(--radius-lg)' }}>
            {FILTER_KEYS.map((k) => (
              <div key={k}>
                <label htmlFor={`directory-${k}`} className="field-label">{FILTER_LABEL[k]}</label>
                <select
                  id={`directory-${k}`}
                  className="input"
                  value={filters[k]}
                  onChange={(e) => apply({ [k]: e.target.value })}
                >
                  <option value="">Any</option>
                  {FILTER_OPTIONS[k].map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </form>

      <section className="mt-6" aria-labelledby="results-title" aria-busy={!current}>
        <h2 id="results-title" className="sr-only">Results</h2>
        <p className="text-sm font-semibold text-ink-700" role="status" aria-live="polite">
          {!current && 'Searching...'}
          {current?.ok && (total === 0 ? 'No experts found.' : `Showing ${from} to ${to} of ${total} ${total === 1 ? 'expert' : 'experts'}`)}
        </p>

        {!current && (
          <div className="grid place-items-center py-14 text-green-800"><Spinner label="Searching the directory" className="h-8 w-8" /></div>
        )}

        {current && !current.ok && (
          <div className="mt-3 space-y-3">
            <Notice title="The directory did not load">{current.message}</Notice>
            <button className="btn btn-primary" onClick={() => setRetry((r) => r + 1)}>Try again</button>
          </div>
        )}

        {current?.ok && total === 0 && (
          <div className="card mt-3 p-8 text-center">
            <h3 className="text-xl font-semibold text-green-900">
              {hasAnyFilter(filters) ? 'Nobody matches those choices' : 'No experts are listed yet'}
            </h3>
            <p className="mt-2 text-ink-700">
              {hasAnyFilter(filters)
                ? 'Try fewer filters, or a shorter search word.'
                : 'Experts appear here once they are verified and have chosen to be listed. Please check back soon.'}
            </p>
            {hasAnyFilter(filters) && (
              <button className="btn btn-ghost mt-4" onClick={clearAll}>Clear everything</button>
            )}
          </div>
        )}

        {current?.ok && total > 0 && (
          <ul className="mt-3 space-y-3">
            {current.items.map((e) => (
              <li key={e.expert_id}>
                <Link
                  to={`/experts/${e.expert_id}`}
                  className="card block p-4 transition hover:border-green-600 sm:p-5"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-lg font-semibold text-green-900">{displayName(e.title, e.full_name)}</p>
                    <VerifiedBadge />
                  </div>
                  <p className="mt-0.5 break-words text-sm text-ink-700">{e.position}, {e.organisation}</p>
                  <p className="mt-2 text-sm font-semibold text-ink-900">{e.primary_expertise}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {e.state} · {e.years_experience} years · {e.qualification}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {current?.ok && pages > 1 && (
          <nav aria-label="Pages of results" className="mt-6 flex items-center justify-between gap-3">
            <button
              className="btn btn-ghost !min-h-11"
              disabled={filters.page <= 1}
              onClick={() => apply({ page: filters.page - 1 }, false)}
            >
              Previous<span className="sr-only"> page</span>
            </button>
            <p className="text-sm font-semibold text-ink-700">Page {filters.page} of {pages}</p>
            <button
              className="btn btn-ghost !min-h-11"
              disabled={filters.page >= pages}
              onClick={() => apply({ page: filters.page + 1 }, false)}
            >
              Next<span className="sr-only"> page</span>
            </button>
          </nav>
        )}
      </section>
    </div>
  )
}
