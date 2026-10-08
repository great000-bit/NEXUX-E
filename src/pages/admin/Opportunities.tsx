import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { OppBadge } from '../../components/OppBadge'
import { Notice, Spinner } from '../../components/ui'
import { deadlineNote, formatDay, type AdminOpportunity } from '../../lib/opportunities'
import { supabase } from '../../lib/supabase'

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'draft', label: 'Drafts' },
  { value: 'closed', label: 'Closed' },
  { value: 'all', label: 'All' },
] as const
type Tab = (typeof TABS)[number]['value']

const LOAD_ERROR = 'Could not load the opportunities. Check your connection and try again.'

export default function Opportunities() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status') ?? 'open'
  const tab: Tab = TABS.some((t) => t.value === raw) ? (raw as Tab) : 'open'
  const [rows, setRows] = useState<AdminOpportunity[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    document.title = 'Opportunities | Admin | NEXUS-E'
    let live = true
    supabase.rpc('admin_list_opportunities').then(({ data, error: err }) => {
      if (!live) return
      if (err) return setError(LOAD_ERROR)
      setError(null)
      setRows((data as AdminOpportunity[]) ?? [])
    })
    return () => {
      live = false
    }
  }, [reload])

  const count = (t: Tab) => (rows ? rows.filter((r) => t === 'all' || r.status === t).length : null)
  const shown = rows?.filter((r) => tab === 'all' || r.status === tab) ?? null

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-green-900">Opportunities</h1>
          <p className="text-sm text-ink-500">Projects for verified experts. Only Open ones are shown to experts.</p>
        </div>
        <Link to="/admin/opportunities/new" className="btn btn-primary !min-h-11 flex-none !px-5">New opportunity</Link>
      </div>

      <div role="tablist" aria-label="Opportunity status" className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => {
          const active = t.value === tab
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => setParams(t.value === 'open' ? {} : { status: t.value })}
              className={`min-h-11 rounded-full border px-4 text-sm font-bold transition ${
                active ? 'border-green-900 bg-green-900 text-white' : 'border-line bg-surface text-green-800 hover:border-green-600'
              }`}
            >
              {t.label} <span className={active ? 'text-lime-500' : 'text-ink-500'}>{count(t.value) ?? '...'}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6" role="tabpanel">
        {error && (
          <div className="space-y-3">
            <Notice>{error}</Notice>
            <button className="btn btn-ghost" onClick={() => { setError(null); setRows(null); setReload((r) => r + 1) }}>Try again</button>
          </div>
        )}
        {!error && rows === null && (
          <div className="grid place-items-center py-16 text-green-800"><Spinner label="Loading opportunities" className="h-8 w-8" /></div>
        )}
        {shown && shown.length === 0 && (
          <div className="card p-10 text-center">
            <h2 className="text-xl font-semibold text-green-900">
              {tab === 'all' ? 'No opportunities yet' : `No ${TABS.find((t) => t.value === tab)?.label.toLowerCase()} opportunities`}
            </h2>
            <p className="mt-2 text-ink-700">
              {tab === 'all' || tab === 'draft' ? 'Create one with the button above.' : 'Pick another tab to see the rest.'}
            </p>
          </div>
        )}
        {shown && shown.length > 0 && (
          <ul className="space-y-3">
            {shown.map((o) => (
              <li key={o.id}>
                <Link
                  to={`/admin/opportunities/${o.id}`}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-green-600"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <div className="min-w-0">
                    <p className="break-words font-bold text-green-900">{o.title}</p>
                    <p className="mt-0.5 break-words text-sm text-ink-700">{o.opp_type} · {o.location}</p>
                    <p className="text-sm text-ink-500">
                      Deadline {formatDay(o.deadline)}
                      {o.status === 'open' ? ` (${deadlineNote(o.deadline, now)})` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <OppBadge status={o.status} expired={o.expired} />
                    <span className="font-bold text-ink-700">{o.interested} interested</span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
