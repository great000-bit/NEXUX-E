import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './config'
import { currentLocale, messages } from '../i18n'

// Client for the expert-portal Edge Function. Experts have no database login: they hold a short
// lived session token that the function checks on every call.

const ENDPOINT = `${SUPABASE_URL ?? ''}/functions/v1/expert-portal`
const SESSION_KEY = 'nexus-e:portal-session'

export type PortalError = { ok: false; error: string; message: string }
export type PortalOk<T> = { ok: true } & T
export type PortalResult<T> = PortalOk<T> | PortalError

export type Session = { token: string; expiresAt: string }

export function getSession(): Session | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as Session
    if (!s.token || new Date(s.expiresAt).getTime() <= Date.now()) {
      sessionStorage.removeItem(SESSION_KEY)
      return null
    }
    return s
  } catch {
    return null
  }
}

export function saveSession(s: Session) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
  } catch {
    /* private mode: the session simply will not survive a refresh */
  }
}

export function clearSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY)
  } catch {
    /* ignore */
  }
}

const network = (): PortalError => ({ ok: false, error: 'network', message: messages().portal.network })

/** The server answers in English with a code. In another language the code is looked up and the sentence replaced. */
function localised<T>(data: PortalResult<T>): PortalResult<T> {
  if (data.ok || currentLocale() === 'en') return data
  const known = (messages().portal.errors as Record<string, string>)[data.error]
  return known ? { ...data, message: known } : data
}

export async function call<T = Record<string, never>>(
  action: string,
  body: Record<string, unknown> = {},
  token?: string,
): Promise<PortalResult<T>> {
  if (!isConfigured) {
    return { ok: false, error: 'not_configured', message: messages().portal.notConfigured }
  }
  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { 'x-portal-session': token } : {}) },
      body: JSON.stringify({ action, ...body }),
    })
    const data = (await res.json().catch(() => null)) as PortalResult<T> | null
    if (!data) return { ok: false, error: 'server_error', message: messages().portal.serverError }
    return localised(data)
  } catch {
    return network()
  }
}

/** Uploads straight to private storage with a one-time signed URL, reporting progress. */
export function uploadToSignedUrl(
  url: string,
  file: File,
  mime: string,
  onProgress: (fraction: number) => void,
): Promise<{ ok: true } | PortalError> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('apikey', SUPABASE_ANON_KEY ?? '')
    xhr.setRequestHeader('Authorization', `Bearer ${SUPABASE_ANON_KEY ?? ''}`)
    xhr.setRequestHeader('x-upsert', 'false')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded / e.total)
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve({ ok: true })
        : resolve({ ok: false, error: 'upload_failed', message: messages().portal.uploadFailed })
    xhr.onerror = () => resolve(network())
    xhr.ontimeout = () => resolve(network())
    xhr.timeout = 120_000
    const form = new FormData()
    form.append('cacheControl', '3600')
    form.append('', new Blob([file], { type: mime }))
    xhr.send(form)
  })
}

export type ExpertRecord = {
  expert_id: string
  full_name: string
  title: string
  organisation: string
  position: string
  country?: string
  state: string
  email: string | null
  phone: string | null
  primary_expertise: string
  secondary_expertise: string[]
  years_experience: string
  qualification: string
  memberships: string[]
  nes_number: string | null
  iepn_status: string | null
  availability: string
  discoverable: boolean
  verification_status: string
  verified_at: string | null
  review_message: string | null
  submitted_at: string | null
  created_at: string
}

export type EvidenceFile = {
  id: string
  kind: string
  label: string | null
  original_name: string
  size_bytes: number | null
  content_type: string | null
  created_at: string
}

export type MeResponse = { expert: ExpertRecord; consented: boolean; editable: boolean; files: EvidenceFile[] }
