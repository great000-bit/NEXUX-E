import type { ReactNode } from 'react'
import { Icon } from '../icons'

/** A short confirmation. Solid night green so it reads on both the dark shell and a light panel. */
export function Toast({ children }: { children: ReactNode }) {
  return (
    <div
      role="status"
      className="toast flex items-start gap-3 rounded-[var(--radius-md)] border border-lime-500/30 bg-night-800 px-4 py-3 text-sm font-semibold text-white shadow-lg"
    >
      <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-lime-500 text-green-950">
        <Icon name="check" className="h-3.5 w-3.5" strokeWidth={2.6} />
      </span>
      <span className="min-w-0">{children}</span>
    </div>
  )
}
