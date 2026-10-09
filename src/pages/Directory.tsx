import '../i18n/enSite'
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
import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'

/** Which group of translated labels each filter's stored values belong to. */
const FILTER_GROUP: Record<FilterKey, string | null> = {
  expertise: 'expertise',
  country: 'countries',
  state: null,
  qualification: 'qualifications',
  years: 'years',
  membership: 'memberships',
  assignment: 'assignments',
  availability: 'availability',
}

type Loaded = { key: string; ok: true; total: number; items: Listing[] } | { key: string; ok: false; message: string }

export default function Directory() {
  const m = useMessages()
  const t = m.directory
  const label = (group: string | null, value: string) =>
    group ? ((m.options as Record<string, Record<string, string>>)[group]?.[value] ?? value) : value
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
    title: t.pageTitle,
    description: t.pageDescription,
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
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">{t.eyebrow}</p>
        <h1 ref={headingRef} tabIndex={-1} className="mt-1 text-3xl font-semibold text-green-900 outline-none sm:text-4xl">
          {t.title}
        </h1>
        <p className="mt-2 max-w-xl text-ink-700">{t.intro}</p>
      </header>

      <form role="search" onSubmit={submit} className="mt-6 space-y-3" aria-label={t.searchAria}>
        <div>
          <label htmlFor="directory-q" className="field-label">{t.searchLabel}</label>
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
              placeholder={t.placeholder}
            />
            <button type="submit" className="btn btn-primary flex-none !px-5">{t.search}</button>
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
            {showFilters ? t.hideFilters : t.filters}
            {n > 0 && <span className="ms-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">{n}</span>}
          </button>
          {hasAnyFilter(filters) && (
            <button type="button" className="min-h-11 rounded-full px-4 text-sm font-bold text-green-800 underline underline-offset-4" onClick={clearAll}>
              {t.clear}
            </button>
          )}
          <div className="ms-auto flex min-w-0 max-w-full items-center gap-2">
            <label htmlFor="directory-sort" className="text-sm font-bold text-ink-700">{t.sort}</label>
            <select
              id="directory-sort"
              className="input min-w-0 !w-auto max-w-[13rem] !py-2 sm:max-w-none"
              value={filters.sort}
              onChange={(e) => apply({ sort: e.target.value as Sort })}
            >
              {SORTS.map((s) => <option key={s.value} value={s.value}>{t.sorts[s.value]}</option>)}
            </select>
          </div>
        </div>

        {showFilters && (
          <div id="directory-filters" className="glass-flat grid gap-4 rounded-[var(--radius-lg)] p-4 sm:grid-cols-2 sm:p-5">
            {/* The list of states only makes sense for Nigeria: with another country chosen the filter is hidden. */}
            {FILTER_KEYS.filter((k) => k !== 'state' || filters.country === '' || filters.country === 'Nigeria').map((k) => (
              <div key={k}>
                <label htmlFor={`directory-${k}`} className="field-label">{t.filterLabels[k]}</label>
                <select
                  id={`directory-${k}`}
                  className="input"
                  value={filters[k]}
                  onChange={(e) => apply(k === 'country' && e.target.value !== 'Nigeria' && e.target.value !== '' ? { country: e.target.value, state: '' } : { [k]: e.target.value })}
                >
                  <option value="">{m.common.any}</option>
                  {FILTER_OPTIONS[k].map((o) => <option key={o} value={o}>{label(FILTER_GROUP[k], o)}</option>)}
                </select>
              </div>
            ))}
          </div>
        )}
      </form>

      {/* The minimum height holds the space the results will fill, so the footer does not jump when they arrive. */}
      <section className="mt-6 min-h-[26rem]" aria-labelledby="results-title" aria-busy={!current}>
        <h2 id="results-title" className="sr-only">{t.results}</h2>
        <p className="text-sm font-semibold text-ink-700" role="status" aria-live="polite">
          {!current && t.searching}
          {current?.ok && (total === 0 ? t.none : fmt(t.showing, { from, to, total, experts: total === 1 ? t.expert : t.experts }))}
        </p>

        {!current && (
          <div className="grid place-items-center py-14 text-green-800"><Spinner label={t.searchingSr} className="h-8 w-8" /></div>
        )}

        {current && !current.ok && (
          <div className="mt-3 space-y-3">
            <Notice title={t.loadFailedTitle}>{current.message}</Notice>
            <button className="btn btn-primary" onClick={() => setRetry((r) => r + 1)}>{m.common.tryAgain}</button>
          </div>
        )}

        {current?.ok && total === 0 && (
          <div className="glass-flat mt-3 rounded-[var(--radius-xl)] p-8 text-center">
            <h3 className="text-xl font-semibold text-green-900">
              {hasAnyFilter(filters) ? t.noMatchTitle : t.noneYetTitle}
            </h3>
            <p className="mt-2 text-ink-700">{hasAnyFilter(filters) ? t.noMatchText : t.noneYetText}</p>
            {hasAnyFilter(filters) && (
              <button className="btn btn-ghost mt-4" onClick={clearAll}>{t.clear}</button>
            )}
          </div>
        )}

        {current?.ok && total > 0 && (
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {current.items.map((e) => (
              <li key={e.expert_id}>
                <Link
                  to={`/experts/${e.expert_id}`}
                  className="glass-flat glass-hover block h-full rounded-[var(--radius-lg)] p-4 sm:p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="min-w-0 text-lg font-semibold text-green-900">{displayName(e.title, e.full_name)}</p>
                    <VerifiedBadge />
                  </div>
                  <p className="mt-0.5 break-words text-sm text-ink-700">{e.position}, {e.organisation}</p>
                  <p className="mt-2 text-sm font-semibold text-ink-900">{label('expertise', e.primary_expertise)}</p>
                  <p className="mt-0.5 text-sm text-ink-500">
                    {[e.state, e.country ? label('countries', e.country) : null].filter(Boolean).join(', ')} · {fmt(t.yearsShort, { years: label('years', e.years_experience) })} · {label('qualifications', e.qualification)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {current?.ok && pages > 1 && (
          <nav aria-label={t.pages} className="mt-6 flex items-center justify-between gap-3">
            <button
              className="btn btn-ghost !min-h-11"
              disabled={filters.page <= 1}
              onClick={() => apply({ page: filters.page - 1 }, false)}
            >
              {t.previous}<span className="sr-only">{t.page}</span>
            </button>
            <p className="text-sm font-semibold text-ink-700">{fmt(t.pageOf, { page: filters.page, pages })}</p>
            <button
              className="btn btn-ghost !min-h-11"
              disabled={filters.page >= pages}
              onClick={() => apply({ page: filters.page + 1 }, false)}
            >
              {t.next}<span className="sr-only">{t.page}</span>
            </button>
          </nav>
        )}
      </section>
    </div>
  )
}
