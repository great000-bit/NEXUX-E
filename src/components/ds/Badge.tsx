import type { ReactNode } from 'react'

export { VerifiedBadge } from '../VerifiedBadge'

/** A neutral label. Use VerifiedBadge for verified experts. */
export function Badge({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-white/10 px-2.5 py-1 text-xs font-bold text-green-900 ring-1 ring-inset ring-white/15 ${className}`.trim()}>
      {children}
    </span>
  )
}
