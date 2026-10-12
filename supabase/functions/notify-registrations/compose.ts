// The admin notification email. Pure functions, no network, so they are tested without a server.
// It uses the same layout code as the expert emails (header, logo, colours, button, footer): see status-emails.ts.
// Rules: English only, plain and short, and never any contact detail (no name, phone or email of the expert).
import { render, type Content } from './status-emails.ts'

export type Registration = {
  id: number
  expertId: string
  primaryExpertise: string
  country: string
  registeredAt: string
}

export const SUMMARY_THRESHOLD = 5

const LAGOS = 'Africa/Lagos'
const FOOTER = 'You are receiving this because you are an administrator of NEXUS-E.'

/** "12 Oct 2026, 21:04 (Lagos time)" */
export function formatTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: LAGOS, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const p = (t: string) => parts.find((x) => x.type === t)?.value ?? ''
  return `${p('day')} ${p('month')} ${p('year')}, ${p('hour')}:${p('minute')} (Lagos time)`
}

type Email = { subject: string; text: string; html: string }

const build = (c: Content): Email => ({ subject: c.subject, ...render(c, '') })

const button = (adminUrl: string) => ({ label: 'Open admin dashboard', href: adminUrl })

export function buildSingle(r: Registration, today: number, adminUrl: string): Email {
  return build({
    greeting: '',
    footer: FOOTER,
    subject: `New NEXUS-E registration ${r.expertId}`,
    heading: 'New registration',
    paragraphs: ['A new expert has registered on NEXUS-E.'],
    details: [
      { label: 'Expert ID', value: r.expertId },
      { label: 'Primary expertise', value: r.primaryExpertise || 'Not given' },
      { label: 'Country', value: r.country || 'Not given' },
      { label: 'Time (Africa/Lagos)', value: formatTime(r.registeredAt) },
      { label: 'Registrations today', value: String(today) },
    ],
    button: button(adminUrl),
  })
}

export function buildSummary(rs: Registration[], today: number, adminUrl: string): Email {
  const sorted = [...rs].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
  return build({
    greeting: '',
    footer: FOOTER,
    subject: `${rs.length} new NEXUS-E registrations`,
    heading: `${rs.length} new registrations`,
    paragraphs: [`${rs.length} new experts have registered on NEXUS-E.`],
    details: [
      { label: 'Expert IDs', value: sorted.map((r) => r.expertId).join('\n') },
      { label: 'From (Africa/Lagos)', value: formatTime(sorted[0].registeredAt) },
      { label: 'To (Africa/Lagos)', value: formatTime(sorted[sorted.length - 1].registeredAt) },
      { label: 'Registrations today', value: String(today) },
    ],
    button: button(adminUrl),
  })
}

/** The same design as the real emails with sample details, marked TEST, so the design can be seen without registering anyone. */
export function buildTest(adminUrl: string): Email {
  return build({
    greeting: '',
    footer: FOOTER,
    banner: 'TEST',
    subject: 'TEST notification',
    heading: 'New registration',
    paragraphs: ['This is a test. No one has registered. A real notification looks like this.'],
    details: [
      { label: 'Expert ID', value: 'NEX-000123' },
      { label: 'Primary expertise', value: 'Water and Hydrogeology' },
      { label: 'Country', value: 'Kenya' },
      { label: 'Time (Africa/Lagos)', value: formatTime(new Date().toISOString()) },
      { label: 'Registrations today', value: '1' },
    ],
    button: button(adminUrl),
  })
}

/** More than five waiting at once means a busy hour: one summary instead of many emails. */
export const needsSummary = (count: number) => count > SUMMARY_THRESHOLD
