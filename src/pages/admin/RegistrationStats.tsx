import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Count = { name: string; count: number; id?: string; status?: string }
type Stats = { by_specialisation: Count[]; by_country: Count[]; by_institution: Count[] }
type Verif = { by_status: Count[]; by_country: Count[]; by_specialisation: Count[] }

/** Registration counts by specialisation, country and institution. Opens on demand, so the registrations list is not slowed down. */
export function RegistrationStats() {
  const [open, setOpen] = useState(false)
  const [stats, setStats] = useState<Stats | null>(null)
  const [failed, setFailed] = useState(false)
  const [verif, setVerif] = useState<Verif | null>(null)
  useEffect(() => {
    if (!open || stats || failed) return
    supabase.rpc('admin_registration_stats').then(({ data, error }) => {
      if (error) setFailed(true)
      else setStats(data as Stats)
    })
    supabase.rpc('admin_verification_stats').then(({ data, error }) => {
      if (!error) setVerif(data as Verif)
    })
  }, [open, stats, failed])

  return (
    <details className="card mt-6 p-4 sm:p-5" onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}>
      <summary className="cursor-pointer text-base font-bold text-green-900">Registration statistics</summary>
      {failed && <p className="mt-3 text-sm text-danger-600">Could not load the statistics.</p>}
      {open && !stats && !failed && <p className="mt-3 text-sm text-ink-500">Loading...</p>}
      {stats && (
        <div className="mt-4 grid gap-6 md:grid-cols-3">
          <Table title="By specialisation" rows={stats.by_specialisation} />
          <Table title="By country" rows={stats.by_country} />
          <Table title="By institution (self-declared)" rows={stats.by_institution} flag />
          {verif && <Table title="By verification status" rows={verif.by_status} />}
          {verif && <Table title="Country by status" rows={verif.by_country.map((c) => ({ ...c, name: `${c.name} / ${c.status}` }))} />}
          {verif && <Table title="Specialisation by status" rows={verif.by_specialisation.map((c) => ({ ...c, name: `${c.name} / ${c.status}` }))} />}
        </div>
      )}
    </details>
  )
}

function Table({ title, rows, flag }: { title: string; rows: Count[]; flag?: boolean }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-ink-700">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">Nothing yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {rows.slice(0, 15).map((r) => (
            <li key={r.id ?? r.name} className="flex items-start justify-between gap-3 py-1.5">
              <span className="min-w-0 break-words">{r.name}{flag && r.status === 'pending' && <span className="ms-1 text-xs text-[#7a4b00]">(pending)</span>}</span>
              <span className="flex-none font-bold text-green-900">{r.count}</span>
            </li>
          ))}
        </ul>
      )}
      {rows.length > 15 && <p className="mt-1 text-xs text-ink-500">{rows.length - 15} more not shown.</p>}
    </div>
  )
}
