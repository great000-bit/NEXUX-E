// The rules behind the hero's slot-machine text. Pure functions and one small class, so they are tested without a browser.

export type SpinPlan = {
  /** The text the reel lands on. */
  next: string
  /** Two or three other items that blur past on the way. */
  fillers: string[]
}

/** Fisher-Yates with an injected random source, so tests can be exact. */
function shuffle<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Chooses where a reel lands. The new text is never the one on show now (no repeat in a row) and never one that
 * another slot is showing or about to show. Fillers follow the same rule, so no text appears in two places at once.
 */
export function planSpin(o: {
  pool: readonly string[]
  current: string
  taken: ReadonlySet<string>
  rand: () => number
}): SpinPlan | null {
  const free = o.pool.filter((t) => t !== o.current && !o.taken.has(t))
  if (free.length === 0) return null
  const order = shuffle(free, o.rand)
  const next = order[0]
  const wanted = 2 + Math.floor(o.rand() * 2) // two or three
  return { next, fillers: order.slice(1, 1 + wanted) }
}

/** Each reel spins on its own timer, every 4 to 7 seconds. */
export function randomInterval(rand: () => number, min = 4000, max = 7000): number {
  return Math.round(min + rand() * (max - min))
}

/**
 * Shared by every slot in the hero. It remembers what each slot shows, and keeps spins at least `gap` apart,
 * so the reels stop one after another and never together.
 */
export class ReelBoard {
  private texts = new Map<string, string>()
  private free = 0
  private readonly gap: number

  constructor(gap = 1000) {
    this.gap = gap
  }

  set(id: string, text: string) {
    this.texts.set(id, text)
  }

  remove(id: string) {
    this.texts.delete(id)
  }

  /** Everything shown (or about to be shown) by the other slots. */
  taken(exceptId: string): Set<string> {
    const out = new Set<string>()
    for (const [id, t] of this.texts) if (id !== exceptId) out.add(t)
    return out
  }

  /** How long this slot must wait before it may start, so that spins are at least `gap` apart. */
  reserve(now: number): number {
    const start = Math.max(now, this.free)
    this.free = start + this.gap
    return start - now
  }
}
