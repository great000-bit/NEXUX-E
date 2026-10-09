import { usePageInfo } from '../lib/pageInfo'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  emptyForm, errorList, EXPERT_ID_KEY, FIELD_INFO, firstInvalidStep, STEP_NAMES, STORAGE_KEY, validateStep,
  type ErrorKey, type Errors, type FormData, type StepIndex,
} from '../lib/form'
import {
  ASSIGNMENTS, AVAILABILITY, EXPERTISE, MAX_SECONDARY, MEMBERSHIPS,
  QUALIFICATIONS, STATES, TITLES, YEARS,
} from '../lib/options'
import { registerExpert } from '../lib/api'
import { CheckList, ConsentBox, fieldId, RadioList, SelectField, TextField } from '../components/fields'
import { ErrorSummary, Notice, ProgressBar, Spinner } from '../components/ui'
import { Turnstile } from '../components/Turnstile'

const STEP_TITLES = ['Tell us who you are', 'Your expertise', 'Your opportunity profile']
const STEP_INTROS = [
  'We use these details to create your record and to reach you.',
  'Choose the areas where you are strongest. You can add up to three secondary areas.',
  'Tell organisations how you can help, and confirm your consent.',
]

const sentBackNote = (step: StepIndex) =>
  `We took you back to screen ${step + 1} (${STEP_NAMES[step]}) because something there needs your attention.`

type Start = { form: FormData; step: StepIndex; errors: Errors; note: string | null }

/** Restore saved progress. If an earlier screen is no longer valid, resume there and say why. */
function load(): Start {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { form: FormData; step: StepIndex }
      const form = { ...emptyForm, ...parsed.form, website: '' }
      const saved = (parsed.step ?? 0) as StepIndex
      if (saved > 0) {
        const bad = firstInvalidStep(form, (saved - 1) as StepIndex)
        if (bad) return { form, step: bad.step, errors: bad.errors, note: sentBackNote(bad.step) }
      }
      return { form, step: saved, errors: {}, note: null }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { form: emptyForm, step: 0, errors: {}, note: null }
}

/** Scroll to a field, focus it and pulse it so the eye finds it. */
function focusField(anchor: string) {
  const el = document.getElementById(fieldId(anchor))
  if (!el) return
  const group = el.matches('fieldset')
  const holder = group ? el : (el.closest('div') ?? el)
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  holder.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
  el.focus({ preventScroll: true })
  holder.classList.remove('attention')
  void holder.offsetWidth // restart the animation if it is already running
  holder.classList.add('attention')
  window.setTimeout(() => holder.classList.remove('attention'), 1400)
}

