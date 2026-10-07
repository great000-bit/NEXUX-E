import type { ReactNode } from 'react'

export function Spinner({ label = 'Loading', className = 'h-5 w-5' }: { label?: string; className?: string }) {
  return (
    <span role="status" className="inline-flex items-center">
      <svg className={`spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="sr-only">{label}</span>
    </span>
  )
}

export function Notice({
  tone = 'error',
  title,
  children,
}: {
  tone?: 'error' | 'info' | 'success'
  title?: string
  children: ReactNode
}) {
  const styles = {
    error: 'border-danger-600/30 bg-danger-100 text-danger-600',
    info: 'border-blue-600/25 bg-blue-100 text-blue-700',
    success: 'border-green-600/25 bg-green-50 text-green-800',
  }[tone]
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-3 rounded-[var(--radius-md)] border px-4 py-3 text-sm ${styles}`}>
      {tone === 'error' && <AlertIcon className="mt-0.5 h-4 w-4 flex-none" />}
      <div className="min-w-0">
        {title && <p className="font-bold">{title}</p>}
        <div className={title ? 'mt-0.5 font-medium' : 'font-medium'}>{children}</div>
      </div>
    </div>
  )
}

export function ProgressBar({ step, total, labels }: { step: number; total: number; labels: string[] }) {
  const pct = ((step + 1) / total) * 100
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-bold text-green-900">
          Step {step + 1} of {total}
        </span>
        <span className="font-medium text-ink-500">{labels[step]}</span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-green-100"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label="Registration progress"
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-green-700 to-green-500"
          style={{ width: `${pct}%`, transition: 'width 450ms var(--ease)' }}
        />
      </div>
    </div>
  )
}

function AlertIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M10 5.5v5.2" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
      <circle cx="10" cy="14" r="1.1" fill="#fff" />
    </svg>
  )
}

/**
 * Lists exactly what to fix, with links that jump to each field.
 * Rendered only while there is something to fix, so it disappears as soon as everything is right.
 */
export function ErrorSummary({
  items,
  note,
  onJump,
}: {
  items: { key: string; label: string; anchor: string }[]
  note?: string | null
  onJump: (anchor: string) => void
}) {
  if (items.length === 0) return null
  const n = items.length
  return (
    <div
      role="alert"
      data-testid="error-summary"
      className="rounded-[var(--radius-md)] border-2 border-danger-600 bg-danger-100 p-4"
    >
      <div className="flex gap-3">
        <AlertIcon className="mt-0.5 h-5 w-5 flex-none text-danger-600" />
        <div className="min-w-0">
          <p className="font-bold text-danger-600">
            Please fix {n} {n === 1 ? 'thing' : 'things'} below to continue
          </p>
          {note && <p className="mt-1 text-sm font-medium text-ink-900">{note}</p>}
          <ul className="mt-2 space-y-1 text-[0.95rem]">
            {items.map((i) => (
              <li key={i.key}>
                <a
                  href={`#field-${i.anchor}`}
                  className="font-semibold text-ink-900 underline decoration-danger-600 decoration-2 underline-offset-4 hover:text-danger-600"
                  onClick={(e) => {
                    e.preventDefault()
                    onJump(i.anchor)
                  }}
                >
                  {i.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}
