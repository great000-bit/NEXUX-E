// Decides when the home page may animate. Pure functions, so the rules are tested without a browser.

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
}

/**
 * The hero animates only when it is safe and kind to the device. Otherwise it shows the static poster:
 * the same picture with nothing moving, no canvas and no timers.
 */
export function heroMotionAllowed(i: MotionInputs): boolean {
  if (i.reducedMotion || i.saveData || i.hidden) return false
  if (i.cores !== undefined && i.cores <= 4) return false
  if (i.memoryGb !== undefined && i.memoryGb <= 2) return false
  return true
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
  }
}

/** The next tagline segment, wrapping back to the first. */
export const nextIndex = (current: number, total: number) => (current + 1) % total
