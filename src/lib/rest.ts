// A very small client for the public database functions, using plain fetch.
// The directory and the profile pages only ever call two public functions, so they do not need the whole
// Supabase client (about 55 KB of script). Leaving it out makes those pages load and show results sooner.
import { SUPABASE_ANON_KEY, SUPABASE_URL } from './config'

export type RpcResult = { ok: true; data: unknown } | { ok: false }

/** Calls a public database function. Never throws: any failure, timeout or bad status is { ok: false }. */
export async function publicRpc(name: string, args: Record<string, unknown>, timeoutMs = 12000): Promise<RpcResult> {
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      signal: ctl.signal,
    })
    if (!res.ok) return { ok: false }
    return { ok: true, data: await res.json() }
  } catch {
    return { ok: false }
  } finally {
    window.clearTimeout(timer)
  }
}
