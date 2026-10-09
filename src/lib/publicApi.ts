// A very small client for the public directory, used by the home page teaser.
// It talks to the same database function as the directory page, but with plain fetch, so the home page
// does not have to download the whole Supabase client just to show three cards.
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './config'

export type ListedPreview = { expert_id: string; title: string; full_name: string; position: string; organisation: string; country?: string; state: string; primary_expertise: string }

export async function fetchListedPreview(limit = 3, timeoutMs = 7000): Promise<{ ok: true; total: number; items: ListedPreview[] } | { ok: false }> {
  if (!isConfigured) return { ok: false }
  const ctl = new AbortController()
  const timer = window.setTimeout(() => ctl.abort(), timeoutMs)
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/directory_search`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON_KEY ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_limit: limit, p_sort: 'newest' }),
      signal: ctl.signal,
    })
    if (!res.ok) return { ok: false }
    const data = (await res.json()) as { total?: number; items?: ListedPreview[] }
    return { ok: true, total: Number(data.total) || 0, items: Array.isArray(data.items) ? data.items.slice(0, limit) : [] }
  } catch {
    return { ok: false }
  } finally {
    window.clearTimeout(timer)
  }
}
