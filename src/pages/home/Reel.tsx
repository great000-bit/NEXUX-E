import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon, type IconName } from '../../components/icons'
import type { ReelMode } from '../../lib/motion'
import { planSpin, randomInterval, type ReelBoard, type SpinPlan } from '../../lib/reels'

type Props = {
  /** Unique per slot. */
  id: string
  board: ReelBoard
  pool: readonly string[]
  initial: string
  iconFor?: (text: string) => IconName | undefined
  mode: ReelMode
  /** False while the hero is off screen or the tab is hidden: the timers stop. */
  active: boolean
  className?: string
  align?: 'start' | 'end' | 'center'
}

/**
 * A fixed-size window with a vertical strip of text inside, like a slot machine reel. When it is time to change,
 * the strip spins downward: the old text rolls out, two or three other items blur past, and the new text lands with
 * a small overshoot and a settle. Only transform is animated. The window never changes size, so nothing shifts.
 */
export function Reel({ id, board, pool, initial, iconFor, mode, active, className = '', align = 'start' }: Props) {
  const [text, setText] = useState(initial)
  const [spin, setSpin] = useState<SpinPlan | null>(null)
  const textRef = useRef(initial)
  const strip = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    board.set(id, textRef.current)
    return () => board.remove(id)
  }, [board, id])

  const running = mode !== 'off' && active

  // Each slot has its own timer, 4 to 7 seconds. The board spaces the starts so the reels stop one after another.
  useEffect(() => {
    if (!running) return
    let timer = 0
    const schedule = () => {
      timer = window.setTimeout(() => {
        timer = window.setTimeout(fire, board.reserve(Date.now()))
      }, randomInterval(Math.random))
    }
    const fire = () => {
      const plan = planSpin({ pool, current: textRef.current, taken: board.taken(id), rand: Math.random })
      if (plan) {
        board.set(id, plan.next)
        if (mode === 'swap') {
          textRef.current = plan.next
          setText(plan.next)
        } else {
          setSpin(plan)
        }
      }
      schedule()
    }
    schedule()
    return () => window.clearTimeout(timer)
  }, [running, mode, board, id, pool])

  // If the hero goes off screen or the tab is hidden mid-spin, land at once rather than freezing half way.
  if (!running && spin) {
    setText(spin.next)
    setSpin(null)
  }
  useEffect(() => {
    textRef.current = text
  }, [text])

  useLayoutEffect(() => {
    const el = strip.current
    if (!spin || !el) return
    // Strip order, top to bottom: a spare, the new text, the fillers, the old text. It starts on the old text.
    const n = spin.fillers.length + 3
    const at = (item: number) => `translateY(${((-item / n) * 100).toFixed(3)}%)`
    const anim = el.animate(
      [
        { transform: at(n - 1), easing: 'cubic-bezier(0.6, 0, 0.9, 0.5)' }, // fast ease in
        { transform: at(0.84), offset: 0.7, easing: 'cubic-bezier(0.25, 0.8, 0.35, 1)' }, // overshoot, then a springy settle
        { transform: at(1) },
      ],
      { duration: Math.round(720 + Math.random() * 160), fill: 'forwards' },
    )
    anim.onfinish = () => {
      textRef.current = spin.next
      setText(spin.next)
      setSpin(null)
    }
    return () => anim.cancel()
  }, [spin])

  const item = (t: string, key: string, ghost = false) => {
    const icon = iconFor?.(t)
    return (
      <span key={key} className={`reel-item${ghost ? ' reel-ghost' : ''}`}>
        {icon && <Icon name={icon} className="h-4 w-4 flex-none text-lime-500" />}
        <span className="reel-text">{t}</span>
      </span>
    )
  }

  return (
    <span className={`reel glass-flat ${className}`} data-align={align} data-spinning={spin ? '' : undefined}>
      <span className="sr-only">{text}</span>
      <span className="reel-clip" aria-hidden="true">
        <span ref={strip} className="reel-strip">
          {spin ? (
            <>
              <span className="reel-item" />
              {item(spin.next, 'next')}
              {spin.fillers.map((f) => item(f, `f-${f}`, true))}
              {item(text, 'old')}
            </>
          ) : (
            item(text, 'now')
          )}
        </span>
      </span>
    </span>
  )
}
