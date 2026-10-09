import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isStatus, STATUS_LABEL, STATUS_ORDER, type VStatus } from '../../lib/verification'
import { StatusBadge } from '../../components/StatusBadge'
import { Notice, Spinner } from '../../components/ui'

type Row = {
  expert_id: string
  full_name: string
  title: string
  organisation: string
  country?: string
  state: string
  primary_expertise: string
  verification_status: string
  submitted_at: string | null
  reviewed_at: string | null
  reviewed_by: string | null
  created_at: string
}

const COLUMNS =
  'expert_id, full_name, title, organisation, country, state, primary_expertise, verification_status, submitted_at, reviewed_at, reviewed_by, created_at'

const date = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' }) : ''

function waiting(iso: string | null, now: number): string {
  if (!iso) return ''
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`
}

async function fetchQueue(status: VStatus) {
  const [c, r] = await Promise.all([
    supabase.rpc('admin_status_counts'),
    supabase
      .from('experts')
      .select(COLUMNS)
      .eq('verification_status', status)
      .order(status === 'pending' ? 'created_at' : 'submitted_at', { ascending: true, nullsFirst: false }),
  ])
  if (c.error || r.error) return null
  return { counts: c.data as Record<string, number>, rows: r.data as Row[] }
}

const LOAD_ERROR = 'Could not load the verification queue. Check your connection and try again.'

export default function Verification() {
  const [params, setParams] = useSearchParams()
  const raw = params.get('status') ?? 'under_review'
  const status: VStatus = isStatus(raw) ? raw : 'under_review'

  const [counts, setCounts] = useState<Record<string, number> | null>(null)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [now] = useState(() => Date.now())

  const load = useCallback(async () => {
    setError(null)
    setRows(null)
    const res = await fetchQueue(status)
    if (!res) return setError(LOAD_ERROR)
    setCounts(res.counts)
    setRows(res.rows)
  }, [status])

  useEffect(() => {
    document.title = 'Verification | Admin | NEXUS-E'
    let live = true
    fetchQueue(status).then((res) => {
      if (!live) return
      if (!res) return setError(LOAD_ERROR)
      setError(null)
      setCounts(res.counts)
      setRows(res.rows)
    })
    return () => {
      live = false
    }
  }, [status])

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold text-green-900">Verification</h1>
          <p className="text-sm text-ink-500">Oldest submissions first, so nobody waits longer than they need to.</p>
        </div>
        <button className="btn btn-ghost !min-h-11 flex-none !px-4" onClick={() => void load()}>Refresh</button>
      </div>

      <div role="tablist" aria-label="Verification status" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {STATUS_ORDER.map((s) => {
          const active = s === status
          return (
            <button
              key={s}
              role="tab"
              aria-selected={active}
              onClick={() => setParams(s === 'under_review' ? {} : { status: s })}
              className={`rounded-[var(--radius-lg)] border p-4 text-left transition last:odd:col-span-2 sm:last:odd:col-span-1 ${
                active ? 'border-green-900 bg-green-900 text-white shadow-md' : 'border-line bg-surface hover:border-green-600'
              }`}
            >
              <span className={`block text-xs font-bold uppercase tracking-wider ${active ? 'text-lime-500' : 'text-ink-500'}`}>
                {STATUS_LABEL[s]}
              </span>
              <span className="mt-1 block font-display text-3xl font-semibold">{counts ? (counts[s] ?? 0) : '...'}</span>
            </button>
          )
        })}
      </div>

      <div className="mt-6" role="tabpanel">
        {error && (
          <div className="space-y-3">
            <Notice>{error}</Notice>
            <button className="btn btn-ghost" onClick={() => void load()}>Try again</button>
          </div>
        )}
        {!error && rows === null && (
          <div className="grid place-items-center py-16 text-green-800"><Spinner label="Loading the queue" className="h-8 w-8" /></div>
        )}
        {rows && rows.length === 0 && (
          <div className="card p-10 text-center">
            <h2 className="text-xl font-semibold text-green-900">
              {status === 'under_review' ? 'Nothing waiting for review' : `Nobody is ${STATUS_LABEL[status].toLowerCase()}`}
            </h2>
            <p className="mt-2 text-ink-700">
              {status === 'under_review'
                ? 'When an expert submits their evidence, they will appear here.'
                : 'Pick another status above to see other experts.'}
            </p>
          </div>
        )}
        {rows && rows.length > 0 && (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.expert_id}>
                <Link
                  to={`/admin/verification/${r.expert_id}`}
                  className="card flex flex-wrap items-center justify-between gap-3 p-4 transition hover:border-green-600"
                  style={{ borderRadius: 'var(--radius-lg)' }}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-green-900">
                      {r.title} {r.full_name}
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">{r.expert_id}</span>
                    </p>
                    <p className="mt-0.5 truncate text-sm text-ink-700">{r.organisation} · {r.state}, {r.country ?? 'Nigeria'}</p>
                    <p className="text-sm text-ink-500">{r.primary_expertise}</p>
                  </div>
                  <div className="text-right text-sm">
                    <StatusBadge status={r.verification_status} />
                    <p className="mt-1.5 text-ink-500">
                      {r.submitted_at
                        ? `Submitted ${date(r.submitted_at)} (${waiting(r.submitted_at, now)})`
                        : `Registered ${date(r.created_at)}`}
                    </p>
                    {r.reviewed_at && <p className="text-ink-500">Reviewed {date(r.reviewed_at)}{r.reviewed_by ? ` by ${r.reviewed_by}` : ''}</p>}
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
