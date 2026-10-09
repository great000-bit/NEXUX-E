import { isConfigured } from './config'
import { rpcCall } from './rest'
import { toPayload, type ErrorKey, type FormData } from './form'

/**
 * A rejection that belongs to one field: show the message under it and send the person there.
 * A service problem has no field: show it as a notice and let them try again.
 */
export type RegisterResult =
  | { ok: true; expertId: string }
  | { ok: false; kind: 'field'; field: ErrorKey; message: string }
  | { ok: false; kind: 'service'; message: string }
  | { ok: false; kind: 'unknown' }

const ALREADY = 'If this is you, your Expert ID was shown after you registered.'

const FIELD_ERRORS: Record<string, { field: ErrorKey; message: string }> = {
  duplicate_email: { field: 'email', message: `This email is already registered. ${ALREADY}` },
  duplicate_phone: { field: 'phone', message: `This phone number is already registered. ${ALREADY}` },
  invalid_email: { field: 'email', message: 'Enter a valid email address, like name@example.com.' },
  invalid_phone: { field: 'phone', message: 'Enter a valid phone number, like 0803 123 4567.' },
  invalid_url: { field: 'profile_url', message: 'Enter a valid link that starts with http or https, or leave it empty.' },
  email_required: { field: 'email', message: 'Enter your email address, like name@example.com. We send your Expert ID there, and you use it to sign in and verify your profile.' },
  consent_required: { field: 'consent_contact', message: 'Please tick this box. We need your consent to contact you before we can register you.' },
  too_many_secondary: { field: 'secondary_expertise', message: 'You can choose up to 3 secondary areas. Please untick some.' },
}

const SERVICE_ERRORS: Record<string, string> = {
  rate_limited: 'Many people are registering from this network right now. Please wait a few minutes, then try again.',
  not_configured: 'Registration is not open yet. Please try again later.',
  unavailable: 'We could not save your registration just now. Please try again in a moment. Your answers are saved.',
  network: 'We could not connect. Please check your internet and try again. Your answers are saved.',
}

/** Tell a real connection problem apart from a server rejection. */
function failure(error: { message?: string; code?: string; status?: number }): RegisterResult {
  console.error('register_expert failed', error.status ?? '', error.code ?? '', error.message ?? '')
  // A real connection failure has no database error code and a fetch style message.
  const offline = !error.code && /fetch|network|load failed|timed? ?out/i.test(error.message ?? '')
  return { ok: false, kind: 'service', message: SERVICE_ERRORS[offline ? 'network' : 'unavailable'] }
}

function fromCode(code: string): RegisterResult {
  const field = FIELD_ERRORS[code]
  if (field) return { ok: false, kind: 'field', ...field }
  if (SERVICE_ERRORS[code]) return { ok: false, kind: 'service', message: SERVICE_ERRORS[code] }
  return { ok: false, kind: 'unknown' }
}

export async function registerExpert(form: FormData): Promise<RegisterResult> {
  if (!isConfigured) return fromCode('not_configured')
  // Plain fetch, not the Supabase client: it needs no extra script, and "Try again" works after a dropped connection.
  const res = await rpcCall('register_expert', { payload: toPayload(form) }, 20000)
  if (!res.ok) return failure(res)
  const data = res.data as { ok: boolean; expert_id?: string; error?: string }
  if (data?.ok && data.expert_id) return { ok: true, expertId: data.expert_id }
  return fromCode(data?.error ?? 'invalid')
}