export default function Register() {
  const navigate = useNavigate()
  usePageInfo({ title: 'Register as an expert | NEXUS-E', canonicalPath: '/register' })
  const [initial] = useState(load)
  const [form, setForm] = useState<FormData>(initial.form)
  const [step, setStep] = useState<StepIndex>(initial.step)
  const [errors, setErrors] = useState<Errors>(initial.errors)
  const [note, setNote] = useState<string | null>(initial.note)
  const [service, setService] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const serviceRef = useRef<HTMLDivElement>(null)
  const pendingFocus = useRef<string | null>(null)
  const shownStep = useRef<StepIndex>(initial.step)
  /** Errors that came from the server stay until that field changes. */
  const serverKeys = useRef(new Set<ErrorKey>())

  // Save progress so a refresh or an accidental tab close does not lose it.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form: { ...form, website: '' }, step }))
    } catch {
      /* ignore */
    }
  }, [form, step])

  // After each render: focus the first problem if one was requested, otherwise the new screen's heading.
  useEffect(() => {
    const target = pendingFocus.current
    if (target) {
      pendingFocus.current = null
      shownStep.current = step
      focusField(target)
      return
    }
    if (shownStep.current !== step) {
      shownStep.current = step
      headingRef.current?.focus()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [step, errors])

  useEffect(() => {
    if (service) serviceRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [service])

  /** Show these problems, move to their screen, and focus the first one. */
  const showProblems = (screen: StepIndex, problems: Errors, why: string | null) => {
    const first = errorList(problems)[0]
    setErrors(problems)
    setNote(why)
    pendingFocus.current = first ? first.anchor : null
    setStep(screen)
  }

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    const nextForm = { ...form, [k]: v }
    setForm(nextForm)
    setService(null)
    if (Object.keys(errors).length === 0) return
    // Re-check as they fix things: fixed problems disappear, the rest keep an up to date message.
    const fresh = validateStep(step, nextForm)
    const kept: Errors = {}
    for (const key of Object.keys(errors) as ErrorKey[]) {
      if (serverKeys.current.has(key)) {
        if (key === k) serverKeys.current.delete(key)
        else kept[key] = errors[key]
      } else if (fresh[key]) {
        kept[key] = fresh[key]
      }
    }
    setErrors(kept)
    if (Object.keys(kept).length === 0) setNote(null)
  }

  const next = () => {
    serverKeys.current.clear()
    setService(null)
    const e = validateStep(step, form)
    if (Object.keys(e).length) return showProblems(step, e, null)
    setErrors({})
    setNote(null)
    setStep((s) => (s + 1) as StepIndex)
  }

  const back = () => {
    serverKeys.current.clear()
    setErrors({})
    setNote(null)
    setService(null)
    setStep((s) => Math.max(0, s - 1) as StepIndex)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (step < 2) return next()
    serverKeys.current.clear()
    setService(null)

    // Re-check every screen, so nothing invalid reaches the server.
    const bad = firstInvalidStep(form)
    if (bad) return showProblems(bad.step, bad.errors, bad.step === step ? null : sentBackNote(bad.step))

    setSubmitting(true)
    const res = await registerExpert(form)
    setSubmitting(false)

    if (res.ok) {
      try {
        sessionStorage.removeItem(STORAGE_KEY)
        sessionStorage.setItem(EXPERT_ID_KEY, res.expertId)
      } catch {
        /* ignore */
      }
      navigate('/registered', { replace: true, state: { expertId: res.expertId } })
      return
    }

    if (res.kind === 'field') {
      const screen = FIELD_INFO[res.field]?.step ?? 0
      serverKeys.current.add(res.field)
      showProblems(screen, { [res.field]: res.message }, screen === step ? null : sentBackNote(screen))
      return
    }
    setService(
      res.kind === 'service'
        ? res.message
        : 'We could not save your registration just now. Please try again in a moment. Your answers are saved.',
    )
  }

  const items = errorList(errors)

  return (
    <div>
      <ProgressBar step={step} total={3} labels={[...STEP_NAMES]} />

      <form onSubmit={submit} noValidate className="mt-6">
        <div className="card p-5 sm:p-8">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-green-900 outline-none sm:text-3xl"
          >
            {STEP_TITLES[step]}
          </h1>
          <p className="mt-2 text-[0.95rem] text-ink-700">{STEP_INTROS[step]}</p>

          {items.length > 0 && (
            <div className="mt-5">
              <ErrorSummary items={items} note={note} onJump={focusField} />
            </div>
          )}

          {/* Honeypot. Invisible to people and to assistive tech, tempting to bots. */}
          <div aria-hidden="true" style={{ position: 'absolute', left: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => set('website', e.target.value)}
              />
            </label>
          </div>

          <div className="mt-7 space-y-5" key={step}>
            {step === 0 && (
              <div className="page-enter space-y-5">
                <TextField
                  fieldKey="full_name" label="Full name" required autoComplete="name"
                  value={form.full_name} onChange={(v) => set('full_name', v)} error={errors.full_name}
                />
                <SelectField
                  fieldKey="title" label="Professional title" required autoComplete="honorific-prefix"
                  options={TITLES} value={form.title} onChange={(v) => set('title', v)} error={errors.title}
                />
                <TextField
                  fieldKey="organisation" label="Current organisation or institution" required autoComplete="organization"
                  value={form.organisation} onChange={(v) => set('organisation', v)} error={errors.organisation}
                />
                <TextField
                  fieldKey="position" label="Current position" required autoComplete="organization-title"
                  value={form.position} onChange={(v) => set('position', v)} error={errors.position}
                />
                <SelectField
                  fieldKey="state" label="State of residence or practice" required placeholder="Select your state"
                  options={STATES} value={form.state} onChange={(v) => set('state', v)} error={errors.state}
                />
                <fieldset className="rounded-[var(--radius-lg)] bg-green-50 p-4">
                  <legend className="px-1 text-sm font-bold text-green-900">How can we reach you?</legend>
                  <p className="mb-4 text-sm text-ink-700">Your email is required. Your phone number is optional.</p>
                  <div className="space-y-5">
                    <TextField
                      fieldKey="email" label="Email" required type="email" inputMode="email" autoComplete="email"
                      placeholder="you@example.com"
                      hint="We send your Expert ID here, and you use it to sign in and verify your profile."
                      value={form.email} onChange={(v) => set('email', v)} error={errors.email}
                    />
                    <TextField
                      fieldKey="phone" label="Phone or WhatsApp" type="tel" inputMode="tel" autoComplete="tel"
                      placeholder="0803 123 4567"
                      value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone}
                    />
                  </div>
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <div className="page-enter space-y-7">
                <SelectField
                  fieldKey="primary_expertise" label="Primary expertise" required placeholder="Select your main area"
                  options={EXPERTISE} value={form.primary_expertise}
                  onChange={(v) => {
                    set('primary_expertise', v)
                    // Keep the secondary list clean if the same area was already chosen there.
                    if (form.secondary_expertise.includes(v)) {
                      set('secondary_expertise', form.secondary_expertise.filter((x) => x !== v))
                    }
                  }}
                  error={errors.primary_expertise}
                />
                <CheckList
                  fieldKey="secondary_expertise" legend="Secondary expertise"
                  hint="Choose up to three."
                  max={MAX_SECONDARY}
                  options={EXPERTISE.filter((x) => x !== form.primary_expertise)}
                  values={form.secondary_expertise}
                  onChange={(v) => set('secondary_expertise', v)}
                  error={errors.secondary_expertise}
                  columns={2}
                />
                <RadioList
                  fieldKey="years_experience" legend="Years of professional experience" required
                  options={YEARS} value={form.years_experience}
                  onChange={(v) => set('years_experience', v)} error={errors.years_experience} columns={2}
                />
                <SelectField
                  fieldKey="qualification" label="Highest qualification" required placeholder="Select your qualification"
                  options={QUALIFICATIONS} value={form.qualification}
                  onChange={(v) => set('qualification', v)} error={errors.qualification}
                />
                <CheckList
                  fieldKey="memberships" legend="Professional memberships"
                  hint="These are checked later during verification."
                  options={MEMBERSHIPS} values={form.memberships}
                  onChange={(v) => set('memberships', v)} columns={2}
                />
                {form.memberships.includes('NES') && (
                  <TextField
                    fieldKey="nes_number" label="NES membership number"
                    value={form.nes_number} onChange={(v) => set('nes_number', v)}
                  />
                )}
                {form.memberships.includes('IEPN') && (
                  <TextField
                    fieldKey="iepn_status" label="IEPN licence or status"
                    value={form.iepn_status} onChange={(v) => set('iepn_status', v)}
                  />
                )}
                <p className="rounded-[var(--radius-md)] bg-blue-100 px-4 py-3 text-sm text-blue-700">
                  Membership and licence details are collected as future verification signals. The registry does not
                  replace statutory or professional licensing.
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="page-enter space-y-7">
                <CheckList
                  fieldKey="assignments" legend="Assignments you are available for"
                  hint="Choose all that apply."
                  options={ASSIGNMENTS} values={form.assignments}
                  onChange={(v) => set('assignments', v)} columns={2}
                />
                <RadioList
                  fieldKey="availability" legend="Geographic availability" required
                  options={AVAILABILITY} value={form.availability}
                  onChange={(v) => set('availability', v)} error={errors.availability} columns={2}
                />
                <TextField
                  fieldKey="profile_url" label="LinkedIn or profile link" type="url" inputMode="url" autoComplete="url"
                  placeholder="linkedin.com/in/yourname"
                  value={form.profile_url} onChange={(v) => set('profile_url', v)} error={errors.profile_url}
                />
                <RadioList
                  fieldKey="discoverable" legend="May organisations discover you?" required
                  hint="Only experts who say Yes can appear in the searchable directory."
                  options={[
                    { value: 'yes', label: 'Yes, list me', sub: 'Organisations can find and contact me.' },
                    { value: 'no', label: 'No, keep me private', sub: 'I stay on the registry but am not listed.' },
                  ]}
                  value={form.discoverable}
                  onChange={(v) => set('discoverable', v as FormData['discoverable'])}
                  error={errors.discoverable}
                />
                <ConsentBox
                  fieldKey="consent_contact"
                  checked={form.consent_contact}
                  onChange={(v) => set('consent_contact', v)}
                  error={errors.consent_contact}
                >
                  I agree to be contacted about opportunities, and I consent to NEXUS-E storing my details for this
                  purpose. <span className="text-danger-600" aria-hidden="true">*</span>
                </ConsentBox>
                <Turnstile onToken={() => undefined} />
              </div>
            )}
          </div>
        </div>

        {service && (
          <div ref={serviceRef} className="mt-5">
            <Notice title="We could not finish your registration">{service}</Notice>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={back} disabled={submitting}>
              Back
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn btn-primary ml-auto flex-1 sm:flex-none sm:px-10" onClick={next}>
              Continue
            </button>
          ) : (
            <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none sm:px-10" disabled={submitting}>
              {submitting ? (<><Spinner label="Submitting" /> Submitting</>) : service ? 'Try again' : 'Submit registration'}
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">Your answers are saved on this device until you finish.</p>
      </form>
    </div>
  )
}
