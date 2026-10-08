// Supabase Edge Function: sends queued confirmation emails through Resend.
//
// Wake-ups: a database trigger on public.email_outbox (new row) and a pg_cron sweep every 10 minutes.
// Both call this function with the x-webhook-secret header. See README for setup.
//
// Secrets come from the function environment or Supabase Vault. Nothing here is ever logged except ids and error text.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { composeEmail } from './status-emails.ts'
import { classifyResendError, processOutbox, type Deps, type OutboxJob, type SendResult } from './logic.ts'

const env = (name: string, fallback = ''): string => Deno.env.get(name) ?? fallback
const intEnv = (name: string, fallback: number): number => {
  const n = Number.parseInt(env(name), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

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

  // A secret comes from the function's environment if set, otherwise from Supabase Vault.
  const secret = async (envName: string, vaultName: string): Promise<string> => {
    const fromEnv = env(envName)
    if (fromEnv) return fromEnv
    const { data, error } = await db.rpc('get_function_secret', { p_name: vaultName })
    if (error) console.error(JSON.stringify({ message: 'Could not read secret from Vault', name: vaultName }))
    return typeof data === 'string' ? data : ''
  }

  const webhookSecret = await secret('WEBHOOK_SECRET', 'email_webhook_secret')
  if (!webhookSecret) {
    console.error('No webhook secret: set WEBHOOK_SECRET or the email_webhook_secret Vault secret')
    return json({ error: 'not_configured' }, 500)
  }
  if (!safeEqual(req.headers.get('x-webhook-secret') ?? '', webhookSecret)) {
    return json({ error: 'unauthorized' }, 401)
  }

  const apiKey = await secret('RESEND_API_KEY', 'resend_api_key')
  const from = env('EMAIL_FROM', 'NEXUS-E <noreply@nexuse.org>')
  const replyTo = env('EMAIL_REPLY_TO')
  const siteUrl = env('SITE_URL', 'https://register.nexuse.org')
  const maxAttempts = intEnv('EMAIL_MAX_ATTEMPTS', 5)
  const dailyCap = intEnv('EMAIL_DAILY_CAP', 100)

  if (!apiKey) {
    console.error('No Resend key: set RESEND_API_KEY or the resend_api_key Vault secret')
    return json({ error: 'not_configured' }, 500)
  }

  const iso = (secondsFromNow: number) => new Date(Date.now() + secondsFromNow * 1000).toISOString()

  const deps: Deps = {
    maxAttempts,
    batchSize: intEnv('EMAIL_BATCH_SIZE', 20),
    spacingMs: 600,
    budgetMs: 90_000,
    now: () => Date.now(),
    sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
    log: (level, message, fields) => {
      const line = JSON.stringify({ message, ...fields })
      if (level === 'error') console.error(line)
      else if (level === 'warn') console.warn(line)
      else console.log(line)
    },

    async claim(limit) {
      const { data, error } = await db.rpc('claim_outbox_emails', {
        p_batch: limit,
        p_max_attempts: maxAttempts,
        p_daily_cap: dailyCap,
      })
      if (error) throw new Error(`claim_outbox_emails failed: ${error.message}`)
      return (data ?? []).map(
        (r: Record<string, unknown>): OutboxJob => ({
          id: Number(r.job_id),
          expert_id: String(r.job_expert_id),
          to_email: String(r.job_to_email),
          full_name: String(r.job_full_name),
          title: String(r.job_title),
          template: String(r.job_template ?? 'registration_confirmation'),
          payload: (r.job_payload ?? {}) as Record<string, unknown>,
          attempts: Number(r.job_attempts),
        }),
      )
    },

    async send(job): Promise<SendResult> {
      let email
      try {
        email = composeEmail(job, { siteUrl, contactEmail: env('CONTACT_EMAIL') || undefined })
      } catch (e) {
        // An unknown template can never succeed, so give up on the row instead of retrying.
        return { ok: false, kind: 'permanent', message: e instanceof Error ? e.message : 'Could not build the email' }
      }
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            // Resend ignores a repeat of the same key for 24 hours, so a retry can never double send.
            // The outbox row id never repeats, even if test data is deleted and Expert IDs restart at 1.
            'Idempotency-Key': `nexus-e-confirmation/outbox-${job.id}`,
          },
          body: JSON.stringify({
            from,
            to: [job.to_email],
            subject: email.subject,
            html: email.html,
            text: email.text,
            ...(replyTo ? { reply_to: replyTo } : {}),
          }),
        })
        const body = await res.json().catch(() => null)
        if (res.ok && body?.id) return { ok: true, providerId: String(body.id) }
        const { kind, message } = classifyResendError(res.status, body)
        return { ok: false, kind, message }
      } catch (e) {
        return { ok: false, kind: 'temporary', message: `Network error: ${e instanceof Error ? e.message : 'unknown'}` }
      }
    },

    async markSent(job, providerId) {
      await db
        .from('email_outbox')
        .update({ status: 'sent', sent_at: new Date().toISOString(), provider_id: providerId, last_error: null, locked_at: null })
        .eq('id', job.id)
        .eq('status', 'sending')
    },

    async markRetry(job, error, retryAfterSeconds) {
      await db
        .from('email_outbox')
        .update({ status: 'failed', last_error: error, failed_at: new Date().toISOString(), next_attempt_at: iso(retryAfterSeconds), locked_at: null })
        .eq('id', job.id)
        .eq('status', 'sending')
    },

    async markDead(job, error) {
      await db
        .from('email_outbox')
        .update({ status: 'dead', last_error: error, failed_at: new Date().toISOString(), locked_at: null })
        .eq('id', job.id)
        .eq('status', 'sending')
    },

    async release(job, reason, retryAfterSeconds) {
      await db
        .from('email_outbox')
        .update({
          status: 'pending',
          attempts: Math.max(0, job.attempts - 1),
          last_error: reason,
          next_attempt_at: iso(retryAfterSeconds),
          locked_at: null,
        })
        .eq('id', job.id)
        .eq('status', 'sending')
    },
  }

  try {
    const summary = await processOutbox(deps)
    console.log(JSON.stringify({ message: 'Outbox run finished', ...summary }))
    return json(summary)
  } catch (e) {
    console.error(JSON.stringify({ message: 'Outbox run crashed', error: e instanceof Error ? e.message : 'unknown' }))
    return json({ error: 'run_failed' }, 500)
  }
})
