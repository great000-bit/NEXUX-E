import { useId } from 'react'

type Props = {
  /** 'full' shows the emblem and wordmark. 'mark' shows the emblem only. */
  variant?: 'full' | 'mark'
  className?: string
  /** Use the light wordmark on dark backgrounds. */
  onDark?: boolean
}

/** Emblem rebuilt as vector from the conference flier. Crisp at any size. */
export function Emblem({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 170 215" className={className} role="img" aria-label="NEXUS-E emblem">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0a663f" />
          <stop offset="1" stopColor="#06361e" />
        </linearGradient>
        <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2a9be6" />
          <stop offset="1" stopColor="#0b6fc2" />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#0a663f" />
          <stop offset="1" stopColor="#1f8a4f" />
        </linearGradient>
        <clipPath id={`${id}-globe`}>
          <circle cx="82" cy="132" r="31" />
        </clipPath>
      </defs>
      <path d="M60 98C62 52 100 14 163 4C160 56 122 96 60 98Z" fill={`url(#${id}-leaf)`} />
      <path d="M66 94C92 66 122 38 156 10" stroke="#a9cf7e" strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M138 78C158 120 146 170 92 206C128 166 136 124 118 92C126 90 132 85 138 78Z" fill={`url(#${id}-blue)`} />
      <path d="M44 100C14 114 2 152 18 182C32 208 66 214 92 206C58 202 34 184 32 154C30 130 36 112 44 100Z" fill={`url(#${id}-body)`} />
      <circle cx="28" cy="80" r="12" fill="#0a663f" />
      <circle cx="82" cy="132" r="33" fill="#fff" />
      <circle cx="82" cy="132" r="31" fill="#cfe9f8" />
      <g clipPath={`url(#${id}-globe)`} fill="#1f8a4f">
        <path d="M62 112c8-8 20-8 24-2 3 5-3 9 1 14s-4 10-10 8-6 6-12 4-9-12-3-24Z" />
        <path d="M92 138c6-4 14-2 18 4s-2 16-10 18-12-8-8-22Z" />
        <path d="M70 150c6 2 10 8 8 14s-12 6-14-2 0-10 6-12Z" />
      </g>
      <circle cx="82" cy="132" r="31" fill="none" stroke="#0a663f" strokeWidth="2.2" />
    </svg>
  )
}

export function Logo({ variant = 'full', className = '', onDark = false }: Props) {
  if (variant === 'mark') return <Emblem className={className} />
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Emblem className="h-12 w-auto shrink-0" />
      <div className="leading-none">
        <div
          className="font-sans text-[1.75rem] font-extrabold tracking-tight"
          style={{ letterSpacing: '-0.03em' }}
        >
          <span className={onDark ? 'text-white' : 'text-green-900'}>NEXUS</span>
          <span className={onDark ? 'text-lime-500' : 'text-blue-600'}>-E</span>
          <sup className={`ml-0.5 align-top text-[0.55rem] font-bold ${onDark ? 'text-white/70' : 'text-green-800'}`}>TM</sup>
        </div>
        <div className={`mt-1 text-[0.62rem] font-semibold uppercase tracking-[0.12em] ${onDark ? 'text-white/75' : 'text-ink-500'}`}>
          Nigerian Environmental
          <br />
          Expertise Exchange
        </div>
      </div>
    </div>
  )
}
