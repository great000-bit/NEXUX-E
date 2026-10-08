import { useCallback, useRef, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Emblem } from '../../components/Logo'
import { Icon } from '../../components/icons'
import { Button } from '../../components/ds'
import { scrollToId } from '../../lib/scroll'
import { CornerNodes } from './CornerNodes'
import { StarDust } from './StarDust'
import { Tagline } from './Tagline'
import { useHeroMotion } from './useHeroMotion'
import { HERO, HERO_NODES, MEMBERSHIP_STRIP } from './content'
import './home.css'

/**
 * The first screen. The headline is real text and is the largest thing painted, so it is what the browser
 * measures as the page loaded. Everything behind it is decoration, and none of it is needed to read the page.
 */
export default function Hero() {
  const motion = useHeroMotion()
  const card = useRef<HTMLDivElement>(null)
  const frame = useRef(0)

  // A gentle parallax for a mouse. It writes two CSS variables and never touches layout.
  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!motion || e.pointerType !== 'mouse' || !card.current) return
    const el = card.current
    const { clientX, clientY } = e
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--px', (((clientX - r.left) / r.width) * 2 - 1).toFixed(3))
      el.style.setProperty('--py', (((clientY - r.top) / r.height) * 2 - 1).toFixed(3))
    })
  }, [motion])

  return (
    <section aria-label="Welcome" className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6">
      <div ref={card} className="hero-card" data-motion={motion ? 'on' : 'off'} onPointerMove={onPointerMove}>
        {/* Decoration. Every layer is hidden from assistive technology. */}
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-mass hero-mass-a" />
          <div className="hero-mass hero-mass-b" />
          <div className="hero-mass hero-mass-c" />
          {motion && <StarDust />}
          <div className="hero-streaks">
            <i /><i /><i /><i /><i />
          </div>
          <div className="hero-scrim" />
        </div>

        <CornerNodes />

        <div className="hero-content">
          <Link to="/register" className="hero-eyebrow glass group">
            <Emblem onDark decorative className="h-[1.1rem] w-auto flex-none" />
            <span>{HERO.eyebrow}</span>
            <Icon name="arrow-right" className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={2.2} />
          </Link>

          <h1 className="hero-title">
            <span className="block">{HERO.headlineA}</span>
            <span className="t-fade block">{HERO.headlineB}</span>
          </h1>

          <p className="hero-sub">{HERO.subline}</p>

          <div className="hero-actions">
            <Button to="/register" variant="accent" icon="arrow-right" className="hero-cta">Register now</Button>
            <Button to="/verify" variant="secondary" icon="arrow-right" className="hero-cta">Verify my profile</Button>
          </div>

          <p className="hero-small">{HERO.small}</p>

          {/* Phones: the four expertise areas as small chips in a 2 by 2 grid. */}
          <div className="w-full md:hidden">
            <ul className="hero-chips" aria-label="Areas of expertise">
              {HERO_NODES.map((n) => (
                <li key={n.corner} className="chip glass-flat">
                  <Icon name={n.icon} className="h-4 w-4 flex-none text-lime-500" />
                  <span>{n.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <button
          type="button"
          className="hero-cue group"
          onClick={() => scrollToId('how-it-works')}
        >
          <span className="hero-cue-btn" aria-hidden="true">
            <Icon name="arrow-down" className="h-4 w-4" strokeWidth={2.2} />
          </span>
          <span className="hero-cue-label glass-flat">See how it works</span>
        </button>

        <div className="hidden md:block">
          <Tagline animate={motion} />
        </div>
      </div>

      {/* Memberships a person can list on their profile. Plain text on purpose: these are not partners or endorsements. */}
      <div className="mx-auto mt-5 max-w-5xl px-2 text-center sm:mt-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-500">{MEMBERSHIP_STRIP.lead}</p>
        <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 font-display text-base font-semibold tracking-wide text-white/55 sm:gap-x-9 sm:text-lg" aria-label="Professional bodies">
          {MEMBERSHIP_STRIP.items.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </div>
    </section>
  )
}
