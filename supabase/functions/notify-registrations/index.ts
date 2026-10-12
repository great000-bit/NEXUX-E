// Supabase Edge Function: emails the admin when someone registers.
//
// A pg_cron job calls this once a minute (only when something is waiting), with the x-webhook-secret header. It sends the
// rows in public.registration_notifications through Resend: one email each, or one summary when more than 5 are waiting.
// A failed send is counted and retried; after 5 failures the row stays in the table, flagged. Registration itself never
// waits for any of this.
//
// The admin address is read from public.verification_settings (registration_notify_email). It is not in the code.
// Secrets come from the function environment or Supabase Vault. Nothing but ids and error text is logged.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { buildSingle, buildSummary, buildTest, needsSummary, type Registration } from './compose.ts'

const env = (name: string, fallback = ''): string => Deno.env.get(name) ?? fallback
const MAX_ATTEMPTS = 5

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const secret = async (envName: string, vaultName: string): Promise<string> => {
    const fromEnv = env(envName)
    if (fromEnv) return fromEnv
    const { data } = await db.rpc('get_function_secret', { p_name: vaultName })
    return typeof data === 'string' ? data : ''
  }
  const setting = async (key: string): Promise<string> => {
    const { data } = await db.from('verification_settings').select('value').eq('key', key).maybeSingle()
    return typeof data?.value === 'string' ? data.value.trim() : ''
  }

  const webhookSecret = await secret('WEBHOOK_SECRET', 'email_webhook_secret')
  if (!webhookSecret) return json({ error: 'not_configured' }, 500)
  if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', webhookSecret)) return json({ error: 'unauthorized' }, 401)

  let body: Record<string, unknown> = {}
  try {
    body = await req.json()
  } catch {
    /* an empty body is fine */
  }
  const testMode = body.mode === 'test'

  if ((await setting('registration_notify_enabled')) === 'false' && !testMode) return json({ ok: true, skipped: 'disabled' })
  const to = await setting('registration_notify_email')
  if (!to) return json({ ok: true, skipped: 'no_address' })

  const apiKey = await secret('RESEND_API_KEY', 'resend_api_key')
  if (!apiKey) {
    console.error('No Resend key for the registration notification')
    return json({ error: 'not_configured' }, 500)
  }
  const from = env('EMAIL_FROM', 'NEXUS-E <noreply@nexuse.org>')
  const replyTo = env('EMAIL_REPLY_TO') || (await setting('email_reply_to'))
  const adminUrl = `${env('SITE_URL', 'https://register.nexuse.org')}/admin`

  const send = async (email: { subject: string; text: string; html: string }, idempotencyKey: string) => {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ from, to: [to], subject: email.subject, html: email.html, text: email.text, ...(replyTo ? { reply_to: replyTo } : {}) }),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.id) return { ok: true as const, id: String(data.id) }
      return { ok: false as const, error: `Resend ${res.status}: ${String(data?.message ?? data?.name ?? 'not accepted').slice(0, 200)}` }
    } catch (e) {
      return { ok: false as const, error: `Network error: ${e instanceof Error ? e.name : 'unknown'}` }
    }
  }

  // A labelled test: exactly one email, no registration involved, nothing read from or written to the outbox.
  if (testMode) {
    const r = await send(buildTest(adminUrl), `nexus-e-notify-test/${Date.now()}`)
    return json(r.ok ? { ok: true, mode: 'test', message_id: r.id } : { ok: false, mode: 'test', error: r.error }, r.ok ? 200 : 502)
  }

  const { data: claimed, error } = await db.rpc('claim_registration_notifications', { p_limit: 100, p_max_attempts: MAX_ATTEMPTS })
  if (error) {
    console.error('claim_registration_notifications failed', error.code ?? '')
    return json({ error: 'claim_failed' }, 500)
  }
  const rows: Registration[] = (claimed ?? []).map((r: Record<string, unknown>) => ({
    id: Number(r.job_id),
    expertId: String(r.job_expert_id),
    primaryExpertise: String(r.job_primary_expertise ?? ''),
    country: String(r.job_country ?? ''),
    registeredAt: String(r.job_registered_at ?? r.job_created_at),
  }))
  if (!rows.length) return json({ ok: true, sent: 0 })

  const { data: todayData } = await db.rpc('registrations_today')
  const today = typeof todayData === 'number' ? todayData : rows.length

  const settle = async (ids: number[], r: Awaited<ReturnType<typeof send>>) => {
    if (r.ok) await db.rpc('mark_registration_notifications_sent', { p_ids: ids, p_provider_id: r.id })
    else await db.rpc('fail_registration_notifications', { p_ids: ids, p_error: r.error, p_max_attempts: MAX_ATTEMPTS })
    return r.ok
  }

  let sent = 0
  let failed = 0
  if (needsSummary(rows.length)) {
    const ids = rows.map((r) => r.id)
    const ok = await settle(ids, await send(buildSummary(rows, today, adminUrl), `nexus-e-notify-summary/${ids[0]}-${ids[ids.length - 1]}-${ids.length}`))
    if (ok) sent += ids.length
    else failed += ids.length
    return json({ ok: true, mode: 'summary', sent, failed })
  }
  for (const r of rows) {
    const ok = await settle([r.id], await send(buildSingle(r, today, adminUrl), `nexus-e-notify/${r.id}`))
    if (ok) sent += 1
    else failed += 1
    await new Promise((res) => setTimeout(res, 600)) // Resend allows 2 requests a second
  }
  return json({ ok: true, mode: 'single', sent, failed })
})
