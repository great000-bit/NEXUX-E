import { useEffect, useState } from 'react'
import { nextIndex } from '../../lib/motion'
import { TAGLINES } from './content'

const TICK_MS = 4000

/**
 * A small label with three thin progress segments. It rotates about every 4 seconds, pauses while the
 * pointer or keyboard focus is on it, and stays still (but can be changed by hand) when motion is off.
 */
export function Tagline({ animate }: { animate: boolean }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (!animate || paused) return
    const t = window.setTimeout(() => setIndex((i) => nextIndex(i, TAGLINES.length)), TICK_MS)
    return () => window.clearTimeout(t)
  }, [animate, paused, index])

  const current = TAGLINES[index]

  return (
    <div
      className="hero-tagline"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <p className="hero-tagline-title" key={`t-${index}`}>{current.title}</p>
      <p className="hero-tagline-text" key={`x-${index}`}>{current.text}</p>
      <div className="mt-3 flex gap-1.5" role="group" aria-label="Choose a message">
        {TAGLINES.map((t, i) => (
          <button
            key={t.title}
            type="button"
            className="hero-seg"
            data-state={i === index ? (animate && !paused ? 'running' : 'active') : i < index ? 'done' : 'idle'}
            aria-label={t.title}
            aria-current={i === index}
            onClick={() => setIndex(i)}
          >
            <span className="hero-seg-track">
              <span className="hero-seg-fill" />
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
