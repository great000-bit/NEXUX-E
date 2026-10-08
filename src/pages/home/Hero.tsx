import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Emblem } from '../../components/Logo'
import { Icon } from '../../components/icons'
import { Button } from '../../components/ds'
import { EXPERTISE } from '../../lib/options'
import { ReelBoard } from '../../lib/reels'
import { scrollToId } from '../../lib/scroll'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { CornerNodes, iconForExpertise } from './CornerNodes'
import { Reel } from './Reel'
import { StarDust } from './StarDust'
import { Tagline } from './Tagline'
import { useHeroMotion } from './useHeroMotion'
import { HERO, HERO_HOOKS, HERO_NODES, MEMBERSHIP_STRIP } from './content'
import './home.css'

/**
 * The first screen. The headline is real text and is the largest thing painted, so it is what the browser
 * measures as the page loaded. Everything behind it is decoration, and none of it is needed to read the page.
 */
export default function Hero() {
  const { motion, reels, hidden } = useHeroMotion()
  const card = useRef<HTMLDivElement>(null)
  const frame = useRef(0)
  const [board] = useState(() => new ReelBoard(1000))
  const wide = useMediaQuery('(min-width: 768px)')
  const hooks = useMediaQuery('(min-width: 1024px)')
  const extraWide = useMediaQuery('(min-width: 1280px) and (min-height: 820px)')

  // The reels pause while the hero is off screen. (They also pause while the tab is hidden: see useHeroMotion.)
  const [inView, setInView] = useState(true)
  useEffect(() => {
    const el = card.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [])
  const reelsActive = inView

  // A mouse gets a soft glow that follows it and a gentle parallax. Both write CSS variables only and never touch layout.
  // Touch screens get neither: only the automatic animations run.
  const onPointerMove = useCallback((e: PointerEvent<HTMLDivElement>) => {
    if (!motion || e.pointerType !== 'mouse' || !card.current) return
    const el = card.current
    const { clientX, clientY } = e
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      el.style.setProperty('--px', (((clientX - r.left) / r.width) * 2 - 1).toFixed(3))
      el.style.setProperty('--py', (((clientY - r.top) / r.height) * 2 - 1).toFixed(3))
      el.style.setProperty('--gx', (clientX - r.left).toFixed(0))
      el.style.setProperty('--gy', (clientY - r.top).toFixed(0))
      el.dataset.glow = 'on'
    })
  }, [motion])
  const onPointerLeave = useCallback(() => {
    cancelAnimationFrame(frame.current)
    if (!card.current) return
    delete card.current.dataset.glow
    card.current.style.setProperty('--px', '0')
    card.current.style.setProperty('--py', '0')
  }, [])

  return (
    <section aria-label="Welcome" className="px-3 pb-3 pt-3 sm:px-6 sm:pb-6">
      <div
        ref={card}
        className="hero-card"
        data-motion={motion ? 'on' : 'off'}
        data-paused={hidden ? '' : undefined}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        {/* Decoration. Every layer is hidden from assistive technology. */}
        <div className="hero-bg" aria-hidden="true">
          <div className="hero-mass hero-mass-a" />
          <div className="hero-mass hero-mass-b" />
          <div className="hero-mass hero-mass-c" />
          {motion && <StarDust />}
          {motion && <div className="hero-glow" />}
          <div className="hero-streaks">
            <i /><i /><i /><i /><i />
          </div>
          <div className="hero-scrim" />
        </div>

        {wide && <CornerNodes board={board} mode={reels} active={reelsActive} lower={hooks} />}

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

          {/* Phones: the tagline sits centred under the buttons, and still moves by itself. */}
          {!wide && <Tagline animate={motion} placement="inline" />}

          <p className="hero-small">{HERO.small}</p>

          {/* Laptops and up: a floating hook line that changes like a reel. */}
          {hooks && (
            <div className="hero-float hero-float-hook" data-depth="1">
              <Reel id="hook-a" board={board} pool={HERO_HOOKS} initial={HERO_HOOKS[0]} mode={reels} active={reelsActive} align="center" className="reel-hook" />
            </div>
          )}

          {/* Phones: four expertise chips in a 2 by 2 grid. Each is a reel. */}
          {!wide && (
            <ul className="hero-chips" aria-label="Areas of expertise">
              {HERO_NODES.map((n) => (
                <li key={n.corner}>
                  <Reel id={`chip-${n.corner}`} board={board} pool={EXPERTISE} initial={n.label} iconFor={iconForExpertise} mode={reels} active={reelsActive} className="reel-chip" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Large screens: a second hook line between the two bottom corners. */}
        {extraWide && (
          <div className="hero-float hero-float-bottom" data-depth="2">
            <Reel id="hook-b" board={board} pool={HERO_HOOKS} initial={HERO_HOOKS[1]} mode={reels} active={reelsActive} align="center" className="reel-hook" />
          </div>
        )}

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

        {wide && <Tagline animate={motion} placement="corner" />}
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
