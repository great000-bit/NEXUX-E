import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  emptyForm, EXPERT_ID_KEY, STORAGE_KEY, validateStep,
  type Errors, type FormData,
} from '../lib/form'
import {
  ASSIGNMENTS, AVAILABILITY, EXPERTISE, MAX_SECONDARY, MEMBERSHIPS,
  QUALIFICATIONS, STATES, TITLES, YEARS,
} from '../lib/options'
import { registerExpert } from '../lib/api'
import { CheckList, ConsentBox, RadioList, SelectField, TextField } from '../components/fields'
import { Notice, ProgressBar, Spinner } from '../components/ui'
import { Turnstile } from '../components/Turnstile'

const STEP_LABELS = ['Identity', 'Expertise', 'Opportunity profile']
const STEP_TITLES = ['Tell us who you are', 'Your expertise', 'Your opportunity profile']
const STEP_INTROS = [
  'We use these details to create your record and to reach you.',
  'Choose the areas where you are strongest. You can add up to three secondary areas.',
  'Tell organisations how you can help, and confirm your consent.',
]

type Saved = { form: FormData; step: 0 | 1 | 2 }

function load(): Saved {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Saved
      return { form: { ...emptyForm, ...parsed.form, website: '' }, step: (parsed.step ?? 0) as 0 | 1 | 2 }
    }
  } catch {
    /* storage unavailable or corrupt: start fresh */
  }
  return { form: emptyForm, step: 0 }
}

