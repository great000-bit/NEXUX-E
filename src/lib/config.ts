export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const isConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY)

/** The public address of the live site. Used for canonical links, so a preview site never competes with it. */
export const SITE_URL = 'https://register.nexuse.org'
