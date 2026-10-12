import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { COUNTRIES } from '../../lib/countries'
import { Notice, Spinner } from '../../components/ui'
import { downloadCsvText, institutionsToCsv, type InstitutionRow } from './csv'

// Admin review of institutions: approve or edit what experts suggested, merge duplicates, and export to CSV.
// Seeded records are all "unverified": the client's document says current legal status must be confirmed first.

const CATEGORY_LABEL: Record<string, string> = {
  professional_body: 'Professional body',
  statutory_council: 'Statutory or regulatory council',
  scientific_society: 'Scientific society',
  ngo_network: 'NGO or conservation network',
}
const COVERAGE_LABEL: Record<string, string> = { national: 'National', regional: 'Regional', pan_african: 'Pan-African', international: 'International' }
const ERRORS: Record<string, string> = {
  bad_name: 'Enter a name of at least 2 characters.',
  duplicate_name: 'An institution with this name and country already exists. Merge them instead.',
  verification_needs_evidence: 'To mark an institution verified, enter a verification date and an evidence source.',
  invalid_institution: 'One of the fields is not valid. Check the website address and the lengths.',
  bad_merge: 'Choose a different institution to merge into.',
  not_found: 'That institution no longer exists. Refresh the list.',
}
const messageOf = (err: { message?: string } | null) => (err?.message && ERRORS[err.message]) || 'Something went wrong. Please try again.'

type Draft = Omit<InstitutionRow, 'id' | 'experts' | 'created_at' | 'updated_at' | 'suggested_by'> & { id: string | null }
const blank: Draft = {
  id: null, name: '', acronym: '', country: '', coverage: 'national', category: 'professional_body', specialisation: '', website: '',
  public_contact: '', verification_status: 'unverified', verification_date: '', evidence_source: '', status: 'approved',
}
const toDraft = (r: InstitutionRow): Draft => ({
  id: r.id, name: r.name, acronym: r.acronym ?? '', country: r.country ?? '', coverage: r.coverage, category: r.category,
  specialisation: r.specialisation ?? '', website: r.website ?? '', public_contact: r.public_contact ?? '',
  verification_status: r.verification_status, verification_date: r.verification_date ?? '', evidence_source: r.evidence_source ?? '', status: r.status,
})

