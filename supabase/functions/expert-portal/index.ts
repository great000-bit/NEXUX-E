// Supabase Edge Function: the expert portal.
//
// Experts sign in with a one-time code sent to the email they registered with. They never receive a
// database role: this function checks the session on every call and only ever touches that expert's own
// record and files. Nothing that identifies a file (path, signed URL) is written to logs.
import { createClient } from 'npm:@supabase/supabase-js@2'
import { checkFile, extensionOf, MAX_BYTES } from './filecheck.ts'
import { codeHash, ipHash, isPlausibleEmail, normaliseEmail, randomCode, randomHex, sha256Hex } from './hash.ts'
import { buildCodeEmail, buildSendBody } from './mail.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined

const BUCKET = 'expert-evidence'
const SESSION_MINUTES = 120
const KINDS = ['membership', 'licence', 'qualification', 'cv']
const SAME_ANSWER =
  'If that email address is registered with NEXUS-E, we have sent a 6 digit code to it. The code works once and expires in 10 minutes.'

const env = (name: string, fallback = ''): string => Deno.env.get(name) ?? fallback

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

// Secrets come from the function environment or Supabase Vault. They are cached for the life of the isolate.
const secretCache = new Map<string, string>()
async function secret(envName: string, vaultName: string): Promise<string> {
  const fromEnv = env(envName)
  if (fromEnv) return fromEnv
  const hit = secretCache.get(vaultName)
  if (hit) return hit
  const { data } = await db.rpc('get_function_secret', { p_name: vaultName })
  const value = typeof data === 'string' ? data : ''
  if (value) secretCache.set(vaultName, value)
  return value
}

