import type { ReactNode } from 'react'
import { Icon, type IconName } from '../icons'

/** A small glass pill for a label, such as an area of expertise. */
export function Chip({ icon, children, className = '' }: { icon?: IconName; children: ReactNode; className?: string }) {
  return (
    <span className={`chip ${className}`.trim()}>
      {icon && <Icon name={icon} className="h-4 w-4 flex-none text-lime-500" />}
      {children}
    </span>
  )
}
