import { useEffect, useState } from 'react'
import { heroMotionAllowed, readMotionInputs, reelMode, type ReelMode } from '../../lib/motion'

export type HeroMotion = {
  /** True while the hero may animate. Turns off if the tab is hidden or the device is cautious. */
  motion: boolean
  /** How the text reels behave (spin, instant swap, or still). */
  reels: ReelMode
  /** The tab is in the background: every hero animation is paused in place (and picks up again when it returns). */
  hidden: boolean
}

const read = (): HeroMotion => {
  const inputs = readMotionInputs()
  // A hidden tab pauses the hero rather than switching motion off, so coming back never replays the entrance.
  return { motion: heroMotionAllowed({ ...inputs, hidden: false }), reels: reelMode(inputs), hidden: inputs.hidden }
}

export function useHeroMotion(): HeroMotion {
  const [state, setState] = useState(read)

  useEffect(() => {
    const update = () => {
      const next = read()
      setState((s) => (s.motion === next.motion && s.reels === next.reels && s.hidden === next.hidden ? s : next))
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
