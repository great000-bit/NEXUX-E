import { usePageInfo } from '../lib/pageInfo'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  emptyForm, errorList, EXPERT_ID_KEY, FIELD_INFO, firstInvalidStep, STORAGE_KEY, validateStep,
  type ErrorKey, type Errors, type FormData, type StepIndex,
} from '../lib/form'
import { AFRICAN_COUNTRIES, hasStateList, OTHER_COUNTRY } from '../lib/countries'
import { fmt, messages } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'
import {
  ASSIGNMENTS, AVAILABILITY, EXPERTISE, MAX_SECONDARY, MEMBERSHIPS,
  QUALIFICATIONS, STATES, TITLES, YEARS,
} from '../lib/options'
import { registerExpert } from '../lib/api'
import { CheckList, ConsentBox, fieldId, RadioList, SelectField, TextField } from '../components/fields'
import { ErrorSummary, Notice, ProgressBar, Spinner } from '../components/ui'
import { Turnstile } from '../components/Turnstile'

const sentBackNote = (step: StepIndex) => {
  const r = messages().register
  return fmt(r.sentBack, { n: step + 1, name: r.stepNames[step] })
}

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
  const m = useMessages()
  const r = m.register
  const f = r.fields
  usePageInfo({ title: r.pageTitle, canonicalPath: '/register' })
  const countryLabel = (c: string) => (m.options.countries as Record<string, string>)[c] ?? c
  const optionLabel = (group: keyof typeof m.options) => (v: string) => (m.options[group] as Record<string, string>)[v] ?? v
  // African countries in the order of the language now shown, then "Other".
  const countries = useMemo(
    () => [...[...AFRICAN_COUNTRIES].sort((a, b) => countryLabel(a).localeCompare(countryLabel(b), m.meta.code)), OTHER_COUNTRY],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [m],
  )
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

  const update = (patch: Partial<FormData>) => {
    const nextForm = { ...form, ...patch }
    setForm(nextForm)
    setService(null)
    if (Object.keys(errors).length === 0) return
    // Re-check as they fix things: fixed problems disappear, the rest keep an up to date message.
    const fresh = validateStep(step, nextForm)
    const kept: Errors = {}
    for (const key of Object.keys(errors) as ErrorKey[]) {
      if (serverKeys.current.has(key)) {
        if (key in patch) serverKeys.current.delete(key)
        else kept[key] = errors[key]
      } else if (fresh[key]) {
        kept[key] = fresh[key]
      }
    }
    setErrors(kept)
    if (Object.keys(kept).length === 0) setNote(null)
  }
  const set = <K extends keyof FormData>(k: K, v: FormData[K]) => update({ [k]: v } as Partial<FormData>)

  // Choosing another country: Nigeria has a list of states, every other country a free text one, so the old answer is cleared when the kind changes.
  const setCountry = (country: string) =>
    update(hasStateList(country) === hasStateList(form.country) ? { country } : { country, state: '' })

  // If the language changes while problems are showing, say them again in the new language.
  const lastLocale = useRef(m.meta.code)
  useEffect(() => {
    if (lastLocale.current === m.meta.code) return
    lastLocale.current = m.meta.code
    serverKeys.current.clear()
    setErrors((e) => (Object.keys(e).length ? validateStep(step, form) : e))
    setNote(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m.meta.code])

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
      res.kind === 'service' ? res.message : m.apiErrors.unavailable,
    )
  }

  const items = errorList(errors)

  return (
    <div>
      <ProgressBar step={step} total={3} labels={r.stepNames} />

      <form onSubmit={submit} noValidate className="mt-6">
        <div className="card p-5 sm:p-8">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-2xl font-semibold text-green-900 outline-none sm:text-3xl"
          >
            {r.stepTitles[step]}
          </h1>
          <p className="mt-2 text-[0.95rem] text-ink-700">{r.stepIntros[step]}</p>

          {items.length > 0 && (
            <div className="mt-5">
              <ErrorSummary items={items} note={note} onJump={focusField} />
            </div>
          )}

          {/* Honeypot. Invisible to people and to assistive tech, tempting to bots. */}
          <div aria-hidden="true" style={{ position: 'absolute', insetInlineStart: '-10000px', width: 1, height: 1, overflow: 'hidden' }}>
            <label>
              {r.honeypot}
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
                  fieldKey="full_name" label={f.fullName} required autoComplete="name"
                  value={form.full_name} onChange={(v) => set('full_name', v)} error={errors.full_name}
                />
                <SelectField
                  fieldKey="title" label={f.title} required autoComplete="honorific-prefix"
                  options={TITLES} labelFor={optionLabel('titles')} value={form.title} onChange={(v) => set('title', v)} error={errors.title}
                />
                <TextField
                  fieldKey="organisation" label={f.organisation} required autoComplete="organization"
                  value={form.organisation} onChange={(v) => set('organisation', v)} error={errors.organisation}
                />
                <TextField
                  fieldKey="position" label={f.position} required autoComplete="organization-title"
                  value={form.position} onChange={(v) => set('position', v)} error={errors.position}
                />
                <SelectField
                  fieldKey="country" label={f.country} required placeholder={f.countryPlaceholder} autoComplete="country-name"
                  options={countries} labelFor={countryLabel}
                  value={form.country} onChange={setCountry} error={errors.country}
                />
                {hasStateList(form.country) ? (
                  <SelectField
                    fieldKey="state" label={f.state} required placeholder={f.statePlaceholder}
                    options={STATES} value={form.state} onChange={(v) => set('state', v)} error={errors.state}
                  />
                ) : (
                  <TextField
                    fieldKey="state" label={f.region} required autoComplete="address-level1" hint={f.regionHint}
                    value={form.state} onChange={(v) => set('state', v)} error={errors.state}
                  />
                )}
                <fieldset className="rounded-[var(--radius-lg)] bg-green-50 p-4">
                  <legend className="px-1 text-sm font-bold text-green-900">{f.reach}</legend>
                  <p className="mb-4 text-sm text-ink-700">{f.reachHint}</p>
                  <div className="space-y-5">
                    <TextField
                      fieldKey="email" label={f.email} required type="email" inputMode="email" autoComplete="email"
                      placeholder={f.emailPlaceholder}
                      hint={f.emailHint}
                      value={form.email} onChange={(v) => set('email', v)} error={errors.email}
                    />
                    <TextField
                      fieldKey="phone" label={f.phone} type="tel" inputMode="tel" autoComplete="tel"
                      placeholder={hasStateList(form.country) ? f.phonePlaceholderNigeria : f.phonePlaceholderIntl}
                      hint={hasStateList(form.country) ? undefined : f.phoneHintIntl}
                      value={form.phone} onChange={(v) => set('phone', v)} error={errors.phone}
                    />
                  </div>
                </fieldset>
              </div>
            )}

            {step === 1 && (
              <div className="page-enter space-y-7">
                <SelectField
                  fieldKey="primary_expertise" label={f.primaryExpertise} required placeholder={f.primaryExpertisePlaceholder}
                  options={EXPERTISE} labelFor={optionLabel('expertise')} value={form.primary_expertise}
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
                  fieldKey="secondary_expertise" legend={f.secondaryExpertise}
                  hint={f.secondaryHint}
                  max={MAX_SECONDARY}
                  options={EXPERTISE.filter((x) => x !== form.primary_expertise)}
                  labelFor={optionLabel('expertise')}
                  values={form.secondary_expertise}
                  onChange={(v) => set('secondary_expertise', v)}
                  error={errors.secondary_expertise}
                  columns={2}
                />
                <RadioList
                  fieldKey="years_experience" legend={f.years} required
                  options={YEARS} labelFor={optionLabel('years')} value={form.years_experience}
                  onChange={(v) => set('years_experience', v)} error={errors.years_experience} columns={2}
                />
                <SelectField
                  fieldKey="qualification" label={f.qualification} required placeholder={f.qualificationPlaceholder}
                  options={QUALIFICATIONS} labelFor={optionLabel('qualifications')} value={form.qualification}
                  onChange={(v) => set('qualification', v)} error={errors.qualification}
                />
                <CheckList
                  fieldKey="memberships" legend={f.memberships}
                  hint={f.membershipsHint}
                  options={MEMBERSHIPS} labelFor={optionLabel('memberships')} values={form.memberships}
                  onChange={(v) => set('memberships', v)} columns={2}
                />
                {form.memberships.includes('NES') && (
                  <TextField
                    fieldKey="nes_number" label={f.nesNumber}
                    value={form.nes_number} onChange={(v) => set('nes_number', v)}
                  />
                )}
                {form.memberships.includes('IEPN') && (
                  <TextField
                    fieldKey="iepn_status" label={f.iepnStatus}
                    value={form.iepn_status} onChange={(v) => set('iepn_status', v)}
                  />
                )}
                <p className="rounded-[var(--radius-md)] bg-blue-100 px-4 py-3 text-sm text-blue-700">
                  {f.membershipNote}
                </p>
              </div>
            )}

            {step === 2 && (
              <div className="page-enter space-y-7">
                <CheckList
                  fieldKey="assignments" legend={f.assignments}
                  hint={f.assignmentsHint}
                  options={ASSIGNMENTS} labelFor={optionLabel('assignments')} values={form.assignments}
                  onChange={(v) => set('assignments', v)} columns={2}
                />
                <RadioList
                  fieldKey="availability" legend={f.availability} required
                  options={AVAILABILITY} labelFor={optionLabel('availability')} value={form.availability}
                  onChange={(v) => set('availability', v)} error={errors.availability} columns={2}
                />
                <TextField
                  fieldKey="profile_url" label={f.profileUrl} type="url" inputMode="url" autoComplete="url"
                  placeholder={f.profileUrlPlaceholder}
                  value={form.profile_url} onChange={(v) => set('profile_url', v)} error={errors.profile_url}
                />
                <RadioList
                  fieldKey="discoverable" legend={f.discoverable} required
                  hint={f.discoverableHint}
                  options={[
                    { value: 'yes', label: f.discoverableYes, sub: f.discoverableYesSub },
                    { value: 'no', label: f.discoverableNo, sub: f.discoverableNoSub },
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
                  {f.consent} <span className="text-danger-600" aria-hidden="true">*</span>
                </ConsentBox>
                <Turnstile onToken={() => undefined} />
              </div>
            )}
          </div>
        </div>

        {service && (
          <div ref={serviceRef} className="mt-5">
            <Notice title={r.serviceTitle}>{service}</Notice>
          </div>
        )}

        <div className="mt-5 flex items-center gap-3">
          {step > 0 && (
            <button type="button" className="btn btn-ghost" onClick={back} disabled={submitting}>
              {m.common.back}
            </button>
          )}
          {step < 2 ? (
            <button type="button" className="btn btn-primary ml-auto flex-1 sm:flex-none sm:px-10" onClick={next}>
              {r.continue}
            </button>
          ) : (
            <button type="submit" className="btn btn-primary ml-auto flex-1 sm:flex-none sm:px-10" disabled={submitting}>
              {submitting ? (<><Spinner label={r.submitting} /> {r.submitting}</>) : service ? m.common.tryAgain : r.submit}
            </button>
          )}
        </div>
        <p className="mt-4 text-center text-xs text-ink-500">{r.saved}</p>
      </form>
    </div>
  )
}
