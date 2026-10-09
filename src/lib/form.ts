import { DEFAULT_COUNTRY, hasStateList } from './countries'
import { fmt, messages } from '../i18n'
import { MAX_SECONDARY, STATES } from './options'

export type FormData = {
  // Screen 1
  full_name: string
  title: string
  organisation: string
  position: string
  country: string
  state: string
  phone: string
  email: string
  // Screen 2
  primary_expertise: string
  secondary_expertise: string[]
  years_experience: string
  qualification: string
  memberships: string[]
  nes_number: string
  iepn_status: string
  // Screen 3
  assignments: string[]
  availability: string
  profile_url: string
  discoverable: '' | 'yes' | 'no'
  consent_contact: boolean
  // Honeypot. Must stay empty. Hidden from people, tempting to bots.
  website: string
}

export const emptyForm: FormData = {
  full_name: '',
  title: '',
  organisation: '',
  position: '',
  country: DEFAULT_COUNTRY,
  state: '',
  phone: '',
  email: '',
  primary_expertise: '',
  secondary_expertise: [],
  years_experience: '',
  qualification: '',
  memberships: [],
  nes_number: '',
  iepn_status: '',
  assignments: [],
  availability: '',
  profile_url: '',
  discoverable: '',
  consent_contact: false,
  website: '',
}

export type ErrorKey = keyof FormData
export type Errors = Partial<Record<ErrorKey, string>>

export type StepIndex = 0 | 1 | 2
export const STEP_NAMES = ['Identity', 'Expertise', 'Opportunity profile'] as const

/** Where each checkable field lives and what to call it when we point at it. Order is page order. */
export const FIELD_INFO: Partial<Record<ErrorKey, { label: string; step: StepIndex; anchor: string }>> = {
  full_name: { label: 'Full name', step: 0, anchor: 'full_name' },
  title: { label: 'Title', step: 0, anchor: 'title' },
  organisation: { label: 'Organisation', step: 0, anchor: 'organisation' },
  position: { label: 'Position', step: 0, anchor: 'position' },
  country: { label: 'Country', step: 0, anchor: 'country' },
  state: { label: 'State', step: 0, anchor: 'state' },
  email: { label: 'Email address', step: 0, anchor: 'email' },
  phone: { label: 'Phone number', step: 0, anchor: 'phone' },
  primary_expertise: { label: 'Primary expertise', step: 1, anchor: 'primary_expertise' },
  secondary_expertise: { label: 'Secondary expertise', step: 1, anchor: 'secondary_expertise' },
  years_experience: { label: 'Years of experience', step: 1, anchor: 'years_experience' },
  qualification: { label: 'Highest qualification', step: 1, anchor: 'qualification' },
  availability: { label: 'Geographic availability', step: 2, anchor: 'availability' },
  profile_url: { label: 'Profile link', step: 2, anchor: 'profile_url' },
  discoverable: { label: 'Discoverability', step: 2, anchor: 'discoverable' },
  consent_contact: { label: 'Consent to be contacted', step: 2, anchor: 'consent_contact' },
}

const FIELD_ORDER = Object.keys(FIELD_INFO) as ErrorKey[]

/** Errors as an ordered list, in the order they appear on the page. */
export function errorList(errors: Errors): { key: ErrorKey; label: string; message: string; anchor: string }[] {
  const labels = messages().register.summaryLabels as Record<string, string>
  return FIELD_ORDER.filter((k) => errors[k]).map((k) => ({
    key: k,
    label: labels[k] ?? FIELD_INFO[k]!.label,
    message: errors[k]!,
    anchor: FIELD_INFO[k]!.anchor,
  }))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const INTERNATIONAL = /^\s*(\+|00)/

/** Mirrors normalise_phone(raw, country) in the database so the form and the duplicate check agree. */
export function normalisePhone(raw: string, country: string = DEFAULT_COUNTRY): string {
  const international = INTERNATIONAL.test(raw)
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  // A local number in Nigeria (0803 123 4567) becomes 234803...; a local zero means something else in every other country.
  if (country === 'Nigeria' && !international && d.startsWith('0') && d.length === 11) d = '234' + d.slice(1)
  return d
}

/**
 * Numbers in Nigeria may be written locally (0803 123 4567) or with the country code. Everywhere else the number must
 * start with + or 00 and the country code (E.164: 10 to 15 digits), because a local number is ambiguous.
 */
export function isValidPhone(raw: string, country: string = DEFAULT_COUNTRY): boolean {
  if (country !== 'Nigeria' && !INTERNATIONAL.test(raw)) return false
  const d = normalisePhone(raw, country)
  return d.length >= 10 && d.length <= 15
}

export function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
    return u.hostname.includes('.')
  } catch {
    return false
  }
}

