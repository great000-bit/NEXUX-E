import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { claimReload, isChunkLoadError, RELOAD_WINDOW_MS } from './lib/chunkReload.ts'

// Deploy safety: one guarded reload after a failed script load, and an error screen instead of a blank page.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8').split('\r\n').join('\n')

const memoryStore = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
}

test('the errors a browser raises for a missing script or style file are recognised', () => {
  for (const msg of [
    'Failed to fetch dynamically imported module: https://register.nexuse.org/assets/Home-abc.js',
    'error loading dynamically imported module',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/Home-abc.css',
    'Loading chunk 12 failed.',
  ]) assert.ok(isChunkLoadError(new TypeError(msg)), msg)
  const named = new Error('x')
  named.name = 'ChunkLoadError'
  assert.ok(isChunkLoadError(named))
  assert.ok(!isChunkLoadError(new Error('Cannot read properties of undefined')))
  assert.ok(!isChunkLoadError(null))
})

test('the reload is allowed once, then refused inside the window, so it can never loop', () => {
  const store = memoryStore()
  const t0 = 1_000_000
  assert.equal(claimReload(store, t0), true, 'the first failure reloads')
  assert.equal(claimReload(store, t0 + 1), false, 'the failure after the reload does not')
  assert.equal(claimReload(store, t0 + RELOAD_WINDOW_MS - 1), false)
  assert.equal(claimReload(store, t0 + RELOAD_WINDOW_MS), true, 'a much later deploy can reload again')
})

test('without usable storage there is no automatic reload (it could not be proven safe)', () => {
  assert.equal(claimReload(null), false)
  const broken = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } }
  assert.equal(claimReload(broken), false)
})

test('the app listens for vite:preloadError and wraps everything in the error boundary', () => {
  const main = read('src/main.tsx')
  assert.match(main, /addEventListener\('vite:preloadError'/)
  assert.match(main, /reloadOnce\(\)/)
  assert.match(main, /navigator\.onLine === false\) return/, 'no reload while offline: it would replace the page with the browser offline screen')
  assert.match(main, /<ErrorBoundary>[\s\S]*<BrowserRouter>[\s\S]*<App \/>[\s\S]*<\/BrowserRouter>[\s\S]*<\/ErrorBoundary>/)
})

test('the error boundary shows a message with a Reload action, and retries a failed script load once', () => {
  const eb = read('src/components/ErrorBoundary.tsx')
  assert.match(eb, /getDerivedStateFromError/)
  assert.match(eb, /role="alert"/)
  assert.match(eb, />Reload</)
  assert.match(eb, /window\.location\.reload\(\)/)
  assert.match(eb, /isChunkLoadError\(error\)\) reloadOnce\(\)/)
  assert.match(eb, /Anything you typed into the registration form is kept/)
})

test('the registration form keeps its progress in sessionStorage, inside try/catch, and shows a retry on server errors', () => {
  const reg = read('src/pages/Register.tsx')
  assert.match(reg, /sessionStorage\.setItem\(STORAGE_KEY/)
  assert.match(reg, /try \{\n\s+sessionStorage\.setItem\(STORAGE_KEY/)
  assert.match(reg, /We could not finish your registration/)
  assert.match(reg, /service \? 'Try again'/)
})
