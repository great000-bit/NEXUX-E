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
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-[var(--radius-md)] border px-4 py-3 text-sm ${styles}`}>
      {title && <p className="font-bold">{title}</p>}
      <div className={title ? 'mt-0.5 font-medium' : 'font-medium'}>{children}</div>
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
