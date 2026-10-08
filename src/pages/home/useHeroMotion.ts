import { useEffect, useState } from 'react'
import { heroMotionAllowed, readMotionInputs, reelMode, type ReelMode } from '../../lib/motion'

export type HeroMotion = {
  /** True while the hero may animate. Turns off if the tab is hidden or the device is cautious. */
  motion: boolean
  /** How the text reels behave (spin, instant swap, or still). */
  reels: ReelMode
}

const read = (): HeroMotion => {
  const inputs = readMotionInputs()
  return { motion: heroMotionAllowed(inputs), reels: reelMode(inputs) }
}

export function useHeroMotion(): HeroMotion {
  const [state, setState] = useState(read)

  useEffect(() => {
    const update = () => {
      const next = read()
      setState((s) => (s.motion === next.motion && s.reels === next.reels ? s : next))
    }
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    document.addEventListener('visibilitychange', update)
    mq.addEventListener('change', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      mq.removeEventListener('change', update)
    }
  }, [])

  return state
}
