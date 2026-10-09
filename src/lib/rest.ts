// A very small client for the public database functions, using plain fetch.
// The directory, the profile and the registration form only ever call public functions, so they do not need the
// whole Supabase client (about 55 KB of script). Leaving it out makes those pages load and answer sooner, and it
// means a dropped connection can simply be retried: a script file that failed to load once is remembered as failed
// by the browser until the page is reloaded, but a plain request is made again every time.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export type RpcFailure = { ok: false; status: number; code?: string; message: string }
export type RpcCall = { ok: true; data: unknown } | RpcFailure

/**
 * Calls a public database function and says exactly what happened. Never throws.
 * status 0 means the request never got an answer (offline, blocked, or too slow).
 */
export async function rpcCall(name: string, args: Record<string, unknown>, timeoutMs = 12000): Promise<RpcCall> {
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctl.signal,
    })
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | unknown
    if (!res.ok) {
      const b = (body ?? {}) as { code?: string; message?: string }
      return { ok: false, status: res.status, code: b.code, message: b.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, data: body }
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof DOMException && e.name === 'AbortError' ? 'request timed out' : 'Failed to fetch' }
  } finally {
    window.clearTimeout(timer)
  }
}

/** The address of a read-only function call. The page's early request (see vite.config.ts) builds the very same address. */
export function rpcGetUrl(base: string, key: string, name: string, args: Record<string, string | number | null | undefined>): string {
  const q = new URLSearchParams({ apikey: key })
  for (const [k, v] of Object.entries(args)) if (v !== null && v !== undefined) q.set(k, String(v))
  return `${base}/rest/v1/rpc/${name}?${q.toString()}`
}

/**
 * Calls a read-only (stable) public function with a plain GET. The public key goes in the address, and there are no custom
 * headers, so the browser makes no CORS preflight request: one round trip instead of two. Only for the two directory
 * functions, which are declared stable in the database; anything that writes uses rpcCall (POST).
 */
export async function rpcGet(name: string, args: Record<string, string | number | null | undefined>, timeoutMs = 12000): Promise<RpcCall> {
  const url = rpcGetUrl(SUPABASE_URL ?? '', SUPABASE_ANON_KEY ?? '', name, args)
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { method: 'GET', signal: ctl.signal })
    const body = (await res.json().catch(() => null)) as { code?: string; message?: string } | unknown
    if (!res.ok) {
      const b = (body ?? {}) as { code?: string; message?: string }
      return { ok: false, status: res.status, code: b.code, message: b.message ?? `HTTP ${res.status}` }
    }
    return { ok: true, data: body }
  } catch (e) {
    return { ok: false, status: 0, message: e instanceof DOMException && e.name === 'AbortError' ? 'request timed out' : 'Failed to fetch' }
  } finally {
    window.clearTimeout(timer)
  }
}

export type RpcResult = { ok: true; data: unknown } | { ok: false }

/** The simple form for the read-only directory functions: success with data, or just { ok: false }. */
export async function publicRpc(name: string, args: Record<string, string | number | null | undefined>, timeoutMs = 12000): Promise<RpcResult> {
  const res = await rpcGet(name, args, timeoutMs)
  return res.ok ? { ok: true, data: res.data } : { ok: false }
}
