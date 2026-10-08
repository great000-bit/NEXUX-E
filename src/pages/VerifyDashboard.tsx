import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { StatusBadge } from '../components/StatusBadge'
import { Notice, Spinner } from '../components/ui'
import { checkBeforeUpload, formatSize } from '../lib/fileCheck'
import {
  call, clearSession, getSession, uploadToSignedUrl,
  type EvidenceFile, type MeResponse,
} from '../lib/portal'
import {
  BODIES, isStatus, KIND_INFO, MAX_FILES, STATUS_HELP, STATUS_LABEL,
  type EvidenceKind,
} from '../lib/verification'

type Transfer = { key: string; kind: EvidenceKind; name: string; progress: number; phase: 'sending' | 'checking' }

const KINDS: EvidenceKind[] = ['membership', 'licence', 'qualification', 'cv']

const when = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' }) : ''

export default function VerifyDashboard() {
  const navigate = useNavigate()
  const [me, setMe] = useState<MeResponse | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [transfers, setTransfers] = useState<Transfer[]>([])
  const [slotErrors, setSlotErrors] = useState<Partial<Record<EvidenceKind, string>>>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [agree, setAgree] = useState(false)
  const [agreeError, setAgreeError] = useState<string | null>(null)
  const [savingConsent, setSavingConsent] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)

  const token = getSession()?.token

  const endSession = useCallback(
    (message: string) => {
      clearSession()
      navigate('/verify', { replace: true, state: { message } })
    },
    [navigate],
  )

  const refresh = useCallback(async () => {
    if (!token) return endSession('Please sign in to see your verification.')
    const res = await call<MeResponse>('me', {}, token)
    if (!res.ok) {
      if (res.error === 'session_expired') return endSession('Your session has ended, so please sign in again.')
      setLoadError(res.message)
      return
    }
    setLoadError(null)
    setMe(res)
  }, [token, endSession])

  useEffect(() => {
    document.title = 'Your verification | NEXUS-E'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh()
  }, [refresh])

  if (!token) return null

  if (loadError && !me) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Notice title="We could not load your page">{loadError}</Notice>
        <button className="btn btn-primary" onClick={() => void refresh()}>Try again</button>
      </div>
    )
  }
  if (!me) {
    return <div className="grid place-items-center py-24 text-green-800"><Spinner label="Loading your verification" className="h-8 w-8" /></div>
  }

  const { expert, files, editable, consented } = me
  const status = isStatus(expert.verification_status) ? expert.verification_status : 'pending'
  const evidenceCount = files.length + transfers.length
  const hasEvidence = files.some((f) => f.kind !== 'cv')

  const setSlotError = (kind: EvidenceKind, message?: string) =>
    setSlotErrors((s) => ({ ...s, [kind]: message }))

  const giveConsent = async () => {
    if (!agree) {
      setAgreeError('Please tick the box to confirm you have read this and agree.')
      document.getElementById('agree-privacy')?.focus()
      return
    }
    setSavingConsent(true)
    const res = await call('consent', {}, token)
    setSavingConsent(false)
    if (!res.ok) return setAgreeError(res.message)
    await refresh()
  }

  const addFile = async (kind: EvidenceKind, label: string, file: File) => {
    setSlotError(kind, undefined)
    setSubmitError(null)
    if (evidenceCount >= MAX_FILES) {
      return setSlotError(kind, `You can keep up to ${MAX_FILES} files. Please delete one before adding another.`)
    }
    const check = await checkBeforeUpload(file)
    if (!check.ok) return setSlotError(kind, check.message)

    const key = crypto.randomUUID()
    const patch = (p: Partial<Transfer>) => setTransfers((t) => t.map((x) => (x.key === key ? { ...x, ...p } : x)))
    const drop = () => setTransfers((t) => t.filter((x) => x.key !== key))
    setTransfers((t) => [...t, { key, kind, name: file.name, progress: 0, phase: 'sending' }])

    const slot = await call<{ file_id: string; upload_url: string }>(
      'upload_url',
      { kind, label: kind === 'membership' ? label : null, filename: file.name, size: file.size },
      token,
    )
    if (!slot.ok) {
      drop()
      if (slot.error === 'session_expired') return endSession('Your session has ended, so please sign in again.')
      return setSlotError(kind, slot.message)
    }
    const sent = await uploadToSignedUrl(slot.upload_url, file, check.mime, (f) => patch({ progress: f }))
    if (!sent.ok) {
      // Free the slot straight away so a failed attempt does not count against the limit.
      await call('delete_file', { file_id: slot.file_id }, token)
      drop()
      return setSlotError(kind, sent.message)
    }
    patch({ progress: 1, phase: 'checking' })
    const done = await call('finalize', { file_id: slot.file_id }, token)
    drop()
    if (!done.ok) return setSlotError(kind, done.message)
    await refresh()
  }

  const removeFile = async (f: EvidenceFile) => {
    const kind = f.kind as EvidenceKind
    setSlotError(kind, undefined)
    const res = await call('delete_file', { file_id: f.id }, token)
    if (!res.ok) return setSlotError(kind, res.message)
    await refresh()
  }

  const viewFile = async (f: EvidenceFile) => {
    // Open the tab first, inside the click, so pop-up blockers allow it.
    const tab = window.open('', '_blank')
    const res = await call<{ url: string }>('file_url', { file_id: f.id }, token)
    if (!res.ok) {
      tab?.close()
      return setSlotError(f.kind as EvidenceKind, res.message)
    }
    if (tab) {
      tab.opener = null
      tab.location.href = res.url
    }
  }

  const submit = async () => {
    setSubmitError(null)
    setSubmitting(true)
    const res = await call('submit', {}, token)
    setSubmitting(false)
    if (!res.ok) {
      if (res.error === 'session_expired') return endSession('Your session has ended, so please sign in again.')
      return setSubmitError(res.message)
    }
    await refresh()
    window.scrollTo({ top: 0, behavior: 'smooth' })
    headingRef.current?.focus()
  }

  const signOut = async () => {
    await call('sign_out', {}, token)
    clearSession()
    navigate('/verify', { replace: true, state: { message: 'You have signed out.' } })
  }

  return (
    <div className="space-y-6">
      {/* Status */}
      <section className="card p-5 sm:p-7" aria-labelledby="verify-title">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-green-700">Your Expert ID</p>
            <h1 id="verify-title" ref={headingRef} tabIndex={-1} className="mt-1 font-display text-4xl font-semibold text-green-900 outline-none"
              style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}>
              {expert.expert_id}
            </h1>
            <p className="mt-1 text-ink-700">{expert.title} {expert.full_name}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={status} className="!text-sm" />
          </div>
        </div>
        <p className="mt-4 text-[0.95rem] text-ink-700" role="status">
          <span className="font-bold text-green-900">{STATUS_LABEL[status]}. </span>
          {STATUS_HELP[status]}
          {status === 'under_review' && expert.submitted_at ? ` You submitted on ${when(expert.submitted_at)}.` : ''}
          {status === 'verified' && expert.verified_at ? ` Verified on ${when(expert.verified_at)}.` : ''}
        </p>
        {(status === 'more_evidence' || status === 'not_verified') && expert.review_message && (
          <blockquote className="mt-4 rounded-[var(--radius-md)] border-l-4 border-green-700 bg-green-100 p-4 text-[0.95rem] text-ink-900">
            <p className="text-xs font-bold uppercase tracking-wider text-green-800">
              {status === 'more_evidence' ? 'Message from our reviewer' : 'Reason'}
            </p>
            <p className="mt-1 whitespace-pre-wrap">{expert.review_message}</p>
          </blockquote>
        )}
      </section>

      {/* Evidence */}
      <section aria-labelledby="evidence-title" className="space-y-4">
        <div>
          <h2 id="evidence-title" className="text-2xl font-semibold text-green-900">Your evidence</h2>
          <p className="mt-1 text-[0.95rem] text-ink-700">
            PDF, JPG or PNG only, up to 5 MB each, and up to {MAX_FILES} files. {evidenceCount} of {MAX_FILES} used.
          </p>
        </div>

        {editable && !consented && (
          <div className="card p-5 sm:p-6">
            <h3 className="text-lg font-semibold text-green-900">Before you upload: how we use your documents</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-[0.95rem] text-ink-700">
              <li><strong>What we collect.</strong> Only the documents you choose to upload, such as a membership card, a licence or a certificate. They may contain personal details.</li>
              <li><strong>Who can see them.</strong> You, and the small team of NEXUS-E administrators who review verification. Nobody else. They are never shown in any directory or shared with organisations.</li>
              <li><strong>Why.</strong> To check your membership, licence and qualification so we can give you Verified Expert status.</li>
              <li><strong>How long.</strong> Files are kept while we review them. If we cannot verify you, they are deleted after a short retention period. You can delete a file yourself until you submit, and you can ask us to delete or send you your data at any time.</li>
              <li><strong>How they are protected.</strong> Files are stored privately and are opened only through short lived links.</li>
            </ul>
            <label className="choice mt-4" data-checked={agree} data-error={agreeError ? true : undefined}>
              <input
                id="agree-privacy"
                type="checkbox"
                className="sr-only"
                checked={agree}
                aria-invalid={agreeError ? true : undefined}
                aria-describedby={agreeError ? 'agree-privacy-err' : undefined}
                onChange={(e) => {
                  setAgree(e.target.checked)
                  setAgreeError(null)
                }}
              />
              <span className="choice-mark choice-check" aria-hidden="true" />
              <span className="flex-1 text-[0.95rem] leading-snug">I have read this and I agree to NEXUS-E processing my documents for verification.</span>
            </label>
            {agreeError && <p id="agree-privacy-err" className="field-error">{agreeError}</p>}
            <button className="btn btn-primary mt-5 w-full sm:w-auto" onClick={giveConsent} disabled={savingConsent}>
              {savingConsent ? (<><Spinner label="Saving" /> Saving</>) : 'Continue to upload'}
            </button>
          </div>
        )}

        {(consented || !editable) && (
          <div className="space-y-4">
            {KINDS.map((kind) => (
              <Slot
                key={kind}
                kind={kind}
                files={files.filter((f) => f.kind === kind)}
                transfers={transfers.filter((t) => t.kind === kind)}
                editable={editable}
                full={evidenceCount >= MAX_FILES}
                error={slotErrors[kind]}
                onAdd={(label, file) => addFile(kind, label, file)}
                onRemove={removeFile}
                onView={viewFile}
              />
            ))}
          </div>
        )}
      </section>

      {/* Submit */}
      {editable && consented && (
        <section className="card p-5 sm:p-6" aria-labelledby="submit-title">
          <h2 id="submit-title" className="text-xl font-semibold text-green-900">Ready to submit?</h2>
          <p className="mt-1 text-[0.95rem] text-ink-700">
            Add at least one membership, licence or qualification document. After you submit, your files are locked while we review them.
          </p>
          {submitError && <div className="mt-3"><Notice>{submitError}</Notice></div>}
          <button
            className="btn btn-primary mt-4 w-full sm:w-auto sm:px-10"
            onClick={submit}
            disabled={submitting || !hasEvidence || transfers.length > 0}
          >
            {submitting ? (<><Spinner label="Submitting" /> Submitting</>) : 'Submit for review'}
          </button>
          {!hasEvidence && (
            <p className="mt-2 text-sm text-ink-500">The button turns on once you have added a membership, licence or qualification document.</p>
          )}
        </section>
      )}

      {/* Registered details */}
      <section className="card p-5 sm:p-6" aria-labelledby="details-title">
        <h2 id="details-title" className="text-xl font-semibold text-green-900">Details you registered with</h2>
        <dl className="mt-3 divide-y divide-line text-sm">
          {([
            ['Organisation', expert.organisation],
            ['Position', expert.position],
            ['State', expert.state],
            ['Email', expert.email],
            ['Phone', expert.phone ? `+${expert.phone}` : null],
            ['Primary expertise', expert.primary_expertise],
            ['Years of experience', expert.years_experience],
            ['Highest qualification', expert.qualification],
            ['Memberships', expert.memberships.length ? expert.memberships.join(', ') : null],
            ['Availability', expert.availability],
            ['Listed in the directory', expert.discoverable ? 'Yes' : 'No'],
            ['Registered', when(expert.created_at)],
          ] as [string, string | null][]).map(([k, v]) => (
            <div key={k} className="grid grid-cols-[9.5rem_1fr] gap-3 py-2.5">
              <dt className="font-bold text-ink-500">{k}</dt>
              <dd className="break-words text-ink-900">{v ?? <span className="text-ink-300">Not provided</span>}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-ink-500">To change these details, please contact the NEXUS-E team.</p>
      </section>

      <div className="flex justify-center">
        <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
      </div>
    </div>
  )
}

function Slot({
  kind, files, transfers, editable, full, error, onAdd, onRemove, onView,
}: {
  kind: EvidenceKind
  files: EvidenceFile[]
  transfers: Transfer[]
  editable: boolean
  full: boolean
  error?: string
  onAdd: (label: string, file: File) => void
  onRemove: (f: EvidenceFile) => void
  onView: (f: EvidenceFile) => void
}) {
  const info = KIND_INFO[kind]
  const [label, setLabel] = useState('')
  const [labelError, setLabelError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const idBase = `slot-${kind}`

  const choose = () => {
    if (kind === 'membership' && !label) {
      setLabelError('Choose which professional body this document is from, then add the file.')
      document.getElementById(`${idBase}-body`)?.focus()
      return
    }
    setLabelError(null)
    input.current?.click()
  }

  return (
    <div className="card p-5" style={{ borderRadius: 'var(--radius-lg)' }}>
      <h3 className="text-lg font-semibold text-green-900">{info.title}</h3>
      <p className="mt-0.5 text-sm text-ink-500">{info.help}</p>

      {(files.length > 0 || transfers.length > 0) && (
        <ul className="mt-4 space-y-2">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-md)] bg-green-50 px-3 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink-900">{f.original_name}</p>
                <p className="text-xs text-ink-500">
                  {f.label ? `${f.label} · ` : ''}
                  {f.content_type === 'application/pdf' ? 'PDF' : f.content_type === 'image/png' ? 'PNG' : 'JPG'}
                  {f.size_bytes ? ` · ${formatSize(f.size_bytes)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <button className="rounded-full px-3 py-1.5 text-sm font-bold text-green-800 hover:bg-green-100" onClick={() => onView(f)}>
                  View<span className="sr-only"> {f.original_name}</span>
                </button>
                {editable &&
                  (confirming === f.id ? (
                    <>
                      <button className="rounded-full bg-danger-600 px-3 py-1.5 text-sm font-bold text-white" onClick={() => { setConfirming(null); onRemove(f) }}>
                        Yes, delete
                      </button>
                      <button className="rounded-full px-3 py-1.5 text-sm font-bold text-ink-700 hover:bg-line" onClick={() => setConfirming(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button className="rounded-full px-3 py-1.5 text-sm font-bold text-danger-600 hover:bg-danger-100" onClick={() => setConfirming(f.id)}>
                      Delete<span className="sr-only"> {f.original_name}</span>
                    </button>
                  ))}
              </div>
            </li>
          ))}
          {transfers.map((t) => (
            <li key={t.key} className="rounded-[var(--radius-md)] bg-green-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <p className="truncate font-semibold text-ink-900">{t.name}</p>
                <p className="flex-none text-xs font-bold text-green-800" role="status">
                  {t.phase === 'checking' ? 'Checking the file' : `${Math.round(t.progress * 100)}%`}
                </p>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-green-100"
                role="progressbar"
                aria-label={`Uploading ${t.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(t.progress * 100)}
              >
                <div
                  className="h-full rounded-full bg-gradient-to-r from-green-700 to-green-500"
                  style={{ width: `${Math.round(t.progress * 100)}%`, transition: 'width 200ms var(--ease)' }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="field-error" role="alert">{error}</p>}

      {editable && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          {kind === 'membership' && (
            <div className="min-w-[10rem] flex-1">
              <label htmlFor={`${idBase}-body`} className="field-label">Professional body</label>
              <select
                id={`${idBase}-body`}
                className="input"
                value={label}
                aria-invalid={labelError ? true : undefined}
                aria-describedby={labelError ? `${idBase}-body-err` : undefined}
                onChange={(e) => { setLabel(e.target.value); setLabelError(null) }}
              >
                <option value="">Select</option>
                {BODIES.map((b) => <option key={b} value={b}>{b === 'Other' ? 'Other body' : b}</option>)}
              </select>
              {labelError && <p id={`${idBase}-body-err`} className="field-error">{labelError}</p>}
            </div>
          )}
          <input
            ref={input}
            type="file"
            className="sr-only"
            tabIndex={-1}
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            aria-label={`Choose a file for ${info.title}`}
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) onAdd(label, f)
            }}
          />
          <button className="btn btn-ghost" onClick={choose} disabled={full}>
            {files.length + transfers.length > 0 ? 'Add another file' : 'Add a file'}
          </button>
        </div>
      )}
    </div>
  )
}
