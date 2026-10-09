import { isConfigured } from './config'
import { rpcCall } from './rest'
import { toPayload, type ErrorKey, type FormData } from './form'
import { messages } from '../i18n'

/**
 * A rejection that belongs to one field: show the message under it and send the person there.
 * A service problem has no field: show it as a notice and let them try again.
 */
export type RegisterResult =
  | { ok: true; expertId: string }
  | { ok: false; kind: 'field'; field: ErrorKey; message: string }
  | { ok: false; kind: 'service'; message: string }
  | { ok: false; kind: 'unknown' }

/** What the database says, as a field and a sentence in the language now shown. */
function fieldError(code: string, country: string): { field: ErrorKey; message: string } | null {
  const e = messages().apiErrors
  const v = messages().validation
  switch (code) {
    case 'duplicate_email': return { field: 'email', message: `${e.duplicateEmail} ${e.alreadyRegistered}` }
    case 'duplicate_phone': return { field: 'phone', message: `${e.duplicatePhone} ${e.alreadyRegistered}` }
    case 'invalid_email': return { field: 'email', message: e.invalidEmail }
    case 'invalid_phone': return { field: 'phone', message: country === 'Nigeria' ? e.invalidPhoneNigeria : e.invalidPhoneIntl }
    case 'invalid_url': return { field: 'profile_url', message: e.invalidUrl }
    case 'invalid_country': return { field: 'country', message: e.invalidCountry }
    case 'email_required': return { field: 'email', message: v.emailRequired }
    case 'consent_required': return { field: 'consent_contact', message: v.consent }
    case 'too_many_secondary': return { field: 'secondary_expertise', message: e.tooManySecondary }
    default: return null
  }
}

function serviceError(code: string): string | null {
  const e = messages().apiErrors
  switch (code) {
    case 'rate_limited': return e.rateLimited
    case 'not_configured': return e.notConfigured
    case 'unavailable': return e.unavailable
    case 'network': return e.network
    default: return null
  }
}

/** Tell a real connection problem apart from a server rejection. */
function failure(error: { message?: string; code?: string; status?: number }): RegisterResult {
  console.error('register_expert failed', error.status ?? '', error.code ?? '', error.message ?? '')
  // A real connection failure has no database error code and a fetch style message.
  const offline = !error.code && /fetch|network|load failed|timed? ?out/i.test(error.message ?? '')
  return { ok: false, kind: 'service', message: serviceError(offline ? 'network' : 'unavailable')! }
}

function fromCode(code: string, country: string): RegisterResult {
  const field = fieldError(code, country)
  if (field) return { ok: false, kind: 'field', ...field }
  const service = serviceError(code)
  if (service) return { ok: false, kind: 'service', message: service }
  return { ok: false, kind: 'unknown' }
}

export async function registerExpert(form: FormData): Promise<RegisterResult> {
  if (!isConfigured) return fromCode('not_configured', form.country)
  // Plain fetch, not the Supabase client: it needs no extra script, and "Try again" works after a dropped connection.
  const res = await rpcCall('register_expert', { payload: toPayload(form) }, 20000)
  if (!res.ok) return failure(res)
  const data = res.data as { ok: boolean; expert_id?: string; error?: string }
  if (data?.ok && data.expert_id) return { ok: true, expertId: data.expert_id }
  return fromCode(data?.error ?? 'invalid', form.country)
}
