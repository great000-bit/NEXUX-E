import { STATUS_WORDS, type OppStatus } from '../lib/opportunities'

const STYLE = {
  draft: 'bg-line text-ink-700',
  open: 'bg-green-100 text-green-800',
  expired: 'bg-warn-100 text-[#7a4b00]',
  closed: 'bg-danger-100 text-danger-600',
} as const

/** Draft, Open, Open but past its deadline, or Closed. The words carry the meaning, so colour is never alone. */
export function OppBadge({ status, expired = false }: { status: OppStatus; expired?: boolean }) {
  const key = status === 'open' && expired ? 'expired' : status
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${STYLE[key]}`}>
      {STATUS_WORDS[key]}
    </span>
  )
}
