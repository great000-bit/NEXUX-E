import { isConfigured } from './config'
import { toPayload, type FormData } from './form'

export type RegisterResult =
  | { ok: true; expertId: string }
  | { ok: false; code: string; message: string }

const MESSAGES: Record<string, string> = {
  duplicate_email:
    'This email address is already registered. If this is you, your Expert ID was shown after you registered. Otherwise, use a different email.',
  duplicate_phone:
    'This phone number is already registered. If this is you, your Expert ID was shown after you registered. Otherwise, use a different number.',
  rate_limited: 'Too many attempts from this network. Please wait a few minutes and try again.',
  contact_required: 'Provide at least a phone number or an email address.',
  invalid_email: 'The email address looks incorrect. Please check it and try again.',
  invalid_phone: 'The phone number looks incorrect. Please check it and try again.',
  consent_required: 'Your consent to be contacted is required to register.',
  too_many_secondary: 'Please choose no more than three secondary areas of expertise.',
  invalid: 'Some details could not be accepted. Please review each screen and try again.',
  not_configured: 'Registration is not available yet because the service is not configured.',
  network: 'We could not reach the server. Check your connection and try again. Your answers are saved.',
}

export const messageFor = (code: string) => MESSAGES[code] ?? MESSAGES.invalid

export async function registerExpert(form: FormData): Promise<RegisterResult> {
  if (!isConfigured) return { ok: false, code: 'not_configured', message: MESSAGES.not_configured }
  try {
    // Loaded on demand so the public pages stay light on weak mobile data.
    const { supabase } = await import('./supabase')
    const { data, error } = await supabase.rpc('register_expert', { payload: toPayload(form) })
    if (error) return { ok: false, code: 'network', message: MESSAGES.network }
    const res = data as { ok: boolean; expert_id?: string; error?: string }
    if (res?.ok && res.expert_id) return { ok: true, expertId: res.expert_id }
    const code = res?.error ?? 'invalid'
    return { ok: false, code, message: messageFor(code) }
  } catch {
    return { ok: false, code: 'network', message: MESSAGES.network }
  }
}
