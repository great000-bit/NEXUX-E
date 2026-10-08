import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isStatus, KIND_INFO, STATUS_LABEL, type EvidenceKind } from '../../lib/verification'
import { formatSize } from '../../lib/fileCheck'
import { StatusBadge } from '../../components/StatusBadge'
import { Notice, Spinner } from '../../components/ui'
import type { Expert } from './csv'

type FileRow = {
  id: string
  kind: string
  label: string | null
  original_name: string
  content_type: string | null
  size_bytes: number | null
  storage_path: string
  state: string
  created_at: string
  deleted_at: string | null
  deleted_reason: string | null
}

type AuditRow = {
  id: number
  actor: string
  actor_type: string
  action: string
  old_status: string | null
  new_status: string | null
  reason: string | null
  notes: string | null
  created_at: string
}

type Decision = 'approve' | 'more_evidence' | 'reject'

const BUCKET = 'expert-evidence'

const DECISIONS: { value: Decision; label: string; result: string; help: string }[] = [
  { value: 'approve', label: 'Approve', result: 'Verified', help: 'The evidence confirms their credentials.' },
  { value: 'more_evidence', label: 'Request more evidence', result: 'More evidence needed', help: 'Ask the expert for specific extra documents.' },
  { value: 'reject', label: 'Reject', result: 'Not verified', help: 'The evidence does not confirm their credentials.' },
]

const ACTION_LABEL: Record<string, string> = {
  submitted_evidence: 'Submitted evidence for review',
  approved: 'Approved (Verified)',
  rejected: 'Rejected (Not verified)',
  requested_more_evidence: 'Asked for more evidence',
  files_deleted: 'Uploaded files deleted',
}

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : ''

const RPC_ERRORS: Record<string, string> = {
  reason_required: 'Please write a message first. The expert will see it, so say what you need or why.',
  not_reviewable: 'This expert has not submitted evidence yet, so there is nothing to decide.',
  not_admin: 'Your account is not on the admin list.',
  not_found: 'We could not find that expert.',
}

async function fetchReview(expertId: string) {
  const [e, f, a] = await Promise.all([
    supabase.from('experts').select('*').eq('expert_id', expertId).maybeSingle(),
    supabase.from('expert_files').select('*').eq('expert_id', expertId).order('created_at'),
    supabase.from('verification_audit').select('*').eq('expert_id', expertId).order('created_at', { ascending: false }),
  ])
  if (e.error || f.error || a.error) return { error: 'load' as const }
  if (!e.data) return { error: 'missing' as const }
  return { expert: e.data as Expert, files: f.data as FileRow[], audit: a.data as AuditRow[] }
}

export default function Review() {
  const { expertId = '' } = useParams()
  const [state, setState] = useState<
    { expert: Expert; files: FileRow[]; audit: AuditRow[] } | { error: 'load' | 'missing' } | null
  >(null)

  const load = useCallback(async () => setState(await fetchReview(expertId)), [expertId])

  useEffect(() => {
    document.title = `Review ${expertId} | Admin | NEXUS-E`
    let live = true
    fetchReview(expertId).then((s) => live && setState(s))
    return () => {
      live = false
    }
  }, [expertId])

  if (!state) return <div className="grid place-items-center py-24 text-green-800"><Spinner label="Loading" className="h-8 w-8" /></div>
  if ('error' in state) {
    return (
      <div className="space-y-4">
        <BackLink />
        <Notice title={state.error === 'missing' ? 'Expert not found' : 'Could not load this expert'}>
          {state.error === 'missing' ? `There is no expert with the ID ${expertId}.` : 'Check your connection and try again.'}
        </Notice>
        {state.error === 'load' && <button className="btn btn-ghost" onClick={() => void load()}>Try again</button>}
      </div>
    )
  }
  return <ReviewBody {...state} reload={load} />
}

function BackLink() {
  return (
    <Link to="/admin/verification" className="inline-flex items-center gap-1 text-sm font-bold text-green-800 underline-offset-4 hover:underline">
      <span aria-hidden="true">&larr;</span> Back to the queue
    </Link>
  )
}

