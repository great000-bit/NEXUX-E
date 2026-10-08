// Decides when the home page may animate. Pure functions, so the rules are tested without a browser.
import { NETWORK_QUERY } from './network'

export type MotionInputs = {
  reducedMotion: boolean
  /** The browser's "data saver" signal. */
  saveData: boolean
  /** navigator.hardwareConcurrency, when the browser says. */
  cores?: number
  /** navigator.deviceMemory in GB, when the browser says. */
  memoryGb?: number
  /** The tab is in the background. */
  hidden: boolean
  /** A desktop-width screen with a fine pointer (a laptop or desktop with a mouse or trackpad). */
  desktopPointer: boolean
}

/**
 * The hero animates for everyone except people who ask for less motion (prefers-reduced-motion), people who turned
 * on data saver, and very weak phones. Otherwise it shows the static poster: the same picture with nothing moving.
 *
 * The core and memory counts only ever apply to a phone or tablet. They never block a screen that is at least
 * 1024 px wide with a fine pointer: most real laptops report 4 cores or fewer, and that is plenty for this hero.
 * A hidden tab is not a reason to switch motion off (the hero pauses in place instead), so it is not checked here.
 */
export function heroMotionAllowed(i: MotionInputs): boolean {
  if (i.reducedMotion || i.saveData) return false
  if (i.desktopPointer) return true
  if (i.cores !== undefined && i.cores <= 2) return false
  if (i.memoryGb !== undefined && i.memoryGb <= 1) return false
  return true
}

export type ReelMode = 'spin' | 'swap' | 'off'

/**
 * How the hero's text reels behave. They spin when the hero may animate. With reduced motion they swap the text
 * instantly with no spin. With data saver on, or while the tab is hidden, they stay on the first text.
 * (Very weak phones keep the still poster, like every other hero effect.)
 */
export function reelMode(i: MotionInputs): ReelMode {
  if (i.hidden || i.saveData) return 'off'
  if (i.reducedMotion) return 'swap'
  return heroMotionAllowed(i) ? 'spin' : 'off'
}

/** Star dust is capped: about 60 particles on desktop and 25 on a phone. */
export function particleCount(viewportWidth: number): number {
  return viewportWidth < 640 ? 25 : 60
}

/** Reads the live inputs from the browser. */
export function readMotionInputs(): MotionInputs {
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }
  return {
    reducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    saveData: Boolean(nav.connection?.saveData),
    cores: nav.hardwareConcurrency || undefined,
    memoryGb: nav.deviceMemory,
    hidden: document.hidden,
    desktopPointer: window.matchMedia(NETWORK_QUERY).matches,
  }
}

/** The next tagline segment, wrapping back to the first. */
export const nextIndex = (current: number, total: number) => (current + 1) % total
