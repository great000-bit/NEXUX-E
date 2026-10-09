import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import 'aos/dist/aos.css'
import './sections.css'
import { Icon, EXPERTISE_ICON } from '../../components/icons'
import { Button, GlassCard, Section, VerifiedBadge } from '../../components/ds'
import { EXPERTISE } from '../../lib/options'
import { displayName } from '../../lib/directoryFilters'
import { fetchListedPreview, type ListedPreview } from '../../lib/publicApi'
import { prefersReducedMotion } from '../../lib/scroll'
import { fadeIn, fadeUp, initAos, refreshAos, softZoom } from './aos'
import { ABOUT, AUDIENCE, CTA, DIRECTORY, EXPERTISE_SECTION, HOW, PRIVACY, STEPS, WHY } from './content'

/** True once the element has come within 250 px of the screen. Used to load data just before it is needed. */
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setNear(true)
        io.disconnect()
      }
    }, { rootMargin: '250px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return [ref, near] as const
}

/** Writes --p (0 to 1) on the element as it scrolls through the screen, so the timeline line can draw itself. */
function useScrollProgress<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      el.style.setProperty('--p', '1')
      return
    }
    let raf = 0
    const update = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const vh = window.innerHeight
      const p = Math.min(1, Math.max(0, (vh * 0.78 - r.top) / (r.height * 0.9)))
      el.style.setProperty('--p', p.toFixed(3))
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    // Only listen while the timeline is near the screen.
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        window.addEventListener('scroll', onScroll, { passive: true })
        update()
      } else {
        window.removeEventListener('scroll', onScroll)
      }
    }, { rootMargin: '120px' })
    io.observe(el)
    return () => {
      io.disconnect()
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [])
  return ref
}

export default function HomeSections() {
  useEffect(() => {
    initAos()
  }, [])

  return (
    <>
      <About />
      <Expertise />
      <HowItWorks />
      <WhyRegister />
      <WhoFindsYou />
      <Privacy />
      <DirectoryTeaser />
      <FinalCta />
    </>
  )
}

function About() {
  return (
    <Section id="about" eyebrow={ABOUT.eyebrow} title={ABOUT.title} lead={ABOUT.lead}>
      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {ABOUT.cards.map((c, i) => (
          <GlassCard key={c.title} hover {...softZoom(i)} className="flex flex-col gap-4 p-7">
            <span className="icon-tile"><Icon name={c.icon} className="h-6 w-6" /></span>
            <h3 className="text-xl font-semibold text-white">{c.title}</h3>
            <p className="text-[0.95rem] text-ink-700">{c.text}</p>
          </GlassCard>
        ))}
      </div>
    </Section>
  )
}

