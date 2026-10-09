import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { CheckList, RadioList, SelectField, TextAreaField, TextField } from '../../components/fields'
import { OppBadge } from '../../components/OppBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { ErrorSummary, Notice, Spinner } from '../../components/ui'
import { ASSIGNMENTS, EXPERTISE } from '../../lib/options'
import {
  deadlineNote, describeLogEntry, EMPTY_OPP, formatDay, OPP_ERRORS, OPP_FIELD_LABEL, validateOpportunity,
  type AdminOpportunity, type InterestedExpert, type OppField, type OppForm, type OppStatus, type OpportunityLogEntry,
} from '../../lib/opportunities'
import { supabase } from '../../lib/supabase'
import { csvFileName, downloadCsvText, interestToCsv } from './csv'

type Loaded =
  | { id: string; opp: AdminOpportunity | null; interest: InterestedExpert[]; log: OpportunityLogEntry[] }
  | { id: string; error: string }

const FIELD_ORDER: OppField[] = ['title', 'description', 'opp_type', 'expertise_needed', 'location', 'deadline']
const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', sub: 'Only administrators can see it.' },
  { value: 'open', label: 'Open', sub: 'Experts can see it and express interest until the deadline.' },
  { value: 'closed', label: 'Closed', sub: 'Hidden from experts. No more interest can be expressed.' },
]

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-NG', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })

const LOAD_ERROR = 'Could not load this opportunity. Check your connection and try again.'

export default function OpportunityEdit() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [reload, setReload] = useState(0)
  const location = useLocation()
  const [flash, setFlash] = useState<string | null>(() => (location.state as { flash?: string } | null)?.flash ?? null)

  useEffect(() => {
    document.title = `${id ? 'Opportunity' : 'New opportunity'} | Admin | NEXUS-E`
    if (!id) return
    let live = true
    Promise.all([
      supabase.rpc('admin_list_opportunities'),
      supabase.rpc('admin_opportunity_interest', { p_id: id }),
      supabase.rpc('admin_opportunity_log', { p_id: id }),
    ]).then(([list, interest, log]) => {
      if (!live) return
      if (list.error || interest.error || log.error) return setLoaded({ id, error: LOAD_ERROR })
      const opp = ((list.data as AdminOpportunity[]) ?? []).find((o) => o.id === id) ?? null
      setLoaded({ id, opp, interest: (interest.data as InterestedExpert[]) ?? [], log: (log.data as OpportunityLogEntry[]) ?? [] })
    })
    return () => {
      live = false
    }
  }, [id, reload])

  const back = (
    <Link to="/admin/opportunities" className="text-sm font-bold text-green-800 underline underline-offset-4">All opportunities</Link>
  )

  if (!id) {
    return (
      <div className="space-y-5">
        {back}
        <h1 className="text-3xl font-semibold text-green-900">New opportunity</h1>
        <Editor
          key="new"
          initial={null}
          onSaved={(newId) => {
            navigate(`/admin/opportunities/${newId}`, { replace: true, state: { flash: 'Saved. It will show here who is interested once experts respond.' } })
          }}
        />
      </div>
    )
  }

  const current = loaded?.id === id ? loaded : null
  if (!current) {
    return <div className="grid place-items-center py-24 text-green-800"><Spinner label="Loading the opportunity" className="h-8 w-8" /></div>
  }
  if ('error' in current) {
    return (
      <div className="space-y-4">
        {back}
        <Notice title="We could not load this opportunity">{current.error}</Notice>
        <button className="btn btn-primary" onClick={() => { setLoaded(null); setReload((r) => r + 1) }}>Try again</button>
      </div>
    )
  }
  if (!current.opp) {
    return (
      <div className="space-y-4">
        {back}
        <h1 className="text-3xl font-semibold text-green-900">Opportunity not found</h1>
        <p className="text-ink-700">It may have been deleted. Go back to the list to see what is there.</p>
      </div>
    )
  }

  const opp = current.opp
  return (
    <div className="space-y-6">
      {back}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="min-w-0 break-words text-3xl font-semibold text-green-900">{opp.title}</h1>
        <OppBadge status={opp.status} expired={opp.expired} />
      </div>
      {flash && <Notice tone="success">{flash}</Notice>}
      {opp.expired && (
        <Notice tone="info" title="The deadline has passed">
          Experts no longer see this opportunity and cannot express interest. Close it to tidy up, or set a later deadline to open it again.
        </Notice>
      )}

      <Editor
        key={opp.updated_at}
        initial={opp}
        onSaved={() => {
          setFlash('Saved.')
          setReload((r) => r + 1)
        }}
        onDeleted={() => navigate('/admin/opportunities', { replace: true })}
      />

      <InterestPanel opp={opp} rows={current.interest} />
      <LogPanel entries={current.log} />
    </div>
  )
}

