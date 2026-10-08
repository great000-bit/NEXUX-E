// The rules behind the hero's desktop network background. Pure functions, so they are tested without a browser.

export type Pt = { x: number; y: number }

/** The network is drawn only on a large screen with a precise pointer. Below that nothing is mounted. */
export const NETWORK_QUERY = '(min-width: 1024px) and (pointer: fine)'

/** About 40 to 60 nodes, scaled by the width of the hero. */
export function nodeCount(width: number): number {
  return Math.max(40, Math.min(60, Math.round(width / 30)))
}

const dist = (a: Pt, b: Pt) => Math.hypot(b.x - a.x, b.y - a.y)

/** A right-angle path from a to b: along the horizontal first, then the vertical. */
export function elbow(a: Pt, b: Pt): Pt[] {
  return [a, { x: b.x, y: a.y }, b]
}

export function pathLength(pts: readonly Pt[]): number {
  let total = 0
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i])
  return total
}

/** The point `d` pixels along the path from its start (clamped to the ends). */
export function pointAlong(pts: readonly Pt[], d: number): Pt {
  if (pts.length === 0) return { x: 0, y: 0 }
  let left = Math.max(0, d)
  for (let i = 1; i < pts.length; i++) {
    const seg = dist(pts[i - 1], pts[i])
    if (left <= seg) {
      const t = seg === 0 ? 0 : left / seg
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t }
    }
    left -= seg
  }
  return pts[pts.length - 1]
}

/**
 * The part of a path between `from` and `to` pixels measured back from its END (its head). Used for a node's
 * trail: pts runs from tail to head, and the slice nearest the head is the brightest.
 */
export function sliceFromHead(pts: readonly Pt[], from: number, to: number): Pt[] {
  const total = pathLength(pts)
  const start = Math.max(0, total - to)
  const end = Math.max(0, total - from)
  if (end <= start) return []
  const out: Pt[] = [pointAlong(pts, start)]
  let walked = 0
  for (let i = 1; i < pts.length; i++) {
    walked += dist(pts[i - 1], pts[i])
    if (walked > start && walked < end) out.push(pts[i])
  }
  out.push(pointAlong(pts, end))
  return out
}

/** Keeps no more of the tail than `length` pixels, so the stored corner list stays short. */
export function trimTail(pts: readonly Pt[], length: number): Pt[] {
  if (pathLength(pts) <= length) return [...pts]
  return sliceFromHead(pts, 0, length)
}

/**
 * Keeps links from flooding the screen: at most `max` at once, and the same pair is not linked again
 * until `cooldownMs` has passed since its link began.
 */
export class LinkBook {
  private lastStart = new Map<string, number>()
  private active = new Set<string>()
  private readonly max: number
  private readonly cooldownMs: number

  constructor(max: number, cooldownMs: number) {
    this.max = max
    this.cooldownMs = cooldownMs
  }

  get size() {
    return this.active.size
  }

  canStart(key: string, now: number): boolean {
    if (this.active.has(key) || this.active.size >= this.max) return false
    const last = this.lastStart.get(key)
    return last === undefined || now - last >= this.cooldownMs
  }

  start(key: string, now: number) {
    this.active.add(key)
    this.lastStart.set(key, now)
  }

  end(key: string) {
    this.active.delete(key)
  }

  /** Forgets old cooldowns so the map does not grow without end. */
  prune(now: number) {
    for (const [k, t] of this.lastStart) if (!this.active.has(k) && now - t > this.cooldownMs * 4) this.lastStart.delete(k)
  }
}

/** Where a link is in its life (0 to 1): it draws, a pulse runs along it, then it fades. */
export function linkPhase(age: number, life: number): { draw: number; pulse: number; alpha: number } {
  const t = Math.min(1, Math.max(0, age / life))
  const draw = Math.min(1, t / 0.28)
  const pulse = Math.min(1, Math.max(0, (t - 0.1) / 0.6))
  const alpha = t < 0.72 ? 1 : Math.max(0, 1 - (t - 0.72) / 0.28)
  return { draw, pulse, alpha }
}
