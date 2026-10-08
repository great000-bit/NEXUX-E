import { useEffect, useState } from 'react'
import { nextIndex } from '../../lib/motion'
import { TAGLINES } from './content'

const TICK_MS = 4000
const OUT_MS = 380

/**
 * A small label with three thin progress segments. It moves by itself every 4 seconds, in a loop: the three
 * segments fill in step, and the title and line slide and blur out while the next one rises in. Nothing needs a
 * click. With motion off it shows the first message and stays still. The block has a fixed height, so nothing jumps.
 */
export function Tagline({ animate, placement }: { animate: boolean; placement: 'corner' | 'inline' }) {
  const [index, setIndex] = useState(0)
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    if (!animate) return
    const out = window.setTimeout(() => setPhase('out'), TICK_MS - OUT_MS)
    const next = window.setTimeout(() => {
      setIndex((i) => nextIndex(i, TAGLINES.length))
      setPhase('in')
    }, TICK_MS)
    return () => {
      window.clearTimeout(out)
      window.clearTimeout(next)
    }
  }, [animate, index])

  const current = TAGLINES[index]

  return (
    <div className="hero-tagline" data-placement={placement}>
      <p className="hero-tagline-title" data-phase={phase}>{current.title}</p>
      <p className="hero-tagline-text" data-phase={phase}>{current.text}</p>
      <div className="mt-3 flex gap-1.5" aria-hidden="true">
        {TAGLINES.map((t, i) => (
          <span
            key={t.title}
            className="hero-seg"
            data-state={i === index ? (animate ? 'running' : 'active') : i < index ? 'done' : 'idle'}
          >
            <span className="hero-seg-track">
              {/* The key restarts the fill each time its segment becomes the current one. */}
              <span key={i === index ? `run-${index}` : `s-${i}`} className="hero-seg-fill" />
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
