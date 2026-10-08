// Outbox processing rules. No network or Deno APIs here: everything external is injected,
// so the failure paths can be tested locally.

export type OutboxJob = {
  id: number
  expert_id: string
  to_email: string
  full_name: string
  title: string
  /** Which email this row is: registration_confirmation or a verification_* status email. */
  template: string
  payload: Record<string, unknown>
  /** Includes the attempt now being made (the claim already incremented it). */
  attempts: number
}

export type SendResult =
  | { ok: true; providerId: string }
  | { ok: false; kind: FailureKind; message: string }

/**
 * daily_limit: Resend quota used up. Stop, leave the rest for later, do not count the attempt.
 * config:      bad API key or unverified domain. Stop, leave rows for later, do not count the attempt.
 * rate_limit:  too many requests per second. Wait briefly and try the same row once more.
 * temporary:   network or server trouble. Retry later with backoff, counts toward the cap.
 * permanent:   the address or content was rejected. Retrying cannot help, so give up on this row.
 */
export type FailureKind = 'daily_limit' | 'config' | 'rate_limit' | 'temporary' | 'permanent'

export interface Deps {
  claim(limit: number): Promise<OutboxJob[]>
  send(job: OutboxJob): Promise<SendResult>
  markSent(job: OutboxJob, providerId: string): Promise<void>
  /** Failed but retryable: status 'failed', try again after the delay. */
  markRetry(job: OutboxJob, error: string, retryAfterSeconds: number): Promise<void>
  /** Gave up: status 'dead'. */
  markDead(job: OutboxJob, error: string): Promise<void>
  /** Hand the row back untouched: status 'pending', attempt not counted. */
  release(job: OutboxJob, reason: string, retryAfterSeconds: number): Promise<void>
  sleep(ms: number): Promise<void>
  now(): number
  log(level: 'info' | 'warn' | 'error', message: string, fields?: Record<string, unknown>): void
  maxAttempts: number
  batchSize: number
  /** Pause between sends. Resend allows 2 requests per second by default. */
  spacingMs: number
  /** Stop starting new batches after this many milliseconds. */
  budgetMs: number
}

export type Summary = {
  claimed: number
  sent: number
  retryLater: number
  dead: number
  released: number
  stoppedBecause: 'empty' | 'daily_limit' | 'config' | 'time_budget'
}

/** 5 minutes, then 20, 80, 320 minutes, never more than 6 hours. */
export function backoffSeconds(attempts: number): number {
  const minutes = 5 * Math.pow(4, Math.max(0, attempts - 1))
  return Math.min(minutes, 360) * 60
}

type ResendErrorBody = { name?: string; message?: string; statusCode?: number } | null

export function classifyResendError(status: number, body: ResendErrorBody): { kind: FailureKind; message: string } {
  const name = body?.name ?? ''
  const detail = body?.message ?? ''
  const message = `Resend ${status}${name ? ` ${name}` : ''}${detail ? `: ${detail}` : ''}`.slice(0, 500)

  if (status === 429) {
    const quota = /quota/i.test(name) || /daily|monthly|quota/i.test(detail)
    return { kind: quota ? 'daily_limit' : 'rate_limit', message }
  }
  if (status === 401 || status === 403) return { kind: 'config', message }
  if (status === 409 || status === 408 || status >= 500) return { kind: 'temporary', message }
  if (status >= 400) return { kind: 'permanent', message }
  return { kind: 'temporary', message }
}

export async function processOutbox(deps: Deps): Promise<Summary> {
  const summary: Summary = { claimed: 0, sent: 0, retryLater: 0, dead: 0, released: 0, stoppedBecause: 'empty' }
  const started = deps.now()

  while (true) {
    if (deps.now() - started > deps.budgetMs) {
      summary.stoppedBecause = 'time_budget'
      return summary
    }

    const jobs = await deps.claim(deps.batchSize)
    if (jobs.length === 0) {
      summary.stoppedBecause = 'empty'
      return summary
    }
    summary.claimed += jobs.length

    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i]
      let result = await deps.send(job)

      if (!result.ok && result.kind === 'rate_limit') {
        deps.log('warn', 'Resend rate limit, pausing before one more try', { expert_id: job.expert_id })
        await deps.sleep(1500)
        result = await deps.send(job)
      }

      if (result.ok) {
        await deps.markSent(job, result.providerId)
        summary.sent++
        deps.log('info', 'Confirmation email sent', { expert_id: job.expert_id, provider_id: result.providerId })
      } else if (result.kind === 'daily_limit' || result.kind === 'config') {
        const code = result.kind === 'daily_limit' ? 'RESEND_DAILY_LIMIT_HIT' : 'RESEND_CONFIG_ERROR'
        deps.log('error', `${code}: stopping. Remaining emails stay queued and will be retried.`, {
          detail: result.message,
          remaining: jobs.length - i,
        })
        // This row and every row claimed after it go back untouched, with no attempt counted.
        const wait = result.kind === 'daily_limit' ? 3600 : 1800
        for (const rest of jobs.slice(i)) {
          await deps.release(rest, result.message, wait)
          summary.released++
        }
        summary.stoppedBecause = result.kind
        return summary
      } else if (result.kind === 'permanent') {
        await deps.markDead(job, result.message)
        summary.dead++
        deps.log('error', 'Email rejected, giving up on this row', { expert_id: job.expert_id, detail: result.message })
      } else if (job.attempts >= deps.maxAttempts) {
        await deps.markDead(job, `${result.message} (gave up after ${job.attempts} attempts)`)
        summary.dead++
        deps.log('error', 'Attempt cap reached, giving up on this row', { expert_id: job.expert_id, detail: result.message })
      } else {
        const wait = backoffSeconds(job.attempts)
        await deps.markRetry(job, result.message, wait)
        summary.retryLater++
        deps.log('warn', 'Email failed, will retry', {
          expert_id: job.expert_id,
          attempt: job.attempts,
          retry_in_seconds: wait,
          detail: result.message,
        })
      }

      if (i < jobs.length - 1) await deps.sleep(deps.spacingMs)
    }
  }
}

/** The JSON body for Resend. A Reply-To header is added only when an address is configured. */
export function buildSendBody(i: { from: string; to: string; subject: string; html: string; text: string; replyTo?: string }) {
  return {
    from: i.from,
    to: [i.to],
    subject: i.subject,
    html: i.html,
    text: i.text,
    ...(i.replyTo ? { reply_to: i.replyTo } : {}),
  }
}
