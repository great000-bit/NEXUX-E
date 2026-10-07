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

export type Errors = Partial<Record<keyof FormData | 'contact', string>>

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

export function validateStep(step: 0 | 1 | 2, f: FormData): Errors {
  const e: Errors = {}
  const req = (k: keyof FormData, msg: string) => {
    const v = f[k]
    if (typeof v === 'string' && !v.trim()) e[k] = msg
  }

  if (step === 0) {
    req('full_name', 'Enter your full name.')
    req('title', 'Choose your title.')
    req('organisation', 'Enter your current organisation or institution.')
    req('position', 'Enter your current position.')
    req('state', 'Choose your state of residence or practice.')
    const hasPhone = f.phone.trim() !== ''
    const hasEmail = f.email.trim() !== ''
    if (!hasPhone && !hasEmail) {
      e.contact = 'Provide at least one way to reach you: a phone number or an email address.'
    }
    if (hasPhone && !isValidPhone(f.phone)) e.phone = 'Enter a valid phone number, for example 0803 123 4567.'
    if (hasEmail && !EMAIL_RE.test(f.email.trim())) e.email = 'Enter a valid email address.'
  }

  if (step === 1) {
    req('primary_expertise', 'Choose your primary expertise.')
    req('years_experience', 'Choose your years of experience.')
    req('qualification', 'Choose your highest qualification.')
    if (f.secondary_expertise.length > MAX_SECONDARY) {
      e.secondary_expertise = `Choose up to ${MAX_SECONDARY} secondary areas.`
    }
  }

  if (step === 2) {
    req('availability', 'Choose your geographic availability.')
    if (f.discoverable === '') e.discoverable = 'Tell us whether organisations may discover you.'
    if (!f.consent_contact) e.consent_contact = 'Your consent to be contacted is required to register.'
    if (f.profile_url.trim() && !isValidUrl(f.profile_url.trim())) {
      e.profile_url = 'Enter a valid link, for example linkedin.com/in/yourname.'
    }
  }

  return e
}

export function toPayload(f: FormData) {
  const url = f.profile_url.trim()
  return {
    full_name: f.full_name.trim(),
    title: f.title,
    organisation: f.organisation.trim(),
    position: f.position.trim(),
    state: f.state,
    phone: f.phone.trim(),
    email: f.email.trim().toLowerCase(),
    primary_expertise: f.primary_expertise,
    // A person's secondary choice cannot repeat their primary one.
    secondary_expertise: f.secondary_expertise.filter((x) => x !== f.primary_expertise),
    years_experience: f.years_experience,
    qualification: f.qualification,
    memberships: f.memberships,
    nes_number: f.memberships.includes('NES') ? f.nes_number.trim() : '',
    iepn_status: f.memberships.includes('IEPN') ? f.iepn_status.trim() : '',
    assignments: f.assignments,
    availability: f.availability,
    profile_url: url && !/^https?:\/\//i.test(url) ? `https://${url}` : url,
    discoverable: f.discoverable === 'yes',
    consent_contact: f.consent_contact,
    website: f.website,
  }
}

export const STORAGE_KEY = 'nexus-e:registration:v1'
export const EXPERT_ID_KEY = 'nexus-e:expert-id'
