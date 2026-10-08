import { isStatus, STATUS_LABEL, type VStatus } from '../lib/verification'

const STYLE: Record<VStatus, string> = {
  pending: 'bg-line text-ink-700',
  under_review: 'bg-blue-100 text-blue-700',
  more_evidence: 'bg-warn-100 text-[#7a4b00]',
  verified: 'bg-green-100 text-green-800',
  not_verified: 'bg-danger-100 text-danger-600',
}

/** Each status has its own icon as well as colour, so it never depends on colour alone. */
function Icon({ status }: { status: VStatus }) {
  const common = { viewBox: '0 0 16 16', className: 'h-3.5 w-3.5 flex-none', fill: 'none', 'aria-hidden': true } as const
  switch (status) {
    case 'verified':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m3.5 8.5 3 3 6-7" />
        </svg>
      )
    case 'not_verified':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="m4 4 8 8M12 4l-8 8" />
        </svg>
      )
    case 'under_review':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.2 1.4" />
        </svg>
      )
    case 'more_evidence':
      return (
        <svg {...common} stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M8 3v7" />
          <circle cx="8" cy="12.7" r="0.6" fill="currentColor" />
        </svg>
      )
    default:
      return (
        <svg {...common} stroke="currentColor" strokeWidth="1.8">
          <circle cx="8" cy="8" r="5.5" strokeDasharray="2.5 2.5" />
        </svg>
      )
  }
}

export function StatusBadge({ status, className = '' }: { status: string; className?: string }) {
  const s: VStatus = isStatus(status) ? status : 'pending'
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STYLE[s]} ${className}`}
    >
      <Icon status={s} />
      {STATUS_LABEL[s]}
    </span>
  )
}
