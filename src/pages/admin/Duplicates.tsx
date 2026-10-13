import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { STATUS_LABEL, isStatus } from '../../lib/verification'

type Pair = {
  a_id: string; b_id: string; a_name: string; b_name: string; a_org: string; b_org: string; a_country: string; b_country: string
  a_status: string; b_status: string; reasons: string[]; score: number
}
type LogRow = { id: number; kept: string; dropped: string; actor: string; note: string | null; moved: Record<string, number>; created_at: string }

const label = (s: string) => (isStatus(s) ? STATUS_LABEL[s] : s)
const when = (iso: string) => new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' })

/** Likely duplicate registrations, and a safe merge. Nothing is deleted: the duplicate is hidden and flagged, and every merge is logged. */
export default function Duplicates() {
  const [pairs, setPairs] = useState<Pair[] | null>(null)
  const [log, setLog] = useState<LogRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [confirm, setConfirm] = useState<{ keep: string; drop: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [p, l] = await Promise.all([supabase.rpc('admin_find_duplicates'), supabase.rpc('admin_merge_log')])
    if (p.error || l.error) return setError('We could not load the duplicates.')
    setError(null)
    setPairs((p.data as Pair[]) ?? [])
    setLog((l.data as LogRow[]) ?? [])
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const merge = async () => {
    if (!confirm) return
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_merge_experts', { p_keep: confirm.keep, p_drop: confirm.drop, p_note: note.trim() || null })
    setBusy(false)
    if (e) return setError(e.message === 'already_merged' ? 'One of these has already been merged.' : 'We could not merge them.')
    setDone(`Merged ${confirm.drop} into ${confirm.keep}. The duplicate is hidden and kept on record.`)
    setConfirm(null)
    setNote('')
    await load()
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold text-green-900">Duplicates</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-700">
          Pairs that look like the same person: the same name, a very similar name in the same country, or the same name in the email address.
          Check each pair before you merge. A merge moves memberships, references, evidence files and interest in opportunities to the record you keep,
          hides the other from the directory and ends its sign-in sessions. Nothing is deleted, and every merge is logged.
        </p>
      </header>
      {error && <p className="text-sm text-danger-600" role="alert">{error}</p>}
      {done && <p className="text-sm font-semibold text-green-800" role="status">{done}</p>}
      {pairs === null && !error && <p className="text-sm text-ink-500">Looking for duplicates...</p>}
      {pairs && pairs.length === 0 && <p className="card p-5 text-sm text-ink-700">No likely duplicates found.</p>}
      {pairs && pairs.map((p) => (
        <section key={`${p.a_id}-${p.b_id}`} className="card p-4 sm:p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-green-800">{p.reasons.join(' · ')}</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {([['a', p.a_id, p.a_name, p.a_org, p.a_country, p.a_status], ['b', p.b_id, p.b_name, p.b_org, p.b_country, p.b_status]] as const).map(([k, id, name, org, country, status]) => (
              <div key={k} className="min-w-0 rounded-lg border border-line p-3 text-sm">
                <Link to={`/admin/verification/${id}`} className="font-bold text-green-800 underline underline-offset-4">{id}</Link>
                <p className="mt-1 break-words font-semibold text-ink-900">{name}</p>
                <p className="break-words text-ink-700">{org} {'·'} {country}</p>
                <p className="text-ink-500">{label(status)}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="btn btn-ghost !min-h-10" onClick={() => setConfirm({ keep: p.a_id, drop: p.b_id })}>Keep {p.a_id}, merge {p.b_id} into it</button>
            <button className="btn btn-ghost !min-h-10" onClick={() => setConfirm({ keep: p.b_id, drop: p.a_id })}>Keep {p.b_id}, merge {p.a_id} into it</button>
          </div>
        </section>
      ))}

      {confirm && (
        <div className="card border-2 border-green-800 p-5" role="dialog" aria-modal="false" aria-labelledby="merge-h">
          <h2 id="merge-h" className="text-lg font-semibold text-green-900">Merge {confirm.drop} into {confirm.keep}?</h2>
          <p className="mt-1 text-sm text-ink-700">{confirm.drop} will be hidden from the directory and flagged as merged. This is logged and cannot be edited later.</p>
          <label htmlFor="merge-note" className="field-label mt-3">Note (optional)</label>
          <input id="merge-note" className="input" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="mt-3 flex gap-2">
            <button className="btn btn-primary" disabled={busy} onClick={() => void merge()}>Yes, merge</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => setConfirm(null)}>Cancel</button>
          </div>
        </div>
      )}

      <section className="card p-5" aria-labelledby="mlog-h">
        <h2 id="mlog-h" className="text-lg font-semibold text-green-900">Merge log</h2>
        {log.length === 0 ? (
          <p className="mt-2 text-sm text-ink-500">No merges yet.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line text-sm">
            {log.map((l) => (
              <li key={l.id} className="py-2">
                <span className="font-semibold">{l.dropped}</span> merged into <span className="font-semibold">{l.kept}</span> by {l.actor} on {when(l.created_at)}
                <span className="text-ink-500"> {'·'} moved {l.moved.affiliations ?? 0} affiliations, {l.moved.references ?? 0} references, {l.moved.files ?? 0} files</span>
                {l.note && <span className="block text-ink-500">{l.note}</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
