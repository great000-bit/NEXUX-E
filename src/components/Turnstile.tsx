/**
 * Cloudflare Turnstile slot.
 *
 * To enable later:
 *  1. Set VITE_TURNSTILE_SITE_KEY in the environment.
 *  2. Load https://challenges.cloudflare.com/turnstile/v0/api.js and render the widget here,
 *     calling onToken(token) when it passes.
 *  3. Send the token as `turnstile_token` in the register_expert payload (see src/lib/form.ts).
 *  4. Verify the token server-side where marked in supabase/migrations/..._rls_and_rpc.sql.
 *
 * Until a site key is set this renders nothing, so it costs the page nothing.
 */
export const TURNSTILE_SITE_KEY = (import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined) || ''

export function Turnstile(props: { onToken: (token: string) => void }) {
  void props
  return null
}
