import type { ElementType, HTMLAttributes, ReactNode } from 'react'

type Props = HTMLAttributes<HTMLElement> & {
  as?: ElementType
  /** Skip the backdrop blur. Use this for grids and lists so phones stay smooth. */
  flat?: boolean
  /** Lift a little on hover. */
  hover?: boolean
  children: ReactNode
}

/** A frosted container for marketing content on the dark shell. Never use it for form fields. */
export function GlassCard({ as: Tag = 'div', flat = false, hover = false, className = '', children, ...rest }: Props) {
  return (
    <Tag
      className={`${flat ? 'glass-flat' : 'glass'} ${hover ? 'glass-hover' : ''} rounded-[var(--radius-xl)] p-6 ${className}`.trim()}
      {...rest}
    >
      {children}
    </Tag>
  )
}
