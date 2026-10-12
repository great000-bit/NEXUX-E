// Per-key English fallback. A dictionary for a new language may be unfinished: any text it lacks (or leaves empty) is
// taken from English, key by key, so a visitor never sees a blank or a raw key. A list is used whole or not at all,
// because half a list in one language and half in another reads worse than English.

export function withEnglishFallback<T>(english: T, other: unknown): T {
  if (typeof english === 'string') {
    return (typeof other === 'string' && other.trim() !== '' ? other : english) as T
  }
  if (Array.isArray(english)) {
    if (!Array.isArray(other) || other.length !== english.length) return english
    return english.map((item, i) => withEnglishFallback(item, other[i])) as T
  }
  if (english && typeof english === 'object') {
    const source = (other && typeof other === 'object' ? other : {}) as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(english)) out[key] = withEnglishFallback(value, source[key])
    return out as T
  }
  return english
}
