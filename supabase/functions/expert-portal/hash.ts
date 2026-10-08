// Small hashing and random helpers built on Web Crypto, which exists in both Deno and Node.

export async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes)
  crypto.getRandomValues(buf)
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Six digits, with leading zeros kept. */
export function randomCode(): string {
  const buf = new Uint32Array(1)
  // Reject values that would bias the result (2^32 is not a multiple of 10^6).
  const limit = Math.floor(0x100000000 / 1_000_000) * 1_000_000
  let n: number
  do {
    crypto.getRandomValues(buf)
    n = buf[0]
  } while (n >= limit)
  return String(n % 1_000_000).padStart(6, '0')
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase()

export const isPlausibleEmail = (email: string) =>
  email.length >= 5 && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)

export async function codeHash(pepper: string, email: string, code: string): Promise<string> {
  return sha256Hex(`${pepper}:${normaliseEmail(email)}:${code}`)
}

export async function ipHash(pepper: string, ip: string): Promise<string> {
  return sha256Hex(`${pepper}:ip:${ip}`)
}
