import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Link } from 'react-router-dom'
import { EXPERTISE, MEMBERSHIPS, STATES } from '../../lib/options'
import { STATUS_LABEL, STATUS_ORDER } from '../../lib/verification'
import { StatusBadge } from '../../components/StatusBadge'
import { Notice, Spinner } from '../../components/ui'
import { downloadCsv, type Expert } from './csv'

const PAGE = 1000

async function fetchAll(): Promise<Expert[]> {
  const all: Expert[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('experts')
      .select('*')
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1)
    if (error) throw error
    all.push(...(data as Expert[]))
    if (!data || data.length < PAGE) break
  }
  return all
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })

export default function Dashboard() {
  const [rows, setRows] = useState<Expert[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [expertise, setExpertise] = useState('')
  const [state, setState] = useState('')
  const [membership, setMembership] = useState('')
  const [discoverable, setDiscoverable] = useState('')
  const [vstatus, setVstatus] = useState('')
  const [open, setOpen] = useState<Expert | null>(null)

  const load = useCallback(async () => {
    setError(null)
    setRows(null)
    try {
      setRows(await fetchAll())
    } catch {
      setError('Could not load registrations. Check your connection and try again.')
    }
  }, [])

  useEffect(() => {
    let live = true
    fetchAll()
      .then((r) => live && setRows(r))
      .catch(() => live && setError('Could not load registrations. Check your connection and try again.'))
    return () => {
      live = false
    }
  }, [])

  const filtered = useMemo(() => {
    if (!rows) return []
    const needle = q.trim().toLowerCase()
    const digits = needle.replace(/\D/g, '')
    return rows.filter((r) => {
      if (expertise && r.primary_expertise !== expertise && !r.secondary_expertise.includes(expertise)) return false
      if (state && r.state !== state) return false
      if (membership === 'none' ? r.memberships.length > 0 : membership && !r.memberships.includes(membership)) return false
      if (discoverable && (discoverable === 'yes') !== r.discoverable) return false
      if (vstatus && r.verification_status !== vstatus) return false
      if (!needle) return true
      const hay = [r.full_name, r.email ?? '', r.organisation, r.position, r.expert_id].join(' ').toLowerCase()
      return hay.includes(needle) || (digits.length >= 3 && (r.phone ?? '').includes(digits))
    })
  }, [rows, q, expertise, state, membership, discoverable, vstatus])

  const filtersOn = Boolean(q || expertise || state || membership || discoverable || vstatus)
  const clear = () => {
    setQ(''); setExpertise(''); setState(''); setMembership(''); setDiscoverable(''); setVstatus('')
  }

  const stats = useMemo(() => {
    const r = rows ?? []
    const today = new Date().toDateString()
    return {
      total: r.length,
      today: r.filter((x) => new Date(x.created_at).toDateString() === today).length,
      discoverable: r.filter((x) => x.discoverable).length,
    }
  }, [rows])

  const stamp = new Date().toISOString().slice(0, 10)

  return (
    <div className="-mx-1 sm:mx-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-green-900">Registrations</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost !min-h-10 !px-4" onClick={load} disabled={rows === null && !error}>Refresh</button>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Total" value={rows ? stats.total : null} accent />
        <Stat label="Today" value={rows ? stats.today : null} />
        <Stat label="Discoverable" value={rows ? stats.discoverable : null} />
      </dl>

      <section aria-label="Search and filters" className="card mt-6 space-y-4 p-4 sm:p-5">
        <div>
          <label htmlFor="q" className="sr-only">Search registrations</label>
          <input
            id="q" type="search" className="input" value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone, organisation or Expert ID"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Filter label="Expertise" value={expertise} onChange={setExpertise} options={EXPERTISE} all="All expertise" />
          <Filter label="State" value={state} onChange={setState} options={STATES} all="All states" />
          <Filter
            label="Membership" value={membership} onChange={setMembership}
            options={[...MEMBERSHIPS, 'none']} labels={{ none: 'No memberships' }} all="Any membership"
          />
          <Filter
            label="Discoverability" value={discoverable} onChange={setDiscoverable}
            options={['yes', 'no']} labels={{ yes: 'Discoverable', no: 'Not discoverable' }} all="Any"
          />
          <Filter
            label="Verification" value={vstatus} onChange={setVstatus}
            options={STATUS_ORDER} labels={STATUS_LABEL} all="Any status"
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-ink-700" aria-live="polite">
            {rows ? `Showing ${filtered.length} of ${rows.length}` : ''}
          </p>
          <div className="flex gap-2">
            {filtersOn && <button className="btn btn-ghost !min-h-10 !px-4" onClick={clear}>Clear filters</button>}
            <button
              className="btn btn-primary !min-h-10 !px-4"
              disabled={!filtered.length}
              onClick={() => downloadCsv(filtered, `nexus-e-experts-${filtersOn ? 'filtered-' : ''}${stamp}.csv`)}
            >
              Export {filtersOn ? 'filtered' : 'all'} to CSV
            </button>
          </div>
        </div>
      </section>

      <div className="mt-6">
        {error && (
          <div className="space-y-3">
            <Notice>{error}</Notice>
            <button className="btn btn-ghost" onClick={load}>Try again</button>
          </div>
        )}
        {!error && rows === null && (
          <div className="grid place-items-center py-16 text-green-800"><Spinner label="Loading registrations" className="h-8 w-8" /></div>
        )}
        {rows && rows.length === 0 && (
          <div className="card p-10 text-center">
            <h2 className="text-xl font-semibold text-green-900">No registrations yet</h2>
            <p className="mt-2 text-ink-700">New registrations will appear here as soon as experts submit the form.</p>
          </div>
        )}
        {rows && rows.length > 0 && filtered.length === 0 && (
          <div className="card p-10 text-center">
            <h2 className="text-xl font-semibold text-green-900">No matches</h2>
            <p className="mt-2 text-ink-700">Try a different search or clear the filters.</p>
            <button className="btn btn-ghost mt-5" onClick={clear}>Clear filters</button>
          </div>
        )}
        {filtered.length > 0 && (
          <>
            <ul className="space-y-3 md:hidden">
              {filtered.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => setOpen(r)}
                    className="card w-full p-4 text-left transition hover:border-green-600"
                    style={{ borderRadius: 'var(--radius-lg)' }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-bold text-green-900">{r.title} {r.full_name}</p>
                      <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">{r.expert_id}</span>
                    </div>
                    <p className="mt-0.5 text-sm text-ink-700">{r.organisation}</p>
                    <p className="mt-2 text-sm text-ink-500">{r.primary_expertise} · {r.state}</p>
                    <div className="mt-2"><StatusBadge status={r.verification_status} /></div>
                  </button>
                </li>
              ))}
            </ul>
            <div className="card hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-green-50 text-xs uppercase tracking-wider text-ink-500">
                  <tr>
                    {['Expert ID', 'Name', 'Organisation', 'Primary expertise', 'State', 'Discoverable', 'Verification', 'Registered'].map((h) => (
                      <th key={h} scope="col" className="px-4 py-3 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {filtered.map((r) => (
                    <tr key={r.id} className="hover:bg-green-50/60">
                      <td className="whitespace-nowrap px-4 py-3 font-bold text-green-800">
                        <button className="underline-offset-2 hover:underline" onClick={() => setOpen(r)}>{r.expert_id}</button>
                      </td>
                      <td className="px-4 py-3 font-semibold">{r.title} {r.full_name}</td>
                      <td className="px-4 py-3 text-ink-700">{r.organisation}</td>
                      <td className="px-4 py-3 text-ink-700">{r.primary_expertise}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-700">{r.state}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${r.discoverable ? 'bg-green-100 text-green-800' : 'bg-line text-ink-700'}`}>
                          {r.discoverable ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-4 py-3"><StatusBadge status={r.verification_status} /></td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-500">{fmt(r.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {open && <Detail expert={open} onClose={() => setOpen(null)} />}
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: number | null; accent?: boolean }) {
  return (
    <div className={`min-w-0 rounded-[var(--radius-lg)] p-3 sm:p-4 ${accent ? 'bg-green-900 text-white' : 'border border-line bg-surface'}`}>
      <dt className={`text-[0.65rem] font-bold uppercase leading-tight tracking-wider sm:text-xs ${accent ? 'text-lime-500' : 'text-ink-500'}`}>{label}</dt>
      <dd className="mt-1 font-display text-3xl font-semibold">{value === null ? '...' : value.toLocaleString()}</dd>
    </div>
  )
}

function Filter({
  label, value, onChange, options, all, labels = {},
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: readonly string[]
  all: string
  labels?: Record<string, string>
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-ink-500">{label}</label>
      <select className="input !min-h-11 !py-2" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map((o) => <option key={o} value={o}>{labels[o] ?? o}</option>)}
      </select>
    </div>
  )
}

function Detail({ expert: r, onClose }: { expert: Expert; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
  }, [])

  const list = (v: string[]) => (v.length ? v.join(', ') : 'None')
  const rows: [string, string | null][] = [
    ['Organisation', r.organisation],
    ['Position', r.position],
    ['State', r.state],
    ['Phone', r.phone ? `+${r.phone}` : null],
    ['Email', r.email],
    ['Primary expertise', r.primary_expertise],
    ['Secondary expertise', list(r.secondary_expertise)],
    ['Years of experience', r.years_experience],
    ['Highest qualification', r.qualification],
    ['Memberships', list(r.memberships)],
    ['NES number', r.nes_number],
    ['IEPN status', r.iepn_status],
    ['Assignments', list(r.assignments)],
    ['Availability', r.availability],
    ['Profile link', r.profile_url],
    ['Discoverable', r.discoverable ? 'Yes' : 'No'],
    ['Consent to be contacted', r.consent_contact ? `Yes, ${fmt(r.consent_at)}` : 'No'],
    ['Verification', STATUS_LABEL[(STATUS_ORDER as string[]).includes(r.verification_status) ? (r.verification_status as keyof typeof STATUS_LABEL) : 'pending']],
    ['Registered', fmt(r.created_at)],
  ]

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current?.close() }}
      aria-labelledby="detail-title"
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-lg overflow-y-auto bg-surface p-0 shadow-lg backdrop:bg-green-950/50"
    >
      <div className="sticky top-0 flex items-start justify-between gap-3 border-b border-line bg-surface/95 p-5 backdrop-blur">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">{r.expert_id}</p>
          <h2 id="detail-title" className="mt-1 text-2xl font-semibold text-green-900">{r.title} {r.full_name}</h2>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button className="btn btn-ghost !min-h-10 !px-4" onClick={() => ref.current?.close()}>Close</button>
          <Link to={`/admin/verification/${r.expert_id}`} className="text-sm font-bold text-green-800 underline underline-offset-4">Open review</Link>
        </div>
      </div>
      <dl className="divide-y divide-line px-5">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-3 text-sm">
            <dt className="font-bold text-ink-500">{k}</dt>
            <dd className="break-words text-ink-900">
              {v ? (k === 'Profile link' && /^https?:\/\//i.test(v) ? <a className="text-blue-700 underline" href={v} target="_blank" rel="noopener noreferrer">{v}</a> : v) : <span className="text-ink-300">Not provided</span>}
            </dd>
          </div>
        ))}
      </dl>
    </dialog>
  )
}
