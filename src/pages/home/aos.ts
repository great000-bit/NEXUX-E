import AOS from 'aos'
import { prefersReducedMotion } from '../../lib/scroll'

/**
 * One shared AOS configuration for the whole site, and a few presets so every section animates the same way.
 * AOS is imported only here, and this file is only imported by the home page sections, so the registration
 * route never downloads it.
 */
export function initAos() {
  AOS.init({
    duration: 650,
    easing: 'ease-out-cubic',
    once: true,
    offset: 60,
    delay: 0,
    anchorPlacement: 'top-bottom',
    // Reduced motion: AOS removes its attributes and everything shows at once.
    disable: () => prefersReducedMotion(),
  })
}

/** Call after content that arrives later (such as the directory teaser) so AOS notices it. */
export const refreshAos = () => AOS.refreshHard()

type Preset = { 'data-aos': string; 'data-aos-delay': string }
const delay = (i: number) => String(Math.min(Math.max(i, 0), 8) * 70)

/** Rise a little and fade in. The default for text and cards. */
export const fadeUp = (i = 0): Preset => ({ 'data-aos': 'fade-up', 'data-aos-delay': delay(i) })
/** Fade only. For big surfaces and backgrounds. */
export const fadeIn = (i = 0): Preset => ({ 'data-aos': 'fade-in', 'data-aos-delay': delay(i) })
/** A very small zoom from 96.5 percent. For glass cards. */
export const softZoom = (i = 0): Preset => ({ 'data-aos': 'soft-zoom', 'data-aos-delay': delay(i) })
