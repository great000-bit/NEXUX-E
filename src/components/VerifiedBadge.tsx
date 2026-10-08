/** The Verified Expert mark. It has an icon as well as colour, so it never depends on colour alone. */
export function VerifiedBadge({ className = '' }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-800 ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 flex-none" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="m3.5 8.5 3 3 6-7" />
      </svg>
      Verified Expert
    </span>
  )
}