function Expertise() {
  return (
    <Section id="expertise" eyebrow={EXPERTISE_SECTION.eyebrow} title={EXPERTISE_SECTION.title} lead={EXPERTISE_SECTION.lead}>
      {/* Flat glass (no blur): eighteen cards at once would be heavy on a mid-range phone. */}
      <ul className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-6">
        {EXPERTISE.map((name, i) => (
          <li key={name} {...fadeUp(i % 6)}>
            <GlassCard as="div" flat hover className="expertise-card h-full">
              <span className="icon-tile"><Icon name={EXPERTISE_ICON[name]} className="h-6 w-6" /></span>
              <span className="font-display text-[0.95rem] font-semibold leading-snug text-white">{name}</span>
            </GlassCard>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function HowItWorks() {
  const ref = useScrollProgress<HTMLDivElement>()
  return (
    <Section id="how-it-works" eyebrow={HOW.eyebrow} title={HOW.title}>
      <div ref={ref} className="timeline mt-12">
        {/* Phones and tablets: a vertical line down the left. Desktop: a horizontal line across the top. */}
        <span className="timeline-line timeline-line-v lg:hidden" aria-hidden="true" />
        <span className="timeline-line timeline-line-h hidden lg:block" aria-hidden="true" />
        <ol className="relative grid gap-9 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((s, i) => (
            <li key={s.title} {...fadeUp(i)} className="relative pl-16 lg:pl-0 lg:text-center">
              <span className="timeline-node absolute left-0 top-0 lg:static lg:mx-auto">
                <Icon name={s.icon} className="h-5 w-5" />
              </span>
              <p className="mt-0 text-xs font-bold uppercase tracking-[0.2em] text-lime-500 lg:mt-5">Step {i + 1}</p>
              <h3 className="mt-1 text-2xl font-semibold text-white">{s.title}</h3>
              <p className="mt-1.5 text-[0.95rem] text-ink-700 lg:mx-auto lg:max-w-[15rem]">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <blockquote {...fadeIn()} className="mx-auto mt-16 max-w-3xl text-center font-display text-[clamp(1.25rem,1rem+1.2vw,1.9rem)] font-semibold leading-snug tracking-tight text-white/90">
        <span aria-hidden="true" className="text-lime-500">&ldquo;</span>
        {HOW.quote}
        <span aria-hidden="true" className="text-lime-500">&rdquo;</span>
      </blockquote>
    </Section>
  )
}

function WhyRegister() {
  return (
    <Section id="why-register" eyebrow={WHY.eyebrow} title={WHY.title}>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {WHY.items.map((t, i) => (
          <li key={t} {...fadeUp(i)}>
            <GlassCard flat className="flex h-full items-start gap-4 p-6">
              <span className="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-full bg-lime-500 text-green-950">
                <Icon name="check" className="h-[1.1rem] w-[1.1rem]" strokeWidth={2.6} />
              </span>
              <span className="font-display text-lg font-semibold leading-snug text-white">{t}</span>
            </GlassCard>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function WhoFindsYou() {
  return (
    <Section id="who-finds-you" eyebrow={AUDIENCE.eyebrow} title={AUDIENCE.title}>
      <ul className="mt-10 grid grid-cols-1 gap-3 min-[460px]:grid-cols-2 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
        {AUDIENCE.items.map((a, i) => (
          <li key={a.label} {...fadeUp(i % 4)} className="min-w-0">
            <GlassCard flat hover className="flex h-full items-center gap-3.5 p-4 sm:p-5">
              <span className="icon-tile !h-11 !w-11"><Icon name={a.icon} className="h-5 w-5" /></span>
              <span className="min-w-0 break-words font-display text-[0.95rem] font-semibold leading-snug text-white">{a.label}</span>
            </GlassCard>
          </li>
        ))}
      </ul>
    </Section>
  )
}

function Privacy() {
  return (
    <Section id="privacy" eyebrow={PRIVACY.eyebrow} title={PRIVACY.title}>
      <GlassCard {...softZoom()} className="mt-10 grid gap-8 p-7 sm:p-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div>
          <span className="icon-tile !h-14 !w-14"><Icon name="shield-check" className="h-7 w-7" /></span>
          <p className="mt-5 font-display text-[clamp(1.2rem,1rem+0.9vw,1.7rem)] font-semibold leading-snug text-white">{PRIVACY.lead}</p>
        </div>
        <ul className="space-y-4">
          {PRIVACY.points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-[0.95rem] text-ink-700">
              <Icon name="check" className="mt-1 h-4 w-4 flex-none text-lime-500" strokeWidth={2.4} />
              <span>{p}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </Section>
  )
}

function DirectoryTeaser() {
  const [ref, near] = useNearViewport<HTMLDivElement>()
  const [state, setState] = useState<{ ok: true; items: ListedPreview[] } | { ok: false } | null>(null)

  useEffect(() => {
    if (!near) return
    let live = true
    fetchListedPreview(3).then((r) => {
      if (!live) return
      setState(r.ok ? { ok: true, items: r.items } : { ok: false })
      requestAnimationFrame(refreshAos)
    })
    return () => {
      live = false
    }
  }, [near])

  const items = state && state.ok ? state.items : []
  return (
    <Section id="directory" eyebrow={DIRECTORY.eyebrow} title={DIRECTORY.title} lead={DIRECTORY.lead}>
      <div ref={ref} className="mt-10 grid gap-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div {...fadeUp()} className="flex flex-wrap gap-3">
          <Button to="/experts" variant="primary" icon="arrow-right">Search the directory</Button>
          <Button to="/register" variant="secondary">Register to be listed</Button>
        </div>

        <div aria-live="polite">
          {items.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {items.map((e) => (
                <li key={e.expert_id}>
                  <Link to={`/experts/${e.expert_id}`} className="glass-flat glass-hover block h-full rounded-[var(--radius-lg)] p-4">
                    <VerifiedBadge />
                    <p className="mt-3 font-display text-base font-semibold text-white">{displayName(e.title, e.full_name)}</p>
                    <p className="mt-0.5 text-sm text-ink-700">{e.primary_expertise}</p>
                    <p className="text-xs text-ink-500">{e.state}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            state !== null && (
              <GlassCard flat {...fadeIn()} className="flex items-start gap-4 p-6">
                <span className="icon-tile"><Icon name="user-search" className="h-6 w-6" /></span>
                <p className="text-[0.95rem] text-ink-700">{state.ok ? DIRECTORY.empty : 'The directory could not be loaded just now. You can open it from the button.'}</p>
              </GlassCard>
            )
          )}
        </div>
      </div>
    </Section>
  )
}

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="mx-auto w-full max-w-6xl px-5 pb-8 pt-4 sm:px-8 sm:pb-16">
      <GlassCard {...softZoom()} className="relative overflow-hidden px-6 py-14 text-center sm:px-12 sm:py-20">
        <span aria-hidden="true" className="cta-glow -right-24 -top-32" />
        <span aria-hidden="true" className="cta-glow -bottom-40 -left-24 opacity-60" />
        <div className="relative">
          <p className="eyebrow">{CTA.eyebrow}</p>
          <h2 id="cta-title" className="t-h2 mx-auto mt-3 max-w-2xl !text-white">{CTA.title}</h2>
          <p className="mx-auto mt-4 max-w-md text-ink-700">{CTA.text}</p>
          <div className="mt-8 flex justify-center">
            <Button to="/register" variant="accent" icon="arrow-right" className="min-w-52">Register now</Button>
          </div>
        </div>
      </GlassCard>
    </section>
  )
}
