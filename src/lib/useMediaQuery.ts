import { useEffect, useState } from 'react'

/** True while the media query matches. Lets the hero mount only the layout that is on screen. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const update = () => setMatches(mq.matches)
    mq.addEventListener('change', update)
    update()
    return () => mq.removeEventListener('change', update)
  }, [query])
  return matches
}
