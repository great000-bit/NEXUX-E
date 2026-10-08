// Verification status emails and the dispatcher that picks the right email for an outbox row.
// Pure functions only (no Deno or Node APIs).
import { buildEmail, escapeHtml, greetingName, type BuiltEmail } from './email.ts'

export type StatusTemplate =
  | 'verification_received'
  | 'verification_more_evidence'
  | 'verification_verified'
  | 'verification_not_verified'

export type EmailJob = {
  template: string
  expert_id: string
  full_name: string
  title: string
  payload: Record<string, unknown>
}

export type EmailOptions = { siteUrl: string; contactEmail?: string }

const GREEN_900 = '#06361e'
const GREEN_800 = '#0b4a2a'
const LIME = '#c5dc3f'
const MINT = '#e6f2d0'
const INK = '#0f1a14'
const INK_SOFT = '#2f3d35'

type Content = {
  subject: string
  heading: string
  paragraphs: string[]
  /** An admin's own words, shown in a highlighted block. */
  quoteLabel?: string
  quote?: string
  after?: string[]
  button?: { label: string; href: string }
}

/** Keeps line breaks and tabs, drops other control characters, and caps the length. */
const clean = (v: unknown, max = 1200) =>
  [...String(v ?? '')]
    .filter((ch) => {
      const code = ch.charCodeAt(0)
      return code >= 32 || code === 9 || code === 10
    })
    .join('')
    .trim()
    .slice(0, max)

function contentFor(template: StatusTemplate, job: EmailJob, opts: EmailOptions): Content {
  const site = opts.siteUrl.replace(/\/+$/, '')
  const verifyUrl = `${site}/verify`
  const message = clean(job.payload?.message)
  const contact = opts.contactEmail
    ? `If you would like to talk this through, please write to ${opts.contactEmail}.`
    : 'If you would like to talk this through, please contact the NEXUS-E team.'

  switch (template) {
    case 'verification_received':
      return {
        subject: 'We have received your evidence: NEXUS-E',
        heading: 'Evidence received',
        paragraphs: [
          'Thank you. We have received the documents you submitted, and your status is now Under review.',
          'A member of our team will look at them carefully. We will email you as soon as there is a decision, and if we need anything else we will tell you exactly what.',
          'There is nothing more you need to do for now.',
        ],
      }
    case 'verification_more_evidence':
      return {
        subject: 'We need a little more evidence for your NEXUS-E verification',
        heading: 'A little more evidence, please',
        paragraphs: [
          'Thank you for submitting your documents. Before we can verify your profile, we need a little more from you.',
        ],
        quoteLabel: 'Message from our reviewer',
        quote: message || 'Please add or replace the documents we asked for.',
        after: [
          'To continue, sign in with your registered email, add or replace documents, and submit again. Your earlier documents are still there.',
        ],
        button: { label: 'Add more evidence', href: verifyUrl },
      }
    case 'verification_verified':
      return {
        subject: 'You are now a Verified Expert on NEXUS-E',
        heading: 'You are a Verified Expert',
        paragraphs: [
          'Congratulations. We have reviewed your documents and verified your profile.',
          `Your Expert ID is ${job.expert_id}. You now hold Verified Expert status in the Nigerian Environmental Expertise Exchange, and organisations will be able to see that your credentials have been checked.`,
          'Thank you for taking the time to complete verification.',
        ],
        button: { label: 'View your profile', href: verifyUrl },
      }
    case 'verification_not_verified':
      return {
        subject: 'An update on your NEXUS-E verification',
        heading: 'An update on your verification',
        paragraphs: [
          'Thank you for the time you took to submit your documents. After careful review, we are not able to verify your profile at this time.',
        ],
        quoteLabel: 'Reason',
        quote: message || 'The documents we received did not allow us to confirm your credentials.',
        after: [
          'Your registration remains in place, and this decision does not stop you from taking part in NEXUS-E.',
          contact,
          'For your privacy, we keep uploaded documents only for a short time after a decision, and then delete them.',
        ],
      }
  }
}

function render(c: Content, name: string): { html: string; text: string } {
  const text = [
    `Dear ${name},`,
    '',
    ...c.paragraphs.flatMap((p) => [p, '']),
    ...(c.quote ? [`${c.quoteLabel}:`, c.quote, ''] : []),
    ...(c.after ?? []).flatMap((p) => [p, '']),
    ...(c.button ? [`${c.button.label}: ${c.button.href}`, ''] : []),
    'With thanks,',
    'The NEXUS-E team',
    'Nigerian Environmental Expertise Exchange',
    '',
  ].join('\n')

  const p = (s: string, color = INK_SOFT) =>
    `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${color};">${escapeHtml(s)}</p>`

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(c.subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6ee;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6ee;">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
      <tr><td style="background:${GREEN_900};padding:28px 32px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">NEXUS<span style="color:${LIME};">-E</span></div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#cfe3bf;margin-top:6px;">Nigerian Environmental Expertise Exchange</div>
      </td></tr>
      <tr><td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
        <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${GREEN_900};">${escapeHtml(c.heading)}</h1>
        ${p(`Dear ${name},`, INK)}
        ${c.paragraphs.map((s) => p(s)).join('\n        ')}
      </td></tr>
      ${
        c.quote
          ? `<tr><td style="padding:0 32px 8px 32px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${MINT};border-radius:14px;"><tr><td style="padding:18px 22px;">
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:${GREEN_800};margin-bottom:8px;">${escapeHtml(c.quoteLabel ?? '')}</div>
        <div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(c.quote)}</div>
      </td></tr></table></td></tr>`
          : ''
      }
      ${
        c.after && c.after.length
          ? `<tr><td style="padding:16px 32px 0 32px;font-family:Arial,Helvetica,sans-serif;">${c.after.map((s) => p(s)).join('')}</td></tr>`
          : ''
      }
      ${
        c.button
          ? `<tr><td align="center" style="padding:8px 32px;"><a href="${escapeHtml(c.button.href)}" style="display:inline-block;background:${LIME};color:${GREEN_900};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">${escapeHtml(c.button.label)}</a></td></tr>`
          : ''
      }
      <tr><td style="padding:16px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${INK_SOFT};">
        With thanks,<br><strong style="color:${GREEN_900};">The NEXUS-E team</strong>
      </td></tr>
      <tr><td style="background:${GREEN_900};padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#cfe3bf;">
        You are receiving this because you registered on NEXUS-E.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>
`
  return { html, text }
}

export const STATUS_TEMPLATES: StatusTemplate[] = [
  'verification_received',
  'verification_more_evidence',
  'verification_verified',
  'verification_not_verified',
]

/** Builds the email for any outbox row. Throws for a template it does not know. */
export function composeEmail(job: EmailJob, opts: EmailOptions): BuiltEmail {
  if (job.template === 'registration_confirmation') {
    return buildEmail({ expert_id: job.expert_id, full_name: job.full_name, title: job.title }, { siteUrl: opts.siteUrl })
  }
  if ((STATUS_TEMPLATES as string[]).includes(job.template)) {
    const content = contentFor(job.template as StatusTemplate, job, opts)
    const { html, text } = render(content, greetingName(job.title, job.full_name))
    return { subject: content.subject, html, text }
  }
  throw new Error(`Unknown email template: ${job.template}`)
}
