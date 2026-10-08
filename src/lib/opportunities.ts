// Shared opportunity vocabulary, dates and validation. No network and no browser APIs.
import { ASSIGNMENTS, EXPERTISE } from './options'

export type OppStatus = 'draft' | 'open' | 'closed'

/** What an expert sees. */
export type ExpertOpportunity = {
  id: string
  title: string
  description: string
  opp_type: string
  expertise_needed: string[]
  location: string
  deadline: string
  matches: boolean
  interested: boolean
}

/** What an administrator sees. */
export type AdminOpportunity = {
  id: string
  title: string
  description: string
  opp_type: string
  expertise_needed: string[]
  location: string
  deadline: string
  status: OppStatus
  expired: boolean
  created_at: string
  updated_at: string
  interested: number
}

export type InterestedExpert = {
  expert_id: string
  title: string
  full_name: string
  organisation: string
  position: string
  state: string
  email: string | null
  phone: string | null
  primary_expertise: string
  secondary_expertise: string[]
  years_experience: string
  qualification: string
  memberships: string[]
  assignments: string[]
  availability: string
  profile_url: string | null
  verification_status: string
  interested_at: string
}

export type OpportunityLogEntry = {
  actor: string
  action: string
  detail: Record<string, unknown>
  created_at: string
}

const DAY_MS = 86_400_000

/** A deadline such as 2026-11-12 is a calendar day in Nigeria. It is read as that day, whatever the viewer's time zone. */
const dayStart = (iso: string) => new Date(`${iso}T00:00:00Z`).getTime()

/** Today's date in Nigeria (UTC+1, no daylight saving), as YYYY-MM-DD. */
export const nigeriaToday = (now: number = Date.now()) => new Date(now + 3_600_000).toISOString().slice(0, 10)

export function formatDay(iso: string): string {
  return new Date(dayStart(iso)).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

/** Whole days from today until the deadline day. Zero means the deadline is today, negative means it has passed. */
export const daysLeft = (deadline: string, now: number = Date.now()) =>
  Math.round((dayStart(deadline) - dayStart(nigeriaToday(now))) / DAY_MS)

export function deadlineNote(deadline: string, now: number = Date.now()): string {
  const d = daysLeft(deadline, now)
  if (d < 0) return 'Closed'
  if (d === 0) return 'Closes today'
  if (d === 1) return '1 day left'
  return `${d} days left`
}

export type OppForm = {
  title: string
  description: string
  opp_type: string
  expertise_needed: string[]
  location: string
  deadline: string
  status: OppStatus
}

export const EMPTY_OPP: OppForm = {
  title: '',
  description: '',
  opp_type: '',
  expertise_needed: [],
  location: '',
  deadline: '',
  status: 'draft',
}

export type OppField = 'title' | 'description' | 'opp_type' | 'expertise_needed' | 'location' | 'deadline'

export const OPP_FIELD_LABEL: Record<OppField, string> = {
  title: 'Title',
  description: 'Description',
  opp_type: 'Type of assignment',
  expertise_needed: 'Expertise needed',
  location: 'Location',
  deadline: 'Deadline',
}

/** The same rules the database applies, so a person sees a friendly message before anything is sent. */
export function validateOpportunity(f: OppForm, now: number = Date.now()): Partial<Record<OppField, string>> {
  const e: Partial<Record<OppField, string>> = {}
  const title = f.title.trim()
  if (title.length < 3) e.title = 'Give the opportunity a short title of at least 3 characters.'
  else if (title.length > 140) e.title = 'Please shorten the title to 140 characters or fewer.'
  const desc = f.description.trim()
  if (desc.length < 10) e.description = 'Describe the work in a few sentences, at least 10 characters.'
  else if (desc.length > 4000) e.description = 'Please shorten the description to 4,000 characters or fewer.'
  if (!(ASSIGNMENTS as readonly string[]).includes(f.opp_type)) e.opp_type = 'Choose the type of assignment.'
  if (f.expertise_needed.length < 1) e.expertise_needed = 'Choose at least one area of expertise.'
  else if (!f.expertise_needed.every((x) => (EXPERTISE as readonly string[]).includes(x))) e.expertise_needed = 'Choose from the list of expertise areas.'
  const loc = f.location.trim()
  if (loc.length < 2) e.location = 'Say where the work is, for example Lagos, Remote or Niger Delta.'
  else if (loc.length > 120) e.location = 'Please shorten the location to 120 characters or fewer.'
  if (!/^\d{4}-\d{2}-\d{2}$/.test(f.deadline) || Number.isNaN(dayStart(f.deadline))) e.deadline = 'Choose the last day experts can show interest.'
  else if (f.status === 'open' && daysLeft(f.deadline, now) < 0) e.deadline = 'This deadline has already passed, so the opportunity cannot be opened. Choose a later date.'
  return e
}

/** What each error from the database means to a person. */
export const OPP_ERRORS: Record<string, string> = {
  bad_title: 'Give the opportunity a short title of at least 3 characters.',
  bad_description: 'Describe the work in a few sentences, at least 10 characters.',
  bad_location: 'Say where the work is, for example Lagos, Remote or Niger Delta.',
  bad_deadline: 'Choose the last day experts can show interest.',
  bad_expertise: 'Choose at least one area of expertise.',
  bad_status: 'That status was not understood. Please refresh the page and try again.',
  deadline_passed: 'This deadline has already passed, so the opportunity cannot be opened. Choose a later date.',
  invalid: 'Some of those details were not accepted. Please check the type of assignment and the expertise areas.',
  not_found: 'That opportunity no longer exists. It may have been deleted. Please go back to the list.',
  not_admin: 'Your login does not have permission to manage opportunities.',
}

export const STATUS_WORDS: Record<OppStatus | 'expired', string> = {
  draft: 'Draft',
  open: 'Open',
  closed: 'Closed',
  expired: 'Open, past deadline',
}

/** A short plain sentence for each line of the change log. */
export function describeLogEntry(action: string, detail: Record<string, unknown>): string {
  const changed = (detail.changed ?? detail.also_changed) as string[] | undefined
  const extra = changed && changed.length ? ` Also changed: ${changed.join(', ')}.` : ''
  switch (action) {
    case 'created':
      return `Created as ${String(detail.status ?? 'draft')}.`
    case 'published':
      return `Published, so experts can see it.${extra}`
    case 'closed':
      return `Closed.${extra}`
    case 'reopened':
      return `Opened again.${extra}`
    case 'set_to_draft':
      return `Moved back to draft.${extra}`
    case 'updated':
      return `Edited: ${changed && changed.length ? changed.join(', ') : 'details'}.`
    case 'deleted':
      return `Deleted. ${Number(detail.interested_experts ?? 0)} expert(s) had expressed interest.`
    default:
      return action
  }
}
