import { useState } from 'react'
import { Button, GlassCard, Section } from '../../components/ds'
import { Icon } from '../../components/icons'
import { fadeUp, softZoom } from './aos'
import { FAQ } from './content'

/**
 * Frequently asked questions: glass cards, one open at a time, the first open by default.
 * Each question is a real button (Enter and Space toggle it) with aria-expanded and aria-controls, and the closed
 * answers are hidden from assistive technology. The open and close motion is a CSS transition on grid rows and
 * opacity, which the reduced-motion rule turns into an instant change.
 */
export function Faq() {
  const [open, setOpen] = useState(0)

  return (
    <Section id="faq" eyebrow={FAQ.eyebrow} title={FAQ.title}>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1.55fr_1fr] lg:items-start lg:gap-10">
        <ul className="faq-list order-last space-y-3 lg:order-first">
          {FAQ.items.map((item, i) => {
            const isOpen = open === i
            return (
              <li key={item.q} {...fadeUp(i)} className="faq-item" data-open={isOpen}>
                <h3>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    className="faq-q"
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span className="faq-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                    <span className="faq-text">{item.q}</span>
                    <span className="faq-icon" aria-hidden="true">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                      </svg>
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className="faq-panel"
                  data-open={isOpen}
                  aria-hidden={!isOpen}
                >
                  <div className="faq-panel-clip">
                    <p className="faq-answer">{item.a}</p>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>

        <GlassCard {...softZoom()} className="faq-intro order-first p-7 sm:p-8 lg:order-last">
          <span className="icon-tile"><Icon name="user-search" className="h-6 w-6" /></span>
          <p className="mt-5 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">{FAQ.intro}</p>
          <div className="mt-6 grid gap-3">
            <Button to="/register" variant="accent" icon="arrow-right">Register now</Button>
            <Button to="/verify" variant="secondary" icon="arrow-right">Verify my profile</Button>
          </div>
        </GlassCard>
      </div>
    </Section>
  )
}