// What each database error means to a person.
const FRIENDLY: Record<string, [number, string]> = {
  file_limit: [409, 'You can keep up to 8 files. Please delete one before adding another.'],
  locked: [409, 'Your evidence has been submitted and is locked while we review it.'],
  consent_required: [409, 'Please agree to the privacy notice before you upload anything.'],
  bad_label: [400, 'Choose which professional body this membership document is from.'],
  no_evidence: [
    409,
    'Please add at least one document before you submit: a membership card or certificate, a licence, or a qualification certificate.',
  ],
  not_found: [404, 'We could not find that file. Please refresh the page and try again.'],
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  const configured = env('ALLOWED_ORIGINS', 'https://register.nexuse.org').split(',').map((s) => s.trim())
  if (configured.includes(origin)) return origin
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin
  return null
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get('origin'))
  const cors: Record<string, string> = {
    'Access-Control-Allow-Headers': 'content-type, x-portal-session',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  }
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })
  const fail = (status: number, error: string, message: string) => respond(status, { ok: false, error, message })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return fail(405, 'method_not_allowed', 'This address only accepts POST requests.')

  let body: Record<string, unknown>
  try {
    const raw = await req.text()
    if (raw.length > 20_000) return fail(413, 'too_big', 'That request was too large.')
    body = JSON.parse(raw)
  } catch {
    return fail(400, 'bad_request', 'That request could not be read.')
  }

  const pepper = await secret('PORTAL_PEPPER', 'portal_pepper')
  if (!pepper) {
    console.error('portal_pepper is not set')
    return fail(500, 'not_configured', 'The verification service is not available yet.')
  }

  const ip =
    (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || req.headers.get('cf-connecting-ip') || 'unknown'
  const action = String(body.action ?? '')

  try {
    // ---------- Sign in ----------
    if (action === 'request_code') {
      const email = normaliseEmail(String(body.email ?? ''))
      // Same answer for every address, valid or not, registered or not.
      if (!isPlausibleEmail(email)) return respond(200, { ok: true, message: SAME_ANSWER })

      const code = randomCode()
      const { data, error } = await db.rpc('portal_request_code', {
        p_email: email,
        p_ip_hash: await ipHash(pepper, ip),
        p_code_hash: await codeHash(pepper, email, code),
        p_daily_cap: Number.parseInt(env('PORTAL_DAILY_CODE_CAP', '40'), 10) || 40,
      })
      if (error) console.error('portal_request_code failed', error.code ?? '')
      const row = Array.isArray(data) ? data[0] : data
      if (row?.r_should_send) {
        const mail = buildCodeEmail({ title: row.r_title, fullName: row.r_full_name, code })
        const send = sendCodeEmail(row.r_email, mail)
        // Send in the background so the response time is the same for every address.
        if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(send)
        else await send
      }
      return respond(200, { ok: true, message: SAME_ANSWER })
    }

    if (action === 'verify_code') {
      const email = normaliseEmail(String(body.email ?? ''))
      const code = String(body.code ?? '').replace(/\s+/g, '')
      const wrong = () => fail(401, 'invalid_code', 'That code is not right, or it has expired. Please check it or ask for a new one.')
      if (!isPlausibleEmail(email) || !/^\d{6}$/.test(code)) return wrong()

      const token = randomHex(32)
      const { data, error } = await db.rpc('portal_verify_code', {
        p_email: email,
        p_code_hash: await codeHash(pepper, email, code),
        p_ip_hash: await ipHash(pepper, ip),
        p_session_hash: await sha256Hex(token),
        p_session_minutes: SESSION_MINUTES,
      })
      if (error) console.error('portal_verify_code failed', error.code ?? '')
      const row = Array.isArray(data) ? data[0] : data
      if (!row?.r_expert_id) return wrong()
      return respond(200, { ok: true, token, expires_at: row.r_expires_at })
    }

    // ---------- Everything below needs a valid session ----------
    const token = req.headers.get('x-portal-session') ?? ''
    const { data: expertId } = token.length === 64 ? await db.rpc('portal_session', { p_token_hash: await sha256Hex(token) }) : { data: null }
    if (typeof expertId !== 'string' || !expertId) {
      return fail(401, 'session_expired', 'Your session has ended. Please sign in again.')
    }

    const rpc = async (name: string, args: Record<string, unknown>) => {
      const { data, error } = await db.rpc(name, args)
      if (error) {
        const known = FRIENDLY[error.message]
        if (known) throw new PortalError(known[0], error.message, known[1])
        console.error(`${name} failed`, error.code ?? '')
        throw new PortalError(500, 'server_error', 'Something went wrong on our side. Please try again in a moment.')
      }
      return data
    }

    if (action === 'sign_out') {
      await rpc('portal_sign_out', { p_token_hash: await sha256Hex(token) })
      return respond(200, { ok: true })
    }

    if (action === 'me') {
      const { data: e } = await db
        .from('experts')
        .select(
          'expert_id, full_name, title, organisation, position, state, email, phone, primary_expertise, secondary_expertise, years_experience, qualification, memberships, nes_number, iepn_status, availability, discoverable, verification_status, verified_at, review_message, submitted_at, evidence_consent_at, created_at',
        )
        .eq('expert_id', expertId)
        .maybeSingle()
      if (!e) return fail(404, 'not_found', 'We could not find your record.')
      const { data: files } = await db
        .from('expert_files')
        .select('id, kind, label, original_name, size_bytes, content_type, created_at')
        .eq('expert_id', expertId)
        .eq('state', 'ready')
        .order('created_at')
      return respond(200, {
        ok: true,
        expert: { ...e, evidence_consent_at: undefined },
        consented: Boolean(e.evidence_consent_at),
        editable: e.verification_status === 'pending' || e.verification_status === 'more_evidence',
        files: files ?? [],
      })
    }

    if (action === 'consent') {
      await rpc('portal_record_consent', { p_expert_id: expertId })
      return respond(200, { ok: true })
    }

    if (action === 'upload_url') {
      const kind = String(body.kind ?? '')
      const filename = String(body.filename ?? 'file')
      const size = Number(body.size ?? 0)
      if (!KINDS.includes(kind)) return fail(400, 'bad_kind', 'Choose which document you are adding.')
      if (!Number.isFinite(size) || size <= 0) return fail(400, 'empty', 'This file is empty. Please choose the file again.')
      if (size > MAX_BYTES) return fail(413, 'too_large', 'This file is larger than 5 MB. Please choose a smaller one, or a lower resolution scan.')
      const ext = extensionOf(filename)
      if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) {
        return fail(400, 'bad_type', 'Please choose a PDF, JPG or PNG file.')
      }

      // Tidy up uploads that were never finished.
      const stale = await rpc('system_expire_stale_uploads', {})
      if (Array.isArray(stale) && stale.length) await db.storage.from(BUCKET).remove(stale as string[])

      const { data: owner } = await db.from('experts').select('id').eq('expert_id', expertId).maybeSingle()
      if (!owner) return fail(404, 'not_found', 'We could not find your record.')
      // Unguessable path: a random folder per expert (not the Expert ID) and a random file name.
      const path = `experts/${owner.id}/${randomHex(24)}.${ext === 'jpeg' ? 'jpg' : ext}`
      const fileId = await rpc('portal_add_file', {
        p_expert_id: expertId,
        p_kind: kind,
        p_label: body.label ?? null,
        p_original_name: filename,
        p_path: path,
      })
      const { data: signed, error } = await db.storage.from(BUCKET).createSignedUploadUrl(path)
      if (error || !signed) {
        await rpc('portal_delete_file', { p_expert_id: expertId, p_file_id: fileId, p_reason: 'upload_not_started', p_require_editable: false })
        return fail(500, 'server_error', 'We could not start the upload. Please try again.')
      }
      return respond(200, { ok: true, file_id: fileId, upload_url: signed.signedUrl })
    }

    if (action === 'finalize') {
      const fileId = String(body.file_id ?? '')
      const { data: file } = await db
        .from('expert_files')
        .select('id, storage_path, state')
        .eq('id', fileId)
        .eq('expert_id', expertId)
        .maybeSingle()
      if (!file || file.state !== 'uploading') return fail(404, 'not_found', 'We could not find that upload. Please try again.')

      const { data: blob, error } = await db.storage.from(BUCKET).download(file.storage_path)
      if (error || !blob) {
        await rpc('portal_delete_file', { p_expert_id: expertId, p_file_id: file.id, p_reason: 'upload_missing', p_require_editable: false })
        return fail(422, 'upload_missing', 'The upload did not finish. Please try again.')
      }
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const check = checkFile(bytes)
      // The stored type must also agree with the contents, so a viewer never gets a mislabelled file.
      const mismatch = check.ok && blob.type && blob.type !== check.type.mime
      if (!check.ok || mismatch) {
        await db.storage.from(BUCKET).remove([file.storage_path])
        await rpc('portal_delete_file', { p_expert_id: expertId, p_file_id: file.id, p_reason: 'rejected_upload', p_require_editable: false })
        return fail(
          422,
          check.ok ? 'bad_type' : check.code,
          check.ok ? 'The file type does not match the file contents. Please save or scan it again as a PDF, JPG or PNG.' : check.message,
        )
      }
      await rpc('portal_finalize_file', { p_expert_id: expertId, p_file_id: file.id, p_content_type: check.type.mime, p_size: bytes.length })
      return respond(200, { ok: true })
    }

    if (action === 'delete_file') {
      const path = await rpc('portal_delete_file', { p_expert_id: expertId, p_file_id: String(body.file_id ?? '') })
      if (typeof path === 'string') await db.storage.from(BUCKET).remove([path])
      return respond(200, { ok: true })
    }

    if (action === 'file_url') {
      const { data: file } = await db
        .from('expert_files')
        .select('storage_path')
        .eq('id', String(body.file_id ?? ''))
        .eq('expert_id', expertId)
        .eq('state', 'ready')
        .maybeSingle()
      if (!file) return fail(404, 'not_found', 'We could not find that file.')
      const { data: signed } = await db.storage.from(BUCKET).createSignedUrl(file.storage_path, 60)
      if (!signed) return fail(500, 'server_error', 'We could not open that file. Please try again.')
      return respond(200, { ok: true, url: signed.signedUrl })
    }

    if (action === 'submit') {
      const out = await rpc('portal_submit', { p_expert_id: expertId })
      return respond(200, { ok: true, ...(out as object) })
    }

    return fail(400, 'unknown_action', 'That request is not recognised.')
  } catch (e) {
    if (e instanceof PortalError) return fail(e.status, e.code, e.message)
    console.error('expert-portal crashed', e instanceof Error ? e.name : 'unknown')
    return fail(500, 'server_error', 'Something went wrong on our side. Please try again in a moment.')
  }
})

class PortalError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message)
  }
}

/** An environment secret wins. Otherwise the address lives in public.verification_settings. */
async function replyToAddress(): Promise<string> {
  const fromEnv = env('EMAIL_REPLY_TO')
  if (fromEnv) return fromEnv
  const { data } = await db.from('verification_settings').select('value').eq('key', 'email_reply_to').maybeSingle()
  return typeof data?.value === 'string' ? data.value : ''
}

async function sendCodeEmail(to: string, mail: { subject: string; html: string; text: string }) {
  try {
    const apiKey = await secret('RESEND_API_KEY', 'resend_api_key')
    if (!apiKey) {
      console.error('No Resend key for sign-in codes')
      return
    }
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildSendBody({
          from: env('EMAIL_FROM', 'NEXUS-E <noreply@nexuse.org>'),
          to,
          subject: mail.subject,
          html: mail.html,
          text: mail.text,
          replyTo: await replyToAddress(),
        }),
      ),
    })
    if (!res.ok) console.error('Sign-in code email was not accepted', res.status)
  } catch {
    console.error('Sign-in code email failed to send')
  }
}
