// Sends one real confirmation email through Resend using the production template.
// Reads RESEND_API_KEY, EMAIL_FROM, EMAIL_REPLY_TO and SITE_URL from supabase/.env.local (gitignored).
//
//   node scripts/send-test-email.mjs --to you@example.com --id NEX-000123 --name "Ada Obi" --title Dr
//
// The key is never printed.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildEmail } from '../supabase/functions/send-confirmation-emails/email.ts'

const here = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(
  fs.readFileSync(path.join(here, '../supabase/.env.local'), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#') && l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
)
const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}
const to = arg('to'), id = arg('id'), name = arg('name') ?? 'Test Expert', title = arg('title') ?? 'Dr'
if (!to || !id) throw new Error('Usage: --to <email> --id <NEX-000000> [--name "Full Name"] [--title Dr]')
if (!env.RESEND_API_KEY) throw new Error('RESEND_API_KEY missing in supabase/.env.local')

const mail = buildEmail({ expert_id: id, full_name: name, title }, { siteUrl: env.SITE_URL || 'https://register.nexuse.org' })
const res = await fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${env.RESEND_API_KEY}`,
    'Content-Type': 'application/json',
    'Idempotency-Key': `test/${id}/${Date.now()}`,
  },
  body: JSON.stringify({
    from: env.EMAIL_FROM || 'NEXUS-E <noreply@nexuse.org>',
    to: [to],
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    ...(env.EMAIL_REPLY_TO ? { reply_to: env.EMAIL_REPLY_TO } : {}),
  }),
})
const body = await res.json().catch(() => ({}))
console.log(JSON.stringify({ status: res.status, ok: res.ok, resendId: body.id ?? null, error: body.name ? `${body.name}: ${body.message}` : null, expertIdInEmail: id }, null, 2))
process.exitCode = res.ok ? 0 : 1
