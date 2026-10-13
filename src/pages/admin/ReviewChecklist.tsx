import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

type Checklist = { qualifications_ok: boolean; credentials_ok: boolean; project_roles_ok: boolean; references_ok: boolean; notes: string | null }
type Ref = { id: string; referee_name: string; organisation: string; relationship: string; outcome: string; outcome_note: string | null; checked_by: string | null; checked_at: string | null }

const CRITERIA: { key: keyof Omit<Checklist, 'notes'>; title: string; help: string }[] = [
  { key: 'qualifications_ok', title: 'Qualifications', help: 'The qualification documents are genuine and match the highest qualification they declared.' },
  { key: 'credentials_ok', title: 'Professional credentials', help: 'The membership or licence documents show what they say they show. Naming a body or an NGO is not a credential.' },
  { key: 'project_roles_ok', title: 'Documented project roles', help: 'The documents show the projects and the role they held.' },
  { key: 'references_ok', title: 'References', help: 'You are satisfied with the references. Record the outcome of any check you made below.' },
]

const OUTCOMES: [string, string][] = [
  ['not_checked', 'Not checked'],
  ['confirmed', 'Confirmed'],
  ['not_confirmed', 'Not confirmed'],
  ['no_response', 'No response'],
]

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '')

/**
 * The four things verification rests on, ticked by the reviewer, with notes and the outcome of any reference check.
 * Approving is refused by the database until all four are ticked. Naming a professional body or an NGO never counts.
 */
export function ReviewChecklist({ expertId, onComplete }: { expertId: string; onComplete: (complete: boolean) => void }) {
  const [list, setList] = useState<Checklist | null>(null)
  const [refs, setRefs] = useState<Ref[]>([])
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [c, r] = await Promise.all([
      supabase.rpc('admin_get_checklist', { p_expert_id: expertId }),
      supabase.rpc('admin_list_references', { p_expert_id: expertId }),
    ])
    if (c.error || r.error) return setError('We could not load the checklist.')
    const data = c.data as Checklist
    setList(data)
    setNotes(data.notes ?? '')
    setRefs((r.data as Ref[]) ?? [])
    onComplete(data.qualifications_ok && data.credentials_ok && data.project_roles_ok && data.references_ok)
  }, [expertId, onComplete])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const save = async (next: Checklist) => {
    setBusy(true)
    setMessage(null)
    const { error: e } = await supabase.rpc('admin_save_checklist', {
      p_expert_id: expertId, p_q: next.qualifications_ok, p_c: next.credentials_ok, p_p: next.project_roles_ok, p_r: next.references_ok, p_notes: notes.trim() || null,
    })
    setBusy(false)
    if (e) return setError('We could not save the checklist.')
    setError(null)
    setMessage('Saved.')
    await load()
  }

  const record = async (id: string, outcome: string, note: string) => {
    setBusy(true)
    const { error: e } = await supabase.rpc('admin_set_reference_outcome', { p_id: id, p_outcome: outcome, p_note: note.trim() || null })
    setBusy(false)
    if (e) return setError('We could not record that outcome.')
    setError(null)
    await load()
  }

  if (!list) return <section className="card p-5 sm:p-6"><p className="text-sm text-ink-500">{error ?? 'Loading the checklist...'}</p></section>

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="checklist-h">
      <h2 id="checklist-h" className="text-xl font-semibold text-green-900">Verification checklist</h2>
      <p className="mt-1 text-sm text-ink-700">
        Verification is based on these four things only. Tick each one when you are satisfied. Approving needs all four. The wording shown to the expert is
        &ldquo;Verified by NEXUS-E review&rdquo;: it is not a licence, accreditation or certification.
      </p>
      {error && <p className="mt-2 text-sm text-danger-600">{error}</p>}
      <div className="mt-4 grid gap-2">
        {CRITERIA.map((c) => (
          <label key={c.key} className="choice" data-checked={list[c.key]}>
            <input type="checkbox" className="sr-only" checked={list[c.key]} disabled={busy} onChange={(e) => void save({ ...list, [c.key]: e.target.checked })} />
            <span className="choice-mark choice-check" aria-hidden="true" />
            <span className="flex-1">
              <span className="block text-[0.95rem] font-semibold">{c.title}</span>
              <span className="block text-sm text-ink-500">{c.help}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-4">
        <label htmlFor="checklist-notes" className="field-label">Reviewer notes (private)</label>
        <textarea id="checklist-notes" className="input min-h-24" maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="mt-2 flex items-center gap-3">
          <button className="btn btn-ghost !min-h-10" disabled={busy} onClick={() => void save(list)}>Save notes</button>
          {message && <span className="text-sm font-semibold text-green-800" role="status">{message}</span>}
        </div>
      </div>

      <h3 className="mt-6 text-base font-semibold text-green-900">References ({refs.length})</h3>
      <p className="text-sm text-ink-500">Nobody is emailed automatically. If you contact a referee, record what happened here.</p>
      {refs.length === 0 ? (
        <p className="mt-2 text-sm text-ink-500">The expert has not added a reference.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {refs.map((r) => (
            <RefRow key={r.id} r={r} busy={busy} onSave={(o, n) => void record(r.id, o, n)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function RefRow({ r, busy, onSave }: { r: Ref; busy: boolean; onSave: (outcome: string, note: string) => void }) {
  const [outcome, setOutcome] = useState(r.outcome)
  const [note, setNote] = useState(r.outcome_note ?? '')
  return (
    <li className="py-3">
      <p className="font-semibold text-ink-900">{r.referee_name} <span className="font-normal text-ink-500">{'·'} {r.organisation} {'·'} {r.relationship}</span></p>
      <div className="mt-2 grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
        <select aria-label={`Outcome for ${r.referee_name}`} className="input" value={outcome} onChange={(e) => setOutcome(e.target.value)}>
          {OUTCOMES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <input aria-label={`Note for ${r.referee_name}`} className="input" value={note} maxLength={500} placeholder="Note (optional)" onChange={(e) => setNote(e.target.value)} />
        <button className="btn btn-ghost !min-h-10" disabled={busy} onClick={() => onSave(outcome, note)}>Record</button>
      </div>
      {r.checked_at && <p className="mt-1 text-xs text-ink-500">Last recorded {when(r.checked_at)}</p>}
    </li>
  )
}
