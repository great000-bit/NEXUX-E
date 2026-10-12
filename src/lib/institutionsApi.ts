// The one network call for the institution list. Kept apart from institutions.ts so the pure helpers there load anywhere (tests included).
import { isConfigured } from './config'
import { publicRpc } from './rest'
import type { Institution } from './institutions'

export async function fetchInstitutions(): Promise<{ ok: true; items: Institution[] } | { ok: false }> {
  if (!isConfigured) return { ok: false }
  try {
    const res = await publicRpc('public_institutions', {})
    if (!res.ok || !Array.isArray(res.data)) return { ok: false }
    return { ok: true, items: res.data as Institution[] }
  } catch {
    return { ok: false }
  }
}
