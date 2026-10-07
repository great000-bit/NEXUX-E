import { createClient } from '@supabase/supabase-js'
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from './config'

export { isConfigured }

// A placeholder client keeps the app rendering when env vars are missing.
// Pages check `isConfigured` and show a clear message instead of failing silently.
export const supabase = createClient(SUPABASE_URL ?? 'https://not-configured.invalid', SUPABASE_ANON_KEY ?? 'missing-anon-key', {
  auth: { persistSession: true, autoRefreshToken: true },
})
