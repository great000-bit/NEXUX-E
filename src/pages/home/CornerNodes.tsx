import { Link } from 'react-router-dom'
import { Icon } from '../../components/icons'
import { HERO_NODES } from './content'

const SIDE: Record<'tl' | 'tr' | 'bl' | 'br', 'left' | 'right'> = { tl: 'left', bl: 'left', tr: 'right', br: 'right' }

/**
 * Four expertise nodes on thin lines that curve toward the centre, as in the reference composition.
 * Tablet and desktop only: phones get the same four as chips. The lines draw in on load and the nodes
 * float a few pixels at different depths. Each node links to the expertise section.
 */
export function CornerNodes() {
  return (
    <div className="hero-nodes hidden md:block" aria-label="Areas of expertise">
      <svg className="hero-lines" viewBox="0 0 1000 600" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 66H190C240 66 275 46 322 20" pathLength="1" />
        <path d="M1000 66H810C760 66 725 46 678 20" pathLength="1" />
        <path d="M0 396H190C240 396 275 424 322 458" pathLength="1" />
        <path d="M1000 396H810C760 396 725 424 678 458" pathLength="1" />
      </svg>

      {HERO_NODES.map((n, i) => (
        <Link key={n.corner} to="/#expertise" className={`hero-node hero-node-${n.corner}`} data-depth={i} data-side={SIDE[n.corner]}>
          <span className="hero-node-float">
            <span className="hero-node-icon glass-flat">
              <Icon name={n.icon} className="h-[1.15rem] w-[1.15rem]" strokeWidth={1.7} />
            </span>
            <span className="hero-node-label">
              <span className="hero-node-name">{n.label}</span>
              <span className="hero-node-sub">Expertise area</span>
            </span>
          </span>
        </Link>
      ))}
    </div>
  )
}