/** The most characters each text field accepts. The form stops typing at the limit, and the database has a wider backstop. */
export const FIELD_LIMITS: Record<string, number> = {
  full_name: 120,
  organisation: 200,
  position: 120,
  email: 254,
  phone: 30,
  state: 120,
  profile_url: 300,
  nes_number: 60,
  iepn_status: 120,
}

export function validateStep(step: StepIndex, f: FormData): Errors {
  const e: Errors = {}
  const v = messages().validation
  // Too-long text (for example pasted, or restored from an older saved draft) is named, not silently cut.
  const tooLong = (k: keyof FormData) => {
    const limit = FIELD_LIMITS[k]
    const value = f[k]
    if (limit && typeof value === 'string' && value.trim().length > limit) e[k] = fmt(v.tooLong, { limit })
  }
  const req = (k: keyof FormData, msg: string) => {
    const value = f[k]
    if (typeof value === 'string' && !value.trim()) e[k] = msg
  }

  if (step === 0) {
    req('full_name', v.fullName)
    req('title', v.title)
    req('organisation', v.organisation)
    req('position', v.position)
    req('country', v.country)
    // Nigeria has a list of states; every other country types its own state, province or region.
    if (hasStateList(f.country)) {
      if (!(STATES as readonly string[]).includes(f.state)) e.state = v.state
    } else {
      req('state', v.region)
      if (!e.state) tooLong('state')
    }
    // Email is required: it is where the Expert ID is sent and how an expert signs in to verify. Phone is optional.
    if (f.email.trim() === '') {
      e.email = v.emailRequired
    } else if (!EMAIL_RE.test(f.email.trim())) {
      e.email = v.emailInvalid
    }
    if (f.phone.trim() !== '' && !isValidPhone(f.phone, f.country)) {
      e.phone = f.country === 'Nigeria' ? v.phoneNigeria : v.phoneIntl
    }
    for (const k of ['full_name', 'organisation', 'position', 'email', 'phone'] as const) if (!e[k]) tooLong(k)
  }

  if (step === 1) {
    req('primary_expertise', v.primaryExpertise)
    req('years_experience', v.years)
    req('qualification', v.qualification)
    for (const k of ['nes_number', 'iepn_status'] as const) tooLong(k)
    if (f.secondary_expertise.length > MAX_SECONDARY) {
      e.secondary_expertise = fmt(v.secondaryMax, { max: MAX_SECONDARY })
    }
  }

  if (step === 2) {
    req('availability', v.availability)
    if (f.discoverable === '') e.discoverable = v.discoverable
    if (!f.consent_contact) e.consent_contact = v.consent
    if (f.profile_url.trim() && !isValidUrl(f.profile_url.trim())) {
      e.profile_url = v.profileUrl
    } else {
      tooLong('profile_url')
    }
  }

  return e
}

/** First screen (0 to 2) that has a problem, or null. */
export function firstInvalidStep(f: FormData, upTo: StepIndex = 2): { step: StepIndex; errors: Errors } | null {
  for (const s of [0, 1, 2] as const) {
    if (s > upTo) break
    const errors = validateStep(s, f)
    if (Object.keys(errors).length) return { step: s, errors }
  }
  return null
}

export function toPayload(f: FormData) {
  const url = f.profile_url.trim()
  return {
    full_name: f.full_name.trim().slice(0, FIELD_LIMITS.full_name),
    title: f.title,
    organisation: f.organisation.trim().slice(0, FIELD_LIMITS.organisation),
    position: f.position.trim().slice(0, FIELD_LIMITS.position),
    country: f.country,
    state: hasStateList(f.country) ? f.state : f.state.trim().slice(0, FIELD_LIMITS.state),
    phone: f.phone.trim().slice(0, FIELD_LIMITS.phone),
    email: f.email.trim().toLowerCase().slice(0, FIELD_LIMITS.email),
    primary_expertise: f.primary_expertise,
    // A person's secondary choice cannot repeat their primary one.
    secondary_expertise: f.secondary_expertise.filter((x) => x !== f.primary_expertise),
    years_experience: f.years_experience,
    qualification: f.qualification,
    memberships: f.memberships,
    nes_number: f.memberships.includes('NES') ? f.nes_number.trim().slice(0, FIELD_LIMITS.nes_number) : '',
    iepn_status: f.memberships.includes('IEPN') ? f.iepn_status.trim().slice(0, FIELD_LIMITS.iepn_status) : '',
    assignments: f.assignments,
    availability: f.availability,
    profile_url: (url && !/^https?:\/\//i.test(url) ? `https://${url}` : url).slice(0, FIELD_LIMITS.profile_url),
    discoverable: f.discoverable === 'yes',
    consent_contact: f.consent_contact,
    website: f.website,
  }
}

export const STORAGE_KEY = 'nexus-e:registration:v1'
export const EXPERT_ID_KEY = 'nexus-e:expert-id'