function Editor({
  initial,
  onSaved,
  onDeleted,
}: {
  initial: AdminOpportunity | null
  onSaved: (id: string) => void
  onDeleted?: () => void
}) {
  const [form, setForm] = useState<OppForm>(
    initial
      ? {
          title: initial.title,
          description: initial.description,
          opp_type: initial.opp_type,
          expertise_needed: initial.expertise_needed,
          location: initial.location,
          deadline: initial.deadline,
          status: initial.status,
        }
      : EMPTY_OPP,
  )
  const [errors, setErrors] = useState<Partial<Record<OppField, string>>>({})
  const [saving, setSaving] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const summaryRef = useRef<HTMLDivElement>(null)

  const set = <K extends keyof OppForm>(key: K, value: OppForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }))
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }))
  }

  const jump = (anchor: string) => {
    const el = document.getElementById(`field-${anchor}`)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    el?.focus({ preventScroll: true })
  }

  const items = FIELD_ORDER.filter((k) => errors[k]).map((k) => ({
    key: k,
    label: `${OPP_FIELD_LABEL[k]}: ${errors[k]}`,
    anchor: k,
  }))

  const save = async (e: FormEvent) => {
    e.preventDefault()
    setServerError(null)
    const found = validateOpportunity(form)
    setErrors(found)
    const first = FIELD_ORDER.find((k) => found[k])
    if (first) {
      // Let the summary render, then take the person to it.
      requestAnimationFrame(() => {
        summaryRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
        summaryRef.current?.focus({ preventScroll: true })
      })
      return
    }
    setSaving(true)
    const { data, error } = await supabase.rpc('admin_save_opportunity', {
      p_id: initial?.id ?? null,
      p_payload: { ...form, title: form.title.trim(), description: form.description.trim(), location: form.location.trim() },
    })
    setSaving(false)
    if (error) return setServerError(OPP_ERRORS[error.message] ?? 'We could not save this. Please check your connection and try again.')
    onSaved((data as { id: string }).id)
  }

  const remove = async () => {
    if (!initial) return
    setDeleting(true)
    const { error } = await supabase.rpc('admin_delete_opportunity', { p_id: initial.id })
    setDeleting(false)
    if (error) {
      setConfirmDelete(false)
      return setServerError(OPP_ERRORS[error.message] ?? 'We could not delete this. Please try again.')
    }
    onDeleted?.()
  }

  return (
    <form onSubmit={save} noValidate className="card space-y-5 p-5 sm:p-7" aria-label={initial ? 'Edit opportunity' : 'New opportunity'}>
      <div ref={summaryRef} tabIndex={-1} className="outline-none">
        <ErrorSummary items={items} onJump={jump} />
      </div>
      {serverError && <Notice>{serverError}</Notice>}

      <TextField fieldKey="title" label="Title" required value={form.title} onChange={(v) => set('title', v)} error={errors.title} />
      <TextAreaField
        fieldKey="description"
        label="Description"
        required
        rows={7}
        maxLength={4000}
        hint="What the work is, who it is for and anything an expert needs to know. Plain text, line breaks are kept."
        value={form.description}
        onChange={(v) => set('description', v)}
        error={errors.description}
      />
      <SelectField
        fieldKey="opp_type"
        label="Type of assignment"
        required
        options={ASSIGNMENTS}
        value={form.opp_type}
        onChange={(v) => set('opp_type', v)}
        error={errors.opp_type}
        hint="The same options experts chose when they registered, so matching works."
      />
      <CheckList
        fieldKey="expertise_needed"
        legend="Expertise needed"
        required
        options={EXPERTISE}
        values={form.expertise_needed}
        onChange={(v) => set('expertise_needed', v)}
        error={errors.expertise_needed}
        hint="An expert matches if any of these is their primary or secondary expertise."
        columns={2}
      />
      <TextField fieldKey="location" label="Location" required value={form.location} onChange={(v) => set('location', v)} error={errors.location} hint="For example Lagos, Remote or Niger Delta." />
      <TextField
        fieldKey="deadline"
        label="Deadline"
        required
        type="date"
        value={form.deadline}
        onChange={(v) => set('deadline', v)}
        error={errors.deadline}
        hint="The last day experts can express interest. It stays open through the whole of that day, West Africa Time (UTC+1)."
      />
      <RadioList
        fieldKey="status"
        legend="Status"
        required
        options={STATUS_OPTIONS}
        value={form.status}
        onChange={(v) => set('status', v as OppStatus)}
      />

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
        <button type="submit" className="btn btn-primary w-full sm:w-auto sm:px-10" disabled={saving}>
          {saving ? (<><Spinner label="Saving" /> Saving</>) : initial ? 'Save changes' : 'Create opportunity'}
        </button>
        {initial && !confirmDelete && (
          <button type="button" className="btn btn-ghost w-full !border-danger-600/40 !text-danger-600 sm:ml-auto sm:w-auto" onClick={() => setConfirmDelete(true)}>
            Delete opportunity
          </button>
        )}
      </div>

      {initial && confirmDelete && (
        <div role="alert" className="rounded-[var(--radius-md)] border-2 border-danger-600 bg-danger-100 p-4">
          <p className="font-bold text-danger-600">Delete this opportunity for good?</p>
          <p className="mt-1 text-sm text-ink-900">
            {initial.interested > 0
              ? `${initial.interested} expert${initial.interested === 1 ? ' has' : 's have'} expressed interest, and that list will be lost. `
              : ''}
            This cannot be undone. The deletion is recorded in the change log. If you only want experts to stop seeing it, set the status to Closed instead.
          </p>
          <div className="mt-3 flex flex-wrap gap-3">
            <button type="button" className="btn !bg-danger-600 !text-white" onClick={() => void remove()} disabled={deleting}>
              {deleting ? (<><Spinner label="Deleting" /> Deleting</>) : 'Yes, delete it'}
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
          </div>
        </div>
      )}
    </form>
  )
}

