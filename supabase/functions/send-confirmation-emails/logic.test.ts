import { test } from 'node:test'
import assert from 'node:assert/strict'
import { backoffSeconds, classifyResendError, processOutbox, type Deps, type OutboxJob, type SendResult } from './logic.ts'
import { buildEmail, greetingName, SUBJECT } from './email.ts'

type Row = OutboxJob & { status: string; error?: string; providerId?: string; waiting?: boolean }

/** A tiny in-memory outbox that follows the same rules as claim_outbox_emails. */
function makeWorld(rows: Row[], sendImpl: (job: OutboxJob) => SendResult, maxAttempts = 5) {
  const sent: string[] = []
  const logs: { level: string; message: string }[] = []
  let sleeps = 0
  const deps: Deps = {
    maxAttempts,
    batchSize: 2,
    spacingMs: 0,
    budgetMs: 60_000,
    now: () => Date.now(),
    sleep: async () => {
      sleeps++
    },
    log: (level, message) => logs.push({ level, message }),
    async claim(limit) {
      const due = rows.filter((r) => ['pending', 'failed'].includes(r.status) && !r.waiting && r.attempts < maxAttempts).slice(0, limit)
      for (const r of due) {
        r.status = 'sending'
        r.attempts += 1
      }
      return due.map((r) => ({ ...r }))
    },
    async send(job) {
      const result = sendImpl(job)
      if (result.ok) sent.push(job.expert_id)
      return result
    },
    async markSent(job, providerId) {
      Object.assign(rows.find((r) => r.id === job.id)!, { status: 'sent', providerId })
    },
    async markRetry(job, error) {
      Object.assign(rows.find((r) => r.id === job.id)!, { status: 'failed', error, waiting: true })
    },
    async markDead(job, error) {
      Object.assign(rows.find((r) => r.id === job.id)!, { status: 'dead', error })
    },
    async release(job, reason) {
      const r = rows.find((x) => x.id === job.id)!
      Object.assign(r, { status: 'pending', attempts: job.attempts - 1, error: reason, waiting: true })
    },
  }
  /** Pretend the retry delays have passed. */
  const advance = () => rows.forEach((r) => (r.waiting = false))
  return { deps, sent, logs, sleeps: () => sleeps, advance }
}

const row = (id: number, expert_id: string): Row => ({
  id, expert_id, to_email: `p${id}@example.org`, full_name: 'Ada Obi', title: 'Dr', attempts: 0, status: 'pending',
})

test('sends every pending row once and marks it sent', async () => {
  const rows = [row(1, 'NEX-000001'), row(2, 'NEX-000002'), row(3, 'NEX-000003')]
  const w = makeWorld(rows, (j) => ({ ok: true, providerId: `id-${j.id}` }))
  const s = await processOutbox(w.deps)
  assert.deepEqual(w.sent, ['NEX-000001', 'NEX-000002', 'NEX-000003'])
  assert.equal(s.sent, 3)
  assert.ok(rows.every((r) => r.status === 'sent'))
  // A second run finds nothing, so nothing is sent twice.
  const again = await processOutbox(w.deps)
  assert.equal(again.claimed, 0)
  assert.equal(w.sent.length, 3)
})

test('a permanent rejection kills that row only', async () => {
  const rows = [row(1, 'NEX-000001'), row(2, 'NEX-000002')]
  const w = makeWorld(rows, (j) =>
    j.id === 1 ? { ok: false, kind: 'permanent', message: 'Resend 422 validation_error: bad address' } : { ok: true, providerId: 'x' },
  )
  const s = await processOutbox(w.deps)
  assert.equal(rows[0].status, 'dead')
  assert.equal(rows[1].status, 'sent')
  assert.equal(s.dead, 1)
})

test('a failing row can never loop forever: it dies at the attempt cap', async () => {
  const rows = [row(1, 'NEX-000001')]
  let calls = 0
  const w = makeWorld(rows, () => {
    calls++
    return { ok: false, kind: 'temporary', message: 'Resend 500' }
  })
  for (let run = 0; run < 12; run++) {
    await processOutbox(w.deps)
    w.advance() // the retry delay has passed, so the next run may pick it up again
  }
  assert.equal(calls, 5)
  assert.equal(rows[0].status, 'dead')
  assert.match(rows[0].error ?? '', /gave up after 5 attempts/)
})

test('a temporary failure schedules a retry with backoff', async () => {
  const rows = [row(1, 'NEX-000001')]
  const w = makeWorld(rows, () => ({ ok: false, kind: 'temporary', message: 'Resend 503' }))
  await processOutbox(w.deps)
  assert.equal(rows[0].status, 'failed')
  assert.equal(rows[0].attempts, 1)
  assert.deepEqual([1, 2, 3, 4, 5, 6].map(backoffSeconds), [300, 1200, 4800, 19200, 21600, 21600])
})

