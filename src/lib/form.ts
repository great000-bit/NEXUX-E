import { MAX_SECONDARY } from './options'

export type FormData = {
  // Screen 1
  full_name: string
  title: string
  organisation: string
  position: string
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
  return FIELD_ORDER.filter((k) => errors[k]).map((k) => ({
    key: k,
    label: FIELD_INFO[k]!.label,
    message: errors[k]!,
    anchor: FIELD_INFO[k]!.anchor,
  }))
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Mirrors normalise_phone() in the database so the form and the duplicate check agree. */
export function normalisePhone(raw: string): string {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  if (d.startsWith('0') && d.length === 11) d = '234' + d.slice(1)
  return d
}

export function isValidPhone(raw: string): boolean {
  const d = normalisePhone(raw)
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
  profile_url: 300,
  nes_number: 60,
  iepn_status: 120,
}

export function validateStep(step: StepIndex, f: FormData): Errors {
  const e: Errors = {}
  // Too-long text (for example pasted, or restored from an older saved draft) is named, not silently cut.
  const tooLong = (k: keyof FormData) => {
    const limit = FIELD_LIMITS[k]
    const v = f[k]
    if (limit && typeof v === 'string' && v.trim().length > limit) e[k] = `Please use ${limit} characters or fewer.`
  }
  const req = (k: keyof FormData, msg: string) => {
    const v = f[k]
    if (typeof v === 'string' && !v.trim()) e[k] = msg
  }

  if (step === 0) {
    req('full_name', 'Enter your full name, like Ada Obi.')
    req('title', 'Choose your title from the list.')
    req('organisation', 'Enter the organisation or institution where you work.')
    req('position', 'Enter your current position, like Senior Lecturer.')
    req('state', 'Choose your state from the list.')
    // Email is required: it is where the Expert ID is sent and how an expert signs in to verify. Phone is optional.
    if (f.email.trim() === '') {
      e.email = 'Enter your email address, like name@example.com. We send your Expert ID there, and you use it to sign in and verify your profile.'
    } else if (!EMAIL_RE.test(f.email.trim())) {
      e.email = 'Enter a valid email address, like name@example.com.'
    }
    if (f.phone.trim() !== '' && !isValidPhone(f.phone)) {
      e.phone = 'Enter a valid phone number, like 0803 123 4567, or leave it empty.'
    }
    for (const k of ['full_name', 'organisation', 'position', 'email', 'phone'] as const) if (!e[k]) tooLong(k)
  }

  if (step === 1) {
    req('primary_expertise', 'Choose your main area of expertise.')
    req('years_experience', 'Choose how many years you have worked professionally.')
    req('qualification', 'Choose your highest qualification from the list.')
    for (const k of ['nes_number', 'iepn_status'] as const) tooLong(k)
    if (f.secondary_expertise.length > MAX_SECONDARY) {
      e.secondary_expertise = `You can choose up to ${MAX_SECONDARY} secondary areas. Please untick some.`
    }
  }

  if (step === 2) {
    req('availability', 'Choose where you are available to work.')
    if (f.discoverable === '') e.discoverable = 'Choose Yes or No to tell us whether organisations may find you.'
    if (!f.consent_contact) e.consent_contact = 'Please tick this box. We need your consent to contact you before we can register you.'
    if (f.profile_url.trim() && !isValidUrl(f.profile_url.trim())) {
      e.profile_url = 'Enter a valid link, like linkedin.com/in/yourname, or leave it empty.'
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
    state: f.state,
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
