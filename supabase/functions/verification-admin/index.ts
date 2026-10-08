// Supabase Edge Function: admin only actions that need to touch private storage.
//
//   delete_files  An admin removes everything an expert uploaded (a data deletion request).
//   retention     Deletes files of experts marked Not verified once the retention period has passed,
//                 clears uploads that never finished, and removes stored files that no record points to.
//                 Called daily by pg_cron with the webhook secret.
//
// Admins are identified by their Supabase login and the public.admins allow-list. Expert portal sessions
// are a different system and are never accepted here. File paths are never written to logs.
import { createClient } from 'npm:@supabase/supabase-js@2'

const BUCKET = 'expert-evidence'
const env = (name: string, fallback = ''): string => Deno.env.get(name) ?? fallback

const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function secret(envName: string, vaultName: string): Promise<string> {
  const fromEnv = env(envName)
  if (fromEnv) return fromEnv
  const { data } = await db.rpc('get_function_secret', { p_name: vaultName })
  return typeof data === 'string' ? data : ''
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null
  const configured = env('ALLOWED_ORIGINS', 'https://register.nexuse.org').split(',').map((s) => s.trim())
  if (configured.includes(origin)) return origin
  if (/^http:\/\/localhost:\d+$/.test(origin)) return origin
  return null
}

/** Removes the stored objects, in small groups. Returns how many the storage API reported removed. */
async function removeObjects(paths: string[]): Promise<number> {
  let removed = 0
  for (let i = 0; i < paths.length; i += 50) {
    const { data } = await db.storage.from(BUCKET).remove(paths.slice(i, i + 50))
    removed += data?.length ?? 0
  }
  return removed
}

async function deleteExpertFiles(expertId: string, actor: string, actorType: 'admin' | 'system', reason: string) {
  const { data } = await db.rpc('system_files_to_delete', { p_expert_id: expertId })
  const paths = ((data ?? []) as { r_path: string }[]).map((r) => r.r_path)
  if (paths.length) await removeObjects(paths)
  const { data: n } = await db.rpc('system_mark_files_deleted', {
    p_expert_id: expertId,
    p_actor: actor,
    p_actor_type: actorType,
    p_reason: reason,
  })
  return Number(n ?? 0)
}

Deno.serve(async (req) => {
  const origin = allowedOrigin(req.headers.get('origin'))
  const cors: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info, x-webhook-secret',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
  }
  const respond = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  if (req.method !== 'POST') return respond(405, { ok: false, message: 'This address only accepts POST requests.' })

  let body: Record<string, unknown>
  try {
    body = JSON.parse(await req.text())
  } catch {
    return respond(400, { ok: false, message: 'That request could not be read.' })
  }
  const action = String(body.action ?? '')

  // Who is calling? Either the scheduler (shared secret) or a signed in admin.
  let actor: { name: string; type: 'admin' | 'system' } | null = null
  const sent = req.headers.get('x-webhook-secret')
  if (sent) {
    const expected = await secret('WEBHOOK_SECRET', 'email_webhook_secret')
    if (expected && safeEqual(sent, expected)) actor = { name: 'system:retention', type: 'system' }
  } else {
    const jwt = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (jwt) {
      const { data } = await db.auth.getUser(jwt)
      const email = data.user?.email?.toLowerCase()
      if (email) {
        const { data: row } = await db.from('admins').select('email').eq('email', email).maybeSingle()
        if (row) actor = { name: email, type: 'admin' }
      }
    }
  }
  if (!actor) return respond(401, { ok: false, message: 'Only signed in administrators can do this.' })

  try {
    if (action === 'delete_files') {
      if (actor.type !== 'admin') return respond(403, { ok: false, message: 'Only an administrator can do this.' })
      const expertId = String(body.expert_id ?? '')
      const reason = String(body.reason ?? '').trim().slice(0, 300) || 'Deleted on request by an administrator'
      if (!/^NEX-\d{6}$/.test(expertId)) return respond(400, { ok: false, message: 'That Expert ID is not valid.' })
      const deleted = await deleteExpertFiles(expertId, actor.name, 'admin', reason)
      return respond(200, { ok: true, deleted })
    }

    if (action === 'retention') {
      const { data: stale } = await db.rpc('system_expire_stale_uploads')
      const staleCount = Array.isArray(stale) && stale.length ? await removeObjects(stale as string[]) : 0
      // Stored files that no live record points to, for example after an expert's record was deleted.
      const { data: orphans } = await db.rpc('system_orphan_files')
      const orphanCount = Array.isArray(orphans) && orphans.length ? await removeObjects(orphans as string[]) : 0
      const { data: candidates } = await db.rpc('system_retention_candidates')
      let experts = 0
      let files = 0
      for (const id of (candidates ?? []) as string[]) {
        files += await deleteExpertFiles(id, 'system:retention', 'system', 'Retention period after Not verified decision has passed')
        experts++
      }
      console.log(JSON.stringify({ message: 'Retention run finished', experts, files, staleUploads: staleCount, orphans: orphanCount }))
      return respond(200, { ok: true, experts, files, staleUploads: staleCount, orphans: orphanCount })
    }

    return respond(400, { ok: false, message: 'That request is not recognised.' })
  } catch (e) {
    console.error('verification-admin failed', e instanceof Error ? e.name : 'unknown')
    return respond(500, { ok: false, message: 'Something went wrong. Please try again.' })
  }
})