function InterestPanel({ opp, rows }: { opp: AdminOpportunity; rows: InterestedExpert[] }) {
  return (
    <section className="card p-5 sm:p-7" aria-labelledby="interest-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="interest-title" className="text-xl font-semibold text-green-900">Interested experts ({rows.length})</h2>
          <p className="text-sm text-ink-500">
            Experts who have said they are interested, with the details they registered. Anyone who withdraws disappears from this list.
          </p>
        </div>
        <button
          className="btn btn-ghost !min-h-11 !px-4"
          disabled={rows.length === 0}
          onClick={() => downloadCsvText(interestToCsv(rows), csvFileName('interested', opp.title))}
        >
          Export CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 text-[0.95rem] text-ink-700">
          {opp.status === 'open' && !opp.expired
            ? 'Nobody has expressed interest yet. You will get an email when someone does.'
            : 'Nobody expressed interest.'}
        </p>
      ) : (
        <ul className="mt-4 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.expert_id} className="grid grid-cols-1 gap-2 py-4 sm:grid-cols-[1fr_auto] sm:gap-4">
              <div className="min-w-0">
                <p className="break-words font-bold text-green-900">
                  {r.title} {r.full_name}
                  <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">{r.expert_id}</span>
                </p>
                <p className="break-words text-sm text-ink-700">{r.position}, {r.organisation} · {r.state}, {r.country ?? 'Nigeria'}</p>
                <p className="mt-1 break-words text-sm text-ink-700">
                  {r.primary_expertise}
                  {r.secondary_expertise.length ? ` (also ${r.secondary_expertise.join(', ')})` : ''}
                </p>
                <p className="text-sm text-ink-500">{r.years_experience} years · {r.qualification}</p>
                {r.memberships.length > 0 && <p className="break-words text-sm text-ink-500">Memberships: {r.memberships.join(', ')}</p>}
                {r.assignments.length > 0 && <p className="break-words text-sm text-ink-500">Open to: {r.assignments.join(', ')}</p>}
                <p className="text-sm text-ink-500">Can work: {r.availability}</p>
                <p className="mt-1 break-all text-sm font-semibold text-ink-900">
                  {r.email ?? 'No email'}{r.phone ? ` · +${r.phone}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-start gap-2 sm:flex-col sm:items-end">
                <StatusBadge status={r.verification_status} />
                <p className="text-xs text-ink-500">Interested {when(r.interested_at)}</p>
                <Link to={`/admin/verification/${r.expert_id}`} className="min-h-11 py-2 text-sm font-bold text-green-800 underline underline-offset-4">
                  View record
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-4 text-xs text-ink-500">
        {opp.status === 'open' && !opp.expired ? `Deadline ${formatDay(opp.deadline)} (${deadlineNote(opp.deadline).toLowerCase()}).` : `Deadline ${formatDay(opp.deadline)}.`}
      </p>
    </section>
  )
}

function LogPanel({ entries }: { entries: OpportunityLogEntry[] }) {
  return (
    <section className="card p-5 sm:p-7" aria-labelledby="log-title">
      <h2 id="log-title" className="text-xl font-semibold text-green-900">Change log</h2>
      <p className="text-sm text-ink-500">Every change an administrator makes is recorded here and cannot be edited.</p>
      <ul className="mt-4 space-y-3">
        {entries.map((e, i) => (
          <li key={i} className="text-sm">
            <p className="text-ink-900">{describeLogEntry(e.action, e.detail)}</p>
            <p className="break-words text-xs text-ink-500">{when(e.created_at)} · {e.actor}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
