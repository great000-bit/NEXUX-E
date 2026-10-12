// The admin notification email. Pure functions, no network, so they are tested without a server.
// Rules: English only, plain and short, and never any contact detail (no name, phone or email of the expert).

export type Registration = {
  id: number
  expertId: string
  primaryExpertise: string
  country: string
  registeredAt: string
}

export const SUMMARY_THRESHOLD = 5

const LAGOS = 'Africa/Lagos'

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

const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

type Email = { subject: string; text: string; html: string }

function wrap(lines: string[], adminUrl: string): Email['html'] {
  const rows = lines.map((l) => `<p style="margin:0 0 8px 0;">${esc(l)}</p>`).join('')
  return `<!doctype html><html lang="en"><body style="margin:0;padding:16px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0f1a14;">${rows}<p style="margin:12px 0 0 0;"><a href="${esc(adminUrl)}">${esc(adminUrl)}</a></p></body></html>`
}

export function buildSingle(r: Registration, today: number, adminUrl: string): Email {
  const lines = [
    `Expert ID: ${r.expertId}`,
    `Primary expertise: ${r.primaryExpertise || 'Not given'}`,
    `Country: ${r.country || 'Not given'}`,
    `Registered: ${formatTime(r.registeredAt)}`,
    `Registrations today: ${today}`,
    'Admin dashboard:',
  ]
  return { subject: `New NEXUS-E registration ${r.expertId}`, text: `${lines.join('\n')}\n${adminUrl}\n`, html: wrap(lines, adminUrl) }
}

export function buildSummary(rs: Registration[], today: number, adminUrl: string): Email {
  const sorted = [...rs].sort((a, b) => a.registeredAt.localeCompare(b.registeredAt))
  const lines = [
    `${rs.length} new registrations`,
    `From: ${formatTime(sorted[0].registeredAt)}`,
    `To: ${formatTime(sorted[sorted.length - 1].registeredAt)}`,
    `Expert IDs: ${sorted.map((r) => r.expertId).join(', ')}`,
    `Registrations today: ${today}`,
    'Admin dashboard:',
  ]
  return { subject: `${rs.length} new NEXUS-E registrations`, text: `${lines.join('\n')}\n${adminUrl}\n`, html: wrap(lines, adminUrl) }
}

export function buildTest(adminUrl: string): Email {
  const lines = ['This is a test of the registration notification.', 'No one has registered.', 'Admin dashboard:']
  return { subject: 'TEST notification', text: `${lines.join('\n')}\n${adminUrl}\n`, html: wrap(lines, adminUrl) }
}

/** More than five waiting at once means a busy hour: one summary instead of many emails. */
export const needsSummary = (count: number) => count > SUMMARY_THRESHOLD