test('daily limit: stops at once, logs clearly, releases the row and the rest without counting attempts', async () => {
  const rows = [row(1, 'NEX-000001'), row(2, 'NEX-000002'), row(3, 'NEX-000003')]
  let calls = 0
  const w = makeWorld(rows, () => {
    calls++
    return calls === 1
      ? { ok: true, providerId: 'x' }
      : { ok: false, kind: 'daily_limit', message: 'Resend 429 daily_quota_exceeded' }
  })
  const s = await processOutbox(w.deps)
  assert.equal(s.stoppedBecause, 'daily_limit')
  assert.equal(rows[0].status, 'sent')
  assert.equal(rows[1].status, 'pending')
  assert.equal(rows[1].attempts, 0)
  assert.equal(rows[2].status, 'pending')
  assert.equal(rows[2].attempts, 0)
  assert.ok(w.logs.some((l) => l.level === 'error' && l.message.includes('RESEND_DAILY_LIMIT_HIT')))
  assert.equal(calls, 2, 'no further sends after the limit is hit')
})

test('a bad API key or unverified domain stops the run and keeps the rows', async () => {
  const rows = [row(1, 'NEX-000001'), row(2, 'NEX-000002')]
  const w = makeWorld(rows, () => ({ ok: false, kind: 'config', message: 'Resend 403 validation_error: domain not verified' }))
  const s = await processOutbox(w.deps)
  assert.equal(s.stoppedBecause, 'config')
  assert.ok(rows.every((r) => r.status === 'pending' && r.attempts === 0))
  assert.ok(w.logs.some((l) => l.message.includes('RESEND_CONFIG_ERROR')))
})

test('a per-second rate limit pauses and retries the same row once', async () => {
  const rows = [row(1, 'NEX-000001')]
  let calls = 0
  const w = makeWorld(rows, () => {
    calls++
    return calls === 1 ? { ok: false, kind: 'rate_limit', message: 'Resend 429' } : { ok: true, providerId: 'x' }
  })
  await processOutbox(w.deps)
  assert.equal(rows[0].status, 'sent')
  assert.equal(calls, 2)
  assert.ok(w.sleeps() >= 1)
})

test('Resend errors are classified correctly', () => {
  assert.equal(classifyResendError(429, { name: 'daily_quota_exceeded', message: 'You have reached your daily email sending quota.' }).kind, 'daily_limit')
  assert.equal(classifyResendError(429, { name: 'rate_limit_exceeded', message: 'Too many requests per second.' }).kind, 'rate_limit')
  assert.equal(classifyResendError(401, { name: 'missing_api_key' }).kind, 'config')
  assert.equal(classifyResendError(403, { name: 'validation_error', message: 'The nexuse.org domain is not verified.' }).kind, 'config')
  assert.equal(classifyResendError(422, { name: 'validation_error', message: 'Invalid `to` field.' }).kind, 'permanent')
  assert.equal(classifyResendError(500, null).kind, 'temporary')
  assert.equal(classifyResendError(409, { name: 'concurrent_idempotent_requests' }).kind, 'temporary')
})

test('email: subject, expert id, name, link, brand colours and no dashes', () => {
  const mail = buildEmail({ expert_id: 'NEX-000247', full_name: 'Ada Obi', title: 'Dr' }, { siteUrl: 'https://register.nexuse.org' })
  assert.equal(mail.subject, 'You are registered: your NEXUS-E Expert ID')
  assert.equal(mail.subject, SUBJECT)
  for (const part of [mail.text, mail.html]) {
    assert.ok(part.includes('NEX-000247'))
    assert.ok(part.includes('Dear Dr Ada Obi,'))
    assert.ok(part.includes('https://register.nexuse.org'))
    assert.ok(part.includes('founding expert'))
    assert.ok(part.includes('after the conference'.charAt(0).toUpperCase() + 'fter the conference') || part.includes('After the conference'))
    assert.ok(!new RegExp(`[${String.fromCharCode(0x2014, 0x2013)}]`).test(part), 'no em or en dashes')
  }
  assert.ok(mail.html.includes('#06361e') && mail.html.includes('#c5dc3f'))
})

test('email: escapes markup in names and handles titles sensibly', () => {
  const mail = buildEmail({ expert_id: 'NEX-000001', full_name: '<b>Eve</b> & "Co"', title: 'Other' }, { siteUrl: 'https://register.nexuse.org/' })
  assert.ok(!mail.html.includes('<b>Eve</b>'))
  assert.ok(mail.html.includes('&lt;b&gt;Eve&lt;/b&gt; &amp; &quot;Co&quot;'))
  assert.equal(greetingName('Dr', 'Dr Ada Obi'), 'Dr Ada Obi')
  assert.equal(greetingName('Prof', 'Okon Bassey'), 'Prof Okon Bassey')
  assert.equal(greetingName('Other', 'Okon Bassey'), 'Okon Bassey')
})
