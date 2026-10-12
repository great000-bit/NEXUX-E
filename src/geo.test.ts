import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
// @ts-expect-error -- a plain JavaScript Vercel Function, which has no type declarations
import handler from '../api/geo.js'

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

type Out = { status: number; headers: Record<string, string>; body: string | undefined }
function call(method: string, headers: Record<string, string | string[]> = {}): Out {
  const out: Out = { status: 0, headers: {}, body: undefined }
  const res = {
    statusCode: 200,
    setHeader(k: string, v: string) { out.headers[k.toLowerCase()] = v },
    end(body?: string) { out.status = this.statusCode; out.body = body },
  }
  handler({ method, headers }, res)
  return out
}

test('the geo function returns only the country, never stores it, and is not cached', () => {
  const r = call('GET', { 'x-vercel-ip-country': 'EG' })
  assert.equal(r.status, 200)
  assert.deepEqual(JSON.parse(r.body ?? ''), { country: 'EG' })
  assert.deepEqual(Object.keys(JSON.parse(r.body ?? '')), ['country'])
  assert.equal(r.headers['cache-control'], 'no-store')
  assert.match(r.headers['content-type'], /application\/json/)
})

test('a missing, odd or repeated header gives null or a clean code, and other methods are refused', () => {
  assert.deepEqual(JSON.parse(call('GET').body ?? ''), { country: null })
  assert.deepEqual(JSON.parse(call('GET', { 'x-vercel-ip-country': 'sn' }).body ?? ''), { country: 'SN' })
  assert.deepEqual(JSON.parse(call('GET', { 'x-vercel-ip-country': ['MZ', 'ZA'] }).body ?? ''), { country: 'MZ' })
  for (const bad of ['', 'EGY', '1', '<script>', 'E G']) assert.deepEqual(JSON.parse(call('GET', { 'x-vercel-ip-country': bad }).body ?? ''), { country: null }, bad)
  assert.equal(call('POST', { 'x-vercel-ip-country': 'EG' }).status, 405)
  assert.equal(call('HEAD', { 'x-vercel-ip-country': 'EG' }).body, undefined)
})

test('the function never reads, logs or stores an IP address', () => {
  const src = read('api/geo.js')
  assert.doesNotMatch(src, /x-forwarded-for|x-real-ip|socket|remoteAddress|console\.|fetch\(|localStorage|process\.env/i)
  assert.match(src, /x-vercel-ip-country/)
})

test('the single page app rewrite does not catch /api, and /api is not given the app page', () => {
  const cfg = JSON.parse(read('vercel.json')) as { rewrites: { source: string; destination: string }[] }
  const spa = cfg.rewrites.find((r) => r.destination === '/index.html')!
  const re = new RegExp(`^${spa.source}$`)
  assert.ok(!re.test('/api/geo'), '/api/geo is not rewritten')
  assert.ok(!re.test('/api/anything/else'))
  for (const p of ['/', '/register', '/experts/NEX-000001', '/verify/dashboard', '/apiary']) assert.ok(re.test(p), p)
})

// ---- the browser side: asked once, cached for the session, never holds the page up
type Store = Record<string, string>
function setup(fetchImpl: (url: string, init?: { signal?: AbortSignal }) => Promise<unknown>) {
  const session: Store = {}
  let fetches = 0
  const g = globalThis as unknown as Record<string, unknown>
  g.window = globalThis
  g.sessionStorage = {
    getItem: (k: string) => (k in session ? session[k] : null),
    setItem: (k: string, v: string) => { session[k] = v },
  }
  g.fetch = (url: string, init?: { signal?: AbortSignal }) => { fetches += 1; return fetchImpl(url, init) }
  return { session, count: () => fetches }
}
const ok = (body: unknown, status = 200) => Promise.resolve({ ok: status < 300, status, json: async () => body })

test('the page asks once per session, and uses the kept answer afterwards', async () => {
  const { fetchCountry } = await import('./i18n/geo.ts')
  const env = setup(() => ok({ country: 'sn' }))
  assert.equal(await fetchCountry(), 'SN')
  assert.equal(await fetchCountry(), 'SN')
  assert.equal(env.count(), 1)
  assert.equal(env.session['nexus-e:geo'], 'SN')
})

test('a failure, an odd answer, or a slow answer all mean English, silently, and are not retried this session', async () => {
  const { fetchCountry } = await import('./i18n/geo.ts')
  for (const impl of [
    () => Promise.reject(new Error('offline')),
    () => ok({ country: 'not a code' }),
    () => ok({}, 500),
    () => Promise.resolve({ ok: true, json: async () => { throw new Error('not json') } }),
  ]) {
    const env = setup(impl)
    assert.equal(await fetchCountry(), null)
    assert.equal(await fetchCountry(), null)
    assert.equal(env.count(), 1, 'asked once even though it failed')
  }
  const slow = setup((_url, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))))
  const started = Date.now()
  assert.equal(await fetchCountry(30), null)
  assert.ok(Date.now() - started < 1000, 'gave up quickly')
  assert.equal(slow.count(), 1)
})

test('blocked storage does not break detection', async () => {
  const { fetchCountry } = await import('./i18n/geo.ts')
  const g = globalThis as unknown as Record<string, unknown>
  g.window = globalThis
  g.sessionStorage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  g.fetch = () => ok({ country: 'MZ' })
  assert.equal(await fetchCountry(), 'MZ')
})
