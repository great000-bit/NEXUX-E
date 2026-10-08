import { useEffect, useState } from 'react'
import { heroMotionAllowed, readMotionInputs } from '../../lib/motion'

/** True while the hero may animate. Turns off if the tab is hidden or the person asks for less motion. */
export function useHeroMotion(): boolean {
  const [on, setOn] = useState(() => heroMotionAllowed(readMotionInputs()))

  useEffect(() => {
    const update = () => setOn(heroMotionAllowed(readMotionInputs()))
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    document.addEventListener('visibilitychange', update)
    mq.addEventListener('change', update)
    return () => {
      document.removeEventListener('visibilitychange', update)
      mq.removeEventListener('change', update)
    }
  }, [])

  return on
}
