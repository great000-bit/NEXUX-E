import type { ReactNode } from 'react'

/** A home page section with one consistent rhythm: eyebrow, heading, lead, then content. */
export function Section({
  id,
  eyebrow,
  title,
  lead,
  children,
  className = '',
}: {
  id?: string
  eyebrow?: string
  title: string
  lead?: ReactNode
  children?: ReactNode
  className?: string
}) {
  const headingId = id ? `${id}-title` : undefined
  return (
    <section id={id} aria-labelledby={headingId} className={`mx-auto w-full max-w-6xl scroll-mt-28 px-5 py-14 sm:px-8 sm:py-24 ${className}`.trim()}>
      <div className="max-w-2xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 id={headingId} className="t-h2 mt-3">{title}</h2>
        {lead && <p className="t-lead mt-4">{lead}</p>}
      </div>
      {children}
    </section>
  )
}