function ReviewBody({ expert, files, audit, reload }: { expert: Expert; files: FileRow[]; audit: AuditRow[]; reload: () => Promise<void> }) {
  const live = files.filter((f) => f.state === 'ready')
  const status = isStatus(expert.verification_status) ? expert.verification_status : 'pending'
  const reviewable = status === 'under_review' || status === 'verified' || status === 'not_verified'

  const [selected, setSelected] = useState<string | null>(live[0]?.id ?? null)
  const [viewer, setViewer] = useState<{ url: string; mime: string } | null>(null)
  const [viewerError, setViewerError] = useState<string | null>(null)

  const [decision, setDecision] = useState<Decision | ''>('')
  const [message, setMessage] = useState('')
  const [notes, setNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)

  const [dangerError, setDangerError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteReason, setDeleteReason] = useState('')

  const current = live.find((f) => f.id === selected) ?? null

  // Make a short lived link for the file being looked at.
  useEffect(() => {
    let alive = true
    if (!current) return
    supabase.storage
      .from(BUCKET)
      .createSignedUrl(current.storage_path, 300)
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data) {
          setViewer(null)
          setViewerError('We could not open this file. Try again, or ask the expert to upload it again.')
        } else {
          setViewerError(null)
          setViewer({ url: data.signedUrl, mime: current.content_type ?? '' })
        }
      })
    return () => {
      alive = false
    }
  }, [current])

  const openInTab = async (f: FileRow) => {
    const tab = window.open('', '_blank')
    const { data } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60)
    if (!data) return tab?.close()
    if (tab) {
      tab.opener = null
      tab.location.href = data.signedUrl
    }
  }

  const needsMessage = decision === 'more_evidence' || decision === 'reject'
  const chosen = DECISIONS.find((d) => d.value === decision)

  const review = async () => {
    setFormError(null)
    if (!decision) return setFormError('Choose what you would like to do first.')
    if (needsMessage && !message.trim()) {
      return setFormError(
        decision === 'reject'
          ? 'Please write the reason. The expert will see it, so keep it kind and specific.'
          : 'Please write what you need. The expert will see this message.',
      )
    }
    setSaving(true)
    const { error } = await supabase.rpc('admin_review_expert', {
      p_expert_id: expert.expert_id,
      p_decision: decision,
      p_reason: needsMessage ? message.trim() : null,
      p_notes: notes.trim() || null,
    })
    setSaving(false)
    setConfirming(false)
    if (error) return setFormError(RPC_ERRORS[error.message] ?? 'We could not save that decision. Please try again.')
    setSaved(`Saved. ${expert.expert_id} is now ${STATUS_LABEL[decision === 'approve' ? 'verified' : decision === 'reject' ? 'not_verified' : 'more_evidence']}, and an email is on its way to the expert.`)
    setDecision('')
    setMessage('')
    setNotes('')
    await reload()
  }

  const exportData = async () => {
    setDangerError(null)
    const { data, error } = await supabase.rpc('admin_export_expert', { p_expert_id: expert.expert_id })
    if (error || !data) return setDangerError('We could not export this expert. Please try again.')
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `nexus-e-${expert.expert_id}-data-${new Date().toISOString().slice(0, 10)}.json`
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }

  const deleteFiles = async () => {
    setDangerError(null)
    setDeleting(true)
    const { data, error } = await supabase.functions.invoke('verification-admin', {
      body: { action: 'delete_files', expert_id: expert.expert_id, reason: deleteReason.trim() },
    })
    setDeleting(false)
    if (error || !data?.ok) return setDangerError('We could not delete the files. Please try again.')
    setDeleteOpen(false)
    setDeleteReason('')
    setSelected(null)
    setViewer(null)
    setSaved(`Deleted ${data.deleted} uploaded ${data.deleted === 1 ? 'file' : 'files'} for ${expert.expert_id}.`)
    await reload()
  }

  const detail: [string, string | null][] = [
    ['Organisation', expert.organisation],
    ['Position', expert.position],
    ['State', expert.state],
    ['Email', expert.email],
    ['Phone', expert.phone ? `+${expert.phone}` : null],
    ['Primary expertise', expert.primary_expertise],
    ['Secondary expertise', expert.secondary_expertise.length ? expert.secondary_expertise.join(', ') : null],
    ['Years of experience', expert.years_experience],
    ['Highest qualification', expert.qualification],
    ['Memberships', expert.memberships.length ? expert.memberships.join(', ') : null],
    ['NES number', expert.nes_number],
    ['IEPN status', expert.iepn_status],
    ['Registered', when(expert.created_at)],
    ['Evidence submitted', when(expert.submitted_at)],
  ]

  return (
    <div className="space-y-6">
      <BackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-green-700">{expert.expert_id}</p>
          <h1 className="mt-1 text-3xl font-semibold text-green-900">{expert.title} {expert.full_name}</h1>
        </div>
        <StatusBadge status={status} className="!text-sm" />
      </div>

      {saved && <Notice tone="success">{saved}</Notice>}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left: registered details */}
        <section className="card p-5" aria-labelledby="details-h" style={{ borderRadius: 'var(--radius-lg)' }}>
          <h2 id="details-h" className="text-lg font-semibold text-green-900">Registered details</h2>
          <dl className="mt-2 divide-y divide-line text-sm">
            {detail.map(([k, v]) => (
              <div key={k} className="grid grid-cols-[9rem_1fr] gap-3 py-2">
                <dt className="font-bold text-ink-500">{k}</dt>
                <dd className="break-words">{v ?? <span className="text-ink-300">Not provided</span>}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Right: evidence and viewer */}
        <section className="card p-5" aria-labelledby="files-h" style={{ borderRadius: 'var(--radius-lg)' }}>
          <h2 id="files-h" className="text-lg font-semibold text-green-900">Uploaded evidence ({live.length})</h2>
          {live.length === 0 ? (
            <p className="mt-2 text-sm text-ink-700">
              {files.some((f) => f.state === 'deleted' && f.deleted_reason !== 'rejected_upload')
                ? 'The uploaded files have been deleted.'
                : 'This expert has not uploaded any files.'}
            </p>
          ) : (
            <>
              <ul className="mt-3 space-y-1.5">
                {live.map((f) => (
                  <li key={f.id}>
                    <button
                      onClick={() => setSelected(f.id)}
                      aria-current={f.id === selected}
                      className={`flex w-full items-center justify-between gap-2 rounded-[var(--radius-md)] border px-3 py-2 text-left text-sm transition ${
                        f.id === selected ? 'border-green-700 bg-green-50' : 'border-line hover:border-green-600'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-semibold">{f.original_name}</span>
                        <span className="block text-xs text-ink-500">
                          {KIND_INFO[f.kind as EvidenceKind]?.title ?? f.kind}
                          {f.label ? ` · ${f.label}` : ''}
                          {f.size_bytes ? ` · ${formatSize(f.size_bytes)}` : ''}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {current && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-ink-700">{current.original_name}</p>
                    <button className="rounded-full px-3 py-1 text-sm font-bold text-green-800 hover:bg-green-100" onClick={() => void openInTab(current)}>
                      Open in a new tab
                    </button>
                  </div>
                  {viewerError && <Notice>{viewerError}</Notice>}
                  {!viewerError && !viewer && <div className="grid h-48 place-items-center text-green-800"><Spinner label="Opening the file" className="h-6 w-6" /></div>}
                  {viewer && viewer.mime.startsWith('image/') && (
                    <img src={viewer.url} alt={`Evidence: ${current.original_name}`} className="max-h-[70vh] w-full rounded-[var(--radius-md)] border border-line bg-paper object-contain" />
                  )}
                  {viewer && viewer.mime === 'application/pdf' && (
                    <iframe title={`Evidence: ${current.original_name}`} src={viewer.url} className="h-[70vh] w-full rounded-[var(--radius-md)] border border-line bg-paper" />
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Decision */}
      <section className="card p-5 sm:p-6" aria-labelledby="decision-h">
        <h2 id="decision-h" className="text-xl font-semibold text-green-900">Your decision</h2>
        {!reviewable ? (
          <p className="mt-2 text-[0.95rem] text-ink-700">
            {status === 'pending'
              ? 'This expert has not submitted any evidence yet, so there is nothing to decide.'
              : 'You asked this expert for more evidence. This page unlocks again when they submit it.'}
          </p>
        ) : (
          <>
            {status !== 'under_review' && (
              <p className="mt-2 text-sm text-ink-700">This expert is already <strong>{STATUS_LABEL[status]}</strong>. You can change the decision if you need to. It will be recorded in the log.</p>
            )}
            <fieldset className="mt-4">
              <legend className="field-label">What would you like to do?</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {DECISIONS.map((d) => (
                  <label key={d.value} className="choice" data-checked={decision === d.value}>
                    <input
                      type="radio"
                      name="decision"
                      className="sr-only"
                      checked={decision === d.value}
                      onChange={() => {
                        setDecision(d.value)
                        setFormError(null)
                        setConfirming(false)
                      }}
                    />
                    <span className="choice-mark choice-radio" aria-hidden="true" />
                    <span className="flex-1">
                      <span className="block text-[0.95rem] font-semibold">{d.label}</span>
                      <span className="block text-sm text-ink-500">{d.help}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {needsMessage && (
              <div className="mt-4">
                <label htmlFor="review-message" className="field-label">
                  {decision === 'reject' ? 'Reason' : 'Message to the expert'}
                  <span className="ml-1 text-danger-600" aria-hidden="true">*</span>
                </label>
                <textarea
                  id="review-message"
                  className="input min-h-28"
                  maxLength={1000}
                  value={message}
                  aria-invalid={formError && !message.trim() ? true : undefined}
                  onChange={(e) => {
                    setMessage(e.target.value)
                    setFormError(null)
                  }}
                />
                <p className="field-hint">
                  The expert receives this in an email and on their page. {decision === 'reject' ? 'Be kind and specific about what was missing.' : 'Say exactly which documents you need.'}
                </p>
              </div>
            )}

            <div className="mt-4">
              <label htmlFor="review-notes" className="field-label">
                Internal notes<span className="ml-2 text-xs font-medium text-ink-500">Optional, never shown to the expert</span>
              </label>
              <textarea id="review-notes" className="input min-h-20" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            {formError && <p className="field-error" role="alert">{formError}</p>}

            {!confirming ? (
              <button
                className="btn btn-primary mt-5 w-full sm:w-auto sm:px-10"
                onClick={() => {
                  if (!decision) return setFormError('Choose what you would like to do first.')
                  if (needsMessage && !message.trim()) return void review()
                  setFormError(null)
                  setConfirming(true)
                }}
              >
                Continue
              </button>
            ) : (
              <div className="mt-5 rounded-[var(--radius-md)] border-2 border-green-700 bg-green-50 p-4" role="alertdialog" aria-labelledby="confirm-h">
                <p id="confirm-h" className="font-bold text-green-900">
                  Mark {expert.expert_id} as {chosen?.result}?
                </p>
                <p className="mt-1 text-sm text-ink-700">An email will be sent to the expert and the decision is recorded in the log with your name.</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button className="btn btn-primary !min-h-11" onClick={() => void review()} disabled={saving}>
                    {saving ? (<><Spinner label="Saving" /> Saving</>) : `Yes, ${chosen?.label.toLowerCase()}`}
                  </button>
                  <button className="btn btn-ghost !min-h-11" onClick={() => setConfirming(false)} disabled={saving}>Go back</button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      {/* Log */}
      <section className="card p-5 sm:p-6" aria-labelledby="log-h">
        <h2 id="log-h" className="text-xl font-semibold text-green-900">Decision log</h2>
        <p className="mt-1 text-sm text-ink-500">Every action is recorded. Nobody can edit or delete this log.</p>
        {audit.length === 0 ? (
          <p className="mt-3 text-sm text-ink-700">Nothing recorded yet.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {audit.map((a) => (
              <li key={a.id} className="rounded-[var(--radius-md)] bg-green-50 px-4 py-3 text-sm">
                <p className="font-bold text-green-900">
                  {ACTION_LABEL[a.action] ?? a.action}
                  {a.old_status && a.new_status && a.old_status !== a.new_status && (
                    <span className="ml-2 font-medium text-ink-500">
                      {STATUS_LABEL[isStatus(a.old_status) ? a.old_status : 'pending']} to {STATUS_LABEL[isStatus(a.new_status) ? a.new_status : 'pending']}
                    </span>
                  )}
                </p>
                <p className="text-ink-500">{when(a.created_at)} · {a.actor_type === 'expert' ? 'the expert' : a.actor}</p>
                {a.reason && <p className="mt-1 whitespace-pre-wrap text-ink-900"><span className="font-bold">Message or reason:</span> {a.reason}</p>}
                {a.notes && <p className="mt-1 whitespace-pre-wrap text-ink-900"><span className="font-bold">Internal note:</span> {a.notes}</p>}
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Data requests */}
      <section className="card p-5 sm:p-6" aria-labelledby="data-h">
        <h2 id="data-h" className="text-xl font-semibold text-green-900">Data requests</h2>
        <p className="mt-1 text-sm text-ink-700">
          For when an expert asks to see or delete what we hold about them. The export lists their record, the files uploaded (names only), the decision log and the emails sent.
        </p>
        {dangerError && <div className="mt-3"><Notice>{dangerError}</Notice></div>}
        <div className="mt-4 flex flex-wrap gap-3">
          <button className="btn btn-ghost" onClick={() => void exportData()}>Export this expert&rsquo;s data</button>
          <button className="btn btn-ghost !border-danger-600 !text-danger-600" onClick={() => setDeleteOpen((o) => !o)} disabled={live.length === 0}>
            Delete uploaded files
          </button>
        </div>
        {deleteOpen && (
          <div className="mt-4 rounded-[var(--radius-md)] border-2 border-danger-600 bg-danger-100 p-4" role="alertdialog" aria-labelledby="del-h">
            <p id="del-h" className="font-bold text-danger-600">Delete all {live.length} uploaded files for {expert.expert_id}?</p>
            <p className="mt-1 text-sm text-ink-900">The files are removed from storage and cannot be recovered. The decision log stays.</p>
            <label htmlFor="delete-reason" className="field-label mt-3">Reason<span className="ml-2 text-xs font-medium text-ink-500">Optional</span></label>
            <input id="delete-reason" className="input" value={deleteReason} maxLength={300} onChange={(e) => setDeleteReason(e.target.value)} placeholder="For example: expert asked for deletion" />
            <div className="mt-3 flex flex-wrap gap-2">
              <button className="btn !min-h-11 bg-danger-600 text-white" onClick={() => void deleteFiles()} disabled={deleting}>
                {deleting ? (<><Spinner label="Deleting" /> Deleting</>) : 'Yes, delete the files'}
              </button>
              <button className="btn btn-ghost !min-h-11" onClick={() => setDeleteOpen(false)} disabled={deleting}>Keep them</button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}