export default function Register() {
  const navigate = useNavigate()
  const [initial] = useState(load)
  const [form, setForm] = useState<FormData>(initial.form)
  const [step, setStep] = useState<0 | 1 | 2>(initial.step)
  const [errors, setErrors] = useState<Errors>({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const firstRender = useRef(true)

  // Save progress so a refresh or an accidental tab close does not lose it.
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ form: { ...form, website: '' }, step }))
    } catch {
      /* ignore */
    }
  }, [form, step])

  // Move focus to the heading on each step change for keyboard and screen reader users.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    headingRef.current?.focus()
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [step])

  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => {
    setForm((f) => ({ ...f, [k]: v }))
    if (errors[k] || (k === 'phone' || k === 'email') && errors.contact) {
      setErrors((e) => {
        const next = { ...e }
        delete next[k]
        if (k === 'phone' || k === 'email') delete next.contact
        return next
      })
    }
  }

  const focusFirstError = (e: Errors) => {
    requestAnimationFrame(() => {
      const el = document.querySelector<HTMLElement>('[aria-invalid="true"]')
      el?.focus()
      if (!el && e.contact) document.getElementById('contact-error')?.focus()
    })
  }

  const next = () => {
    const e = validateStep(step, form)
    setErrors(e)
    if (Object.keys(e).length) return focusFirstError(e)
    setStep((s) => (s + 1) as 0 | 1 | 2)
  }

  const back = () => {
    setErrors({})
    setServerError(null)
    setStep((s) => Math.max(0, s - 1) as 0 | 1 | 2)
  }

  const submit = async (ev: FormEvent) => {
    ev.preventDefault()
    if (step < 2) return next()
    // Re-check every screen so nothing invalid reaches the server.
    for (const s of [0, 1, 2] as const) {
      const e = validateStep(s, form)
      if (Object.keys(e).length) {
        setErrors(e)
        setStep(s)
        setServerError('Please fix the highlighted fields before submitting.')
        return focusFirstError(e)
      }
    }
    setSubmitting(true)
    setServerError(null)
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
    // Send people to the screen that holds the problem field.
    if (res.code === 'duplicate_email') {
      setStep(0)
      setErrors({ email: res.message })
    } else if (res.code === 'duplicate_phone') {
      setStep(0)
      setErrors({ phone: res.message })
    } else {
      setServerError(res.message)
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const hasContactError = Boolean(errors.contact)

  return (
    <div>
      <ProgressBar step={step} total={3} labels={STEP_LABELS} />

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

          {serverError && (
            <div className="mt-5">
              <Notice title={step === 2 ? 'We could not complete your registration' : undefined}>{serverError}</Notice>
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
                  label="Full name" required name="name" autoComplete="name"
                  value={form.full_name} onChange={(v) => set('full_name', v)} error={errors.full_name}
                />
                <SelectField
                  label="Professional title" required autoComplete="honorific-prefix"
                  options={TITLES} value={form.title} onChange={(v) => set('title', v)} error={errors.title}
                />
                <TextField
                  label="Current organisation or institution" required autoComplete="organization"
                  value={form.organisation} onChange={(v) => set('organisation', v)} error={errors.organisation}
                />
                <TextField
                  label="Current position" required autoComplete="organization-title"
                  value={form.position} onChange={(v) => set('position', v)} error={errors.position}
                />
                <SelectField
                  label="State of residence or practice" required placeholder="Select your state"
                  options={STATES} value={form.state} onChange={(v) => set('state', v)} error={errors.state}
                />
                <fieldset className="rounded-[var(--radius-lg)] bg-green-50 p-4">
                  <legend className="px-1 text-sm font-bold text-green-900">How can we reach you?</legend>
                  <p className="mb-4 text-sm text-ink-700">Provide at least one. Both is better.</p>
                  <div className="space-y-5">
                    <TextField
                      label="Phone or WhatsApp" tag="One contact required" type="tel" inputMode="tel" autoComplete="tel"
                      placeholder="0803 123 4567"
                      value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone}
                    />
                    <TextField
                      label="Email" tag="One contact required" type="email" inputMode="email" autoComplete="email"
                      placeholder="you@example.com"
                      value={form.email} onChange={(v) => set('email', v)} error={errors.email}
                    />
                  </div>
                  {hasContactError && (
                    <p id="contact-error" tabIndex={-1} role="alert" className="field-error mt-4 outline-none">
                      {errors.contact}
                    </p>
                  )}
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <div className="page-enter space-y-7">
                <SelectField
                  label="Primary expertise" required placeholder="Select your main area"
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
                  legend="Secondary expertise"
                  hint="Choose up to three."
                  max={MAX_SECONDARY}
                  options={EXPERTISE.filter((x) => x !== form.primary_expertise)}
                  values={form.secondary_expertise}
                  onChange={(v) => set('secondary_expertise', v)}
                  error={errors.secondary_expertise}
                  columns={2}
                />
                <RadioList
                  legend="Years of professional experience" required
                  options={YEARS} value={form.years_experience}
                  onChange={(v) => set('years_experience', v)} error={errors.years_experience} columns={2}
                />
                <SelectField
                  label="Highest qualification" required placeholder="Select your qualification"
                  options={QUALIFICATIONS} value={form.qualification}
                  onChange={(v) => set('qualification', v)} error={errors.qualification}
                />
                <CheckList
                  legend="Professional memberships"
                  hint="These are checked later during verification."
                  options={MEMBERSHIPS} values={form.memberships}
                  onChange={(v) => set('memberships', v)} columns={2}
                />
                {form.memberships.includes('NES') && (
                  <TextField
                    label="NES membership number"
                    value={form.nes_number} onChange={(v) => set('nes_number', v)}
                  />
                )}
                {form.memberships.includes('IEPN') && (
                  <TextField
                    label="IEPN licence or status"
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
                  legend="Assignments you are available for"
                  hint="Choose all that apply."
                  options={ASSIGNMENTS} values={form.assignments}
                  onChange={(v) => set('assignments', v)} columns={2}
                />
                <RadioList
                  legend="Geographic availability" required
                  options={AVAILABILITY} value={form.availability}
                  onChange={(v) => set('availability', v)} error={errors.availability} columns={2}
                />
                <TextField
                  label="LinkedIn or profile link" type="url" inputMode="url" autoComplete="url"
                  placeholder="linkedin.com/in/yourname"
                  value={form.profile_url} onChange={(v) => set('profile_url', v)} error={errors.profile_url}
                />
                <RadioList
                  legend="May organisations discover you?" required
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
              {submitting ? (<><Spinner label="Submitting" /> Submitting</>) : 'Submit registration'}
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">Your answers are saved on this device until you finish.</p>
      </form>
    </div>
  )
}
