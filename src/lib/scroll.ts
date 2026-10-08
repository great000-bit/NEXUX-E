/** True when the person has asked their device to cut back on motion. Safe to call anywhere. */
export const prefersReducedMotion = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Scrolls to an element by id. The home page sections load a moment after the hero, so this keeps
 * looking for the element for a few seconds instead of giving up on the first try.
 */
export function scrollToId(id: string, tries = 40): void {
  const el = document.getElementById(id)
  if (el) {
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
    return
  }
  if (tries > 0) window.setTimeout(() => scrollToId(id, tries - 1), 100)
}
