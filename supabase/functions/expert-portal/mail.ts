// The sign-in code email. Pure functions, no network.

export const CODE_SUBJECT = 'Your NEXUS-E sign-in code'

const esc = (v: string) =>
  v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

export function greeting(title: string, fullName: string): string {
  const name = fullName.trim().replace(/\s+/g, ' ')
  const t = title.trim()
  if (!t || t.toLowerCase() === 'other') return name
  return name.toLowerCase().startsWith(t.toLowerCase() + ' ') ? name : `${t} ${name}`
}

export function buildCodeEmail(input: { title: string; fullName: string; code: string }) {
  const name = greeting(input.title, input.fullName)
  const text = [
    `Dear ${name},`,
    '',
    'Use this code to sign in to NEXUS-E and verify your profile:',
    '',
    `    ${input.code}`,
    '',
    'The code works once and expires in 10 minutes.',
    '',
    'If you did not ask for it, you can ignore this email. Nobody can sign in without the code.',
    '',
    'With thanks,',
    'The NEXUS-E team',
    '',
  ].join('\n')

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(CODE_SUBJECT)}</title></head>
<body style="margin:0;padding:0;background:#f3f6ee;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f3f6ee;">Your sign-in code is ${esc(input.code)}. It expires in 10 minutes.</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f6ee;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;">
<tr><td style="background:#06361e;padding:24px 32px;font-family:Arial,Helvetica,sans-serif;font-size:26px;font-weight:800;letter-spacing:-0.5px;color:#ffffff;">NEXUS<span style="color:#c5dc3f;">-E</span></td></tr>
<tr><td style="padding:32px 32px 8px 32px;font-family:Arial,Helvetica,sans-serif;color:#0f1a14;">
<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;">Dear ${esc(name)},</p>
<p style="margin:0 0 20px 0;font-size:16px;line-height:1.6;color:#2f3d35;">Use this code to sign in and verify your profile.</p>
</td></tr>
<tr><td style="padding:0 32px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#06361e;border-radius:14px;"><tr><td align="center" style="padding:22px 16px;">
<div style="font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#c5dc3f;">Your sign-in code</div>
<div style="font-family:Georgia,'Times New Roman',serif;font-size:40px;font-weight:700;letter-spacing:8px;color:#ffffff;margin-top:10px;">${esc(input.code)}</div>
</td></tr></table></td></tr>
<tr><td style="padding:20px 32px 28px 32px;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#2f3d35;">
The code works once and expires in 10 minutes. If you did not ask for it, you can ignore this email. Nobody can sign in without the code.<br><br>
With thanks,<br><strong style="color:#06361e;">The NEXUS-E team</strong></td></tr>
</table></td></tr></table></body></html>
`
  return { subject: CODE_SUBJECT, html, text }
}
