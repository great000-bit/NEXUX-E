// The visitor's country, from our own function (api/geo.js), which only repeats the country header Vercel adds.
// Asked at most once per visit: the answer, or the failure, is kept for the session. It can never hold the page up:
// it has a short time limit, and any failure just means English.
const KEY = 'nexus-e:geo'

export async function fetchCountry(timeoutMs = 1500): Promise<string | null> {
  try {
    const kept = sessionStorage.getItem(KEY)
    if (kept !== null) return kept || null
  } catch {
    /* storage blocked: ask every time this visit */
  }
  let country: string | null = null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch('/api/geo', { cache: 'no-store', signal: controller.signal })
    if (res.ok) {
      const body = (await res.json()) as { country?: unknown }
      if (typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country)) country = body.country.toUpperCase()
    }
  } catch {
    /* offline, timed out, or not a function answer (a local preview): English */
  } finally {
    window.clearTimeout(timer)
  }
  try {
    sessionStorage.setItem(KEY, country ?? '')
  } catch {
    /* ignore */
  }
  return country
}
