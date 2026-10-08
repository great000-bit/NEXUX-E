import { Link } from 'react-router-dom'
import { EXPERTISE_ICON } from '../../components/icons'
import type { ReelMode } from '../../lib/motion'
import type { ReelBoard } from '../../lib/reels'
import { EXPERTISE } from '../../lib/options'
import { HERO_NODES } from './content'
import { Reel } from './Reel'

const SIDE: Record<'tl' | 'tr' | 'bl' | 'br', 'start' | 'end'> = { tl: 'start', bl: 'start', tr: 'end', br: 'end' }
export const iconForExpertise = (t: string) => EXPERTISE_ICON[t]

/**
 * Four expertise nodes on thin lines that curve toward the centre, as in the reference composition.
 * Tablet and desktop only: phones get four chips instead. Each label is a reel that changes on its own timer.
 * Each node links to the expertise section.
 */
export function CornerNodes({ board, mode, active, lower }: { board: ReelBoard; mode: ReelMode; active: boolean; lower: boolean }) {
  // Tablets get the two upper nodes only: below the headline there is no room for the lower pair.
  const nodes = lower ? HERO_NODES : HERO_NODES.filter((x) => x.corner === 'tl' || x.corner === 'tr')
  return (
    <div className="hero-nodes" aria-label="Areas of expertise">
      <svg className="hero-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 33H190C240 33 275 22 322 6" pathLength="1" />
        <path d="M1000 33H810C760 33 725 22 678 6" pathLength="1" />
        {lower && <path d="M0 420H190C240 420 275 446 322 476" pathLength="1" />}
        {lower && <path d="M1000 420H810C760 420 725 446 678 476" pathLength="1" />}
      </svg>

      {nodes.map((n, i) => (
        <Link key={n.corner} to="/#expertise" className={`hero-node hero-node-${n.corner}`} data-depth={i} data-side={SIDE[n.corner] === 'start' ? 'left' : 'right'}>
          <span className="hero-node-float">
            <span className="hero-node-dot" aria-hidden="true" />
            <span className="hero-node-label">
              <Reel
                id={`node-${n.corner}`}
                board={board}
                pool={EXPERTISE}
                initial={n.label}
                iconFor={iconForExpertise}
                mode={mode}
                active={active}
                align={SIDE[n.corner]}
                className="reel-node"
              />
              <span className="hero-node-sub">Expertise area</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
