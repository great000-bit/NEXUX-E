// Confirmation email content. Pure functions only (no Deno or Node APIs), so the same file runs
// in the Edge Function and in local tests.

export type ConfirmationJob = {
  expert_id: string
  full_name: string
  title: string
}

export type BuiltEmail = { subject: string; html: string; text: string }

export const SUBJECT = 'You are registered: your NEXUS-E Expert ID'

const GREEN_900 = '#06361e'
const GREEN_800 = '#0b4a2a'
const LIME = '#c5dc3f'
const MINT = '#e6f2d0'
const INK = '#0f1a14'
const INK_SOFT = '#2f3d35'

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** "Dr Ada Obi". Skips the title when it is "Other" or the name already starts with it. */
export function greetingName(title: string, fullName: string): string {
  const name = fullName.trim().replace(/\s+/g, ' ')
  const t = title.trim()
  if (!t || t.toLowerCase() === 'other') return name
  const alreadyThere = new RegExp(`^${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.?\\s`, 'i').test(name)
  return alreadyThere ? name : `${t} ${name}`
}

export function buildEmail(job: ConfirmationJob, opts: { siteUrl: string }): BuiltEmail {
  const siteUrl = opts.siteUrl.replace(/\/+$/, '')
  const siteLabel = siteUrl.replace(/^https?:\/\//, '')
  const name = greetingName(job.title, job.full_name)

  const text = [
    `Dear ${name},`,
    '',
    'You are registered. Welcome to NEXUS-E, the African Environmental Expertise Exchange.',
    '',
    `YOUR EXPERT ID: ${job.expert_id}`,
    '',
    'You are now a founding expert of the African Environmental Expertise Exchange. Please keep this ID safe, because you will need it when you verify your profile.',
    '',
    'What happens next',
    'After the conference we will contact you with the steps to complete your verification. Verification confirms your membership, licence and credentials, and it is how you earn Verified Expert status. There is nothing more you need to do today.',
    '',
    `Visit us: ${siteUrl}`,
    '',
    'If you did not register for NEXUS-E, you can safely ignore this email.',
    '',
    'With thanks,',
    'The NEXUS-E team',
    'African Environmental Expertise Exchange',
    '',
  ].join('\n')

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>${escapeHtml(SUBJECT)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f6ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f6ee;">Your Expert ID is ${escapeHtml(job.expert_id)}. Welcome, founding expert.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6ee;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;">
        <tr>
          <td style="background:${GREEN_900};padding:28px 32px;">
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:28px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">NEXUS<span style="color:${LIME};">-E</span></div>
            <div style="font-family:Arial,Helvetica,sans-serif;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#cfe3bf;margin-top:6px;">African Environmental Expertise Exchange</div>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
            <h1 style="margin:0 0 16px 0;font-family:Georgia,'Times New Roman',serif;font-size:28px;line-height:1.2;color:${GREEN_900};">You are registered</h1>
            <p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:${INK};">Dear ${escapeHtml(name)},</p>
            <p style="margin:0 0 24px 0;font-size:16px;line-height:1.6;color:${INK_SOFT};">Welcome to NEXUS-E. You are now a founding expert of the African Environmental Expertise Exchange.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 32px 8px 32px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${GREEN_900};border-radius:14px;">
              <tr>
                <td align="center" style="padding:24px 16px;">
                  <div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:${LIME};">Your Expert ID</div>
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:38px;font-weight:700;letter-spacing:3px;color:#ffffff;margin-top:10px;">${escapeHtml(job.expert_id)}</div>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;color:${INK_SOFT};text-align:center;">Please keep this ID safe. You will need it when you verify your profile.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${MINT};border-radius:14px;">
              <tr>
                <td style="padding:20px 22px;">
                  <div style="font-family:Georgia,'Times New Roman',serif;font-size:19px;font-weight:700;color:${GREEN_800};margin-bottom:8px;">What happens next</div>
                  <div style="font-size:15px;line-height:1.6;color:${INK_SOFT};">After the conference we will contact you with the steps to complete your verification. Verification confirms your membership, licence and credentials, and it is how you earn Verified Expert status. There is nothing more you need to do today.</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:24px 32px 8px 32px;">
            <a href="${escapeHtml(siteUrl)}" style="display:inline-block;background:${LIME};color:${GREEN_900};font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:700;text-decoration:none;padding:14px 28px;border-radius:999px;">Visit ${escapeHtml(siteLabel)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 32px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:${INK_SOFT};">
            With thanks,<br>
            <strong style="color:${GREEN_900};">The NEXUS-E team</strong>
          </td>
        </tr>
        <tr>
          <td style="background:${GREEN_900};padding:18px 32px;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:#cfe3bf;">
            You are receiving this because you registered on NEXUS-E. If this was not you, you can safely ignore this email.
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
`

  return { subject: SUBJECT, html, text }
}