export default function Institutions() {
  const [rows, setRows] = useState<InstitutionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const [category, setCategory] = useState('')
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Draft | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    const { data, error: err } = await supabase.rpc('admin_list_institutions')
    if (err) setError('Could not load institutions. Check your connection and try again.')
    else setRows(data as InstitutionRow[])
  }, [])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const pending = rows?.filter((r) => r.status === 'pending').length ?? 0
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return (rows ?? []).filter((r) =>
      (!status || r.status === status) &&
      (!category || r.category === category) &&
      (!needle || `${r.name} ${r.acronym ?? ''} ${r.country ?? ''} ${r.specialisation ?? ''}`.toLowerCase().includes(needle)),
    )
  }, [rows, status, category, q])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-semibold text-green-900">Institutions</h1>
        <div className="flex gap-2">
          <button className="btn btn-ghost !min-h-10 !px-4" onClick={() => rows && downloadCsvText(institutionsToCsv(rows), `institutions-${new Date().toISOString().slice(0, 10)}.csv`)} disabled={!rows}>Export CSV</button>
          <button className="btn btn-primary !min-h-10 !px-4" onClick={() => { setNote(null); setEditing({ ...blank }) }}>Add institution</button>
        </div>
      </div>
      <p className="mt-2 max-w-2xl text-sm text-ink-700">
        Professional bodies, statutory councils, scientific societies and NGOs are kept apart. Records from the client&rsquo;s list are
        unverified until their current legal status has been confirmed. A suggestion from an expert stays pending, and is shown to
        nobody else, until you approve it.
      </p>
      {note && <div className="mt-4"><Notice tone="success">{note}</Notice></div>}
      {error && <div className="mt-4"><Notice>{error}</Notice></div>}

      <section aria-label="Filters" className="card mt-5 grid gap-3 p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="inst-q" className="sr-only">Search institutions</label>
          <input id="inst-q" type="search" className="input" placeholder="Search name, acronym or country" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select aria-label="Status" className="input" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{`All statuses${rows ? ` (${rows.length})` : ''}`}</option>
          <option value="pending">{`Pending review (${pending})`}</option>
          <option value="approved">Approved</option>
        </select>
        <select aria-label="Category" className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </section>

      {!rows && !error && <div className="grid place-items-center py-16 text-green-800"><Spinner label="Loading institutions" className="h-8 w-8" /></div>}
      {rows && (
        <>
          <p className="mt-4 text-sm text-ink-700" aria-live="polite">{`Showing ${filtered.length} of ${rows.length}`}</p>
          <ul className="mt-3 space-y-2">
            {filtered.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-start justify-between gap-3 p-4" style={{ borderRadius: 'var(--radius-lg)' }}>
                <div className="min-w-0">
                  <p className="break-words font-semibold text-green-900">{r.name}</p>
                  <p className="text-sm text-ink-700">
                    {CATEGORY_LABEL[r.category]} · {r.country ?? 'No country'} · {COVERAGE_LABEL[r.coverage] ?? r.coverage}
                  </p>
                  <p className="mt-1 flex flex-wrap gap-2 text-xs font-bold">
                    <span className={`rounded-full px-2.5 py-1 ${r.status === 'pending' ? 'bg-warn-100 text-[#7a4b00]' : 'bg-green-100 text-green-800'}`}>{r.status === 'pending' ? 'Pending review' : 'Approved'}</span>
                    <span className={`rounded-full px-2.5 py-1 ${r.verification_status === 'verified' ? 'bg-green-100 text-green-800' : 'bg-line text-ink-700'}`}>{r.verification_status === 'verified' ? 'Verified' : 'Unverified'}</span>
                    <span className="rounded-full bg-blue-100 px-2.5 py-1 text-blue-700">{r.experts} {r.experts === 1 ? 'expert' : 'experts'}</span>
                    {r.suggested_by && <span className="rounded-full bg-line px-2.5 py-1 text-ink-700">Suggested by {r.suggested_by}</span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {r.status === 'pending' && (
                    <button className="btn btn-primary !min-h-11 !px-4" onClick={async () => {
                      const { error: err } = await supabase.rpc('admin_save_institution', { p_id: r.id, p_payload: { ...toDraft(r), status: 'approved' } })
                      if (err) setError(messageOf(err))
                      else { setNote(`Approved ${r.name}. It can now be chosen by experts.`); await load() }
                    }}>Approve</button>
                  )}
                  <button className="btn btn-ghost !min-h-11 !px-4" onClick={() => { setNote(null); setEditing(toDraft(r)) }}>Edit<span className="sr-only"> {r.name}</span></button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {editing && (
        <Editor
          draft={editing}
          others={(rows ?? []).filter((r) => r.id !== editing.id)}
          onClose={() => setEditing(null)}
          onSaved={async (message) => { setEditing(null); setNote(message); await load() }}
        />
      )}
    </div>
  )
}

function Editor({ draft, others, onClose, onSaved }: { draft: Draft; others: InstitutionRow[]; onClose: () => void; onSaved: (message: string) => Promise<void> }) {
  const [d, setD] = useState<Draft>(draft)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [mergeInto, setMergeInto] = useState('')
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    ref.current?.showModal()
  }, [])
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    const { error } = await supabase.rpc('admin_save_institution', { p_id: d.id, p_payload: d })
    setBusy(false)
    if (error) return setErr(messageOf(error))
    await onSaved(`Saved ${d.name}.`)
  }
  const merge = async () => {
    if (!d.id || !mergeInto) return
    const target = others.find((o) => o.id === mergeInto)
    if (!window.confirm(`Merge "${d.name}" into "${target?.name}"? Everyone who named it will point to "${target?.name}", and "${d.name}" is removed.`)) return
    setBusy(true)
    setErr(null)
    const { error } = await supabase.rpc('admin_merge_institutions', { p_from: d.id, p_into: mergeInto })
    setBusy(false)
    if (error) return setErr(messageOf(error))
    await onSaved(`Merged ${d.name} into ${target?.name}.`)
  }

  const field = 'field-label'
  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="inst-title" className="m-auto w-[min(40rem,94vw)] max-h-[92dvh] overflow-y-auto rounded-[var(--radius-xl)] bg-surface p-0 shadow-lg backdrop:bg-green-950/50">
      <form onSubmit={save} className="space-y-4 p-5">
        <h2 id="inst-title" className="text-2xl font-semibold text-green-900">{d.id ? 'Edit institution' : 'Add institution'}</h2>
        {err && <Notice>{err}</Notice>}
        <div><label className={field} htmlFor="i-name">Organisation name</label><input id="i-name" className="input" value={d.name} maxLength={200} onChange={(e) => set('name', e.target.value)} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={field} htmlFor="i-acr">Acronym</label><input id="i-acr" className="input" value={d.acronym ?? ''} maxLength={40} onChange={(e) => set('acronym', e.target.value)} /></div>
          <div>
            <label className={field} htmlFor="i-country">Country</label>
            <select id="i-country" className="input" value={d.country ?? ''} onChange={(e) => set('country', e.target.value)}>
              <option value="">No country</option>
              <option value="Pan-African">Pan-African</option>
              {COUNTRIES.filter((c) => c !== 'Other').map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={field} htmlFor="i-cov">Geographic coverage</label>
            <select id="i-cov" className="input" value={d.coverage} onChange={(e) => set('coverage', e.target.value)}>
              {Object.entries(COVERAGE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div>
            <label className={field} htmlFor="i-cat">Category</label>
            <select id="i-cat" className="input" value={d.category} onChange={(e) => set('category', e.target.value)}>
              {Object.entries(CATEGORY_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div><label className={field} htmlFor="i-spec">Specialisation</label><input id="i-spec" className="input" value={d.specialisation ?? ''} maxLength={300} onChange={(e) => set('specialisation', e.target.value)} /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={field} htmlFor="i-web">Website</label><input id="i-web" className="input" type="url" inputMode="url" placeholder="https://" value={d.website ?? ''} maxLength={300} onChange={(e) => set('website', e.target.value)} /></div>
          <div><label className={field} htmlFor="i-contact">Public contact</label><input id="i-contact" className="input" value={d.public_contact ?? ''} maxLength={300} onChange={(e) => set('public_contact', e.target.value)} /></div>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className={field} htmlFor="i-ver">Verification</label>
            <select id="i-ver" className="input" value={d.verification_status} onChange={(e) => set('verification_status', e.target.value)}>
              <option value="unverified">Unverified</option>
              <option value="verified">Verified</option>
            </select>
          </div>
          <div><label className={field} htmlFor="i-date">Verification date</label><input id="i-date" className="input" type="date" value={d.verification_date ?? ''} onChange={(e) => set('verification_date', e.target.value)} /></div>
          <div>
            <label className={field} htmlFor="i-status">Status</label>
            <select id="i-status" className="input" value={d.status} onChange={(e) => set('status', e.target.value)}>
              <option value="approved">Approved</option>
              <option value="pending">Pending review</option>
            </select>
          </div>
        </div>
        <div><label className={field} htmlFor="i-evidence">Evidence source</label><textarea id="i-evidence" className="input" rows={2} value={d.evidence_source ?? ''} maxLength={500} onChange={(e) => set('evidence_source', e.target.value)} /></div>

        {d.id && (
          <div className="rounded-[var(--radius-md)] bg-green-50 p-3">
            <label className={field} htmlFor="i-merge">Merge a duplicate</label>
            <p className="field-hint -mt-1 mb-2">Everyone who named this institution will point to the one you choose, and this one is removed.</p>
            <div className="flex flex-wrap gap-2">
              <select id="i-merge" className="input min-w-0 flex-1" value={mergeInto} onChange={(e) => setMergeInto(e.target.value)}>
                <option value="">Merge into...</option>
                {others.map((o) => <option key={o.id} value={o.id}>{o.name}{o.country ? ` (${o.country})` : ''}</option>)}
              </select>
              <button type="button" className="btn btn-ghost" disabled={!mergeInto || busy} onClick={merge}>Merge</button>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-2">
          <button type="button" className="btn btn-ghost" onClick={() => ref.current?.close()}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving' : 'Save'}</button>
        </div>
      </form>
    </dialog>
  )
}
