import { useId } from 'react'

type Props = {
  /** 'full' shows the emblem and wordmark. 'mark' shows the emblem only. */
  variant?: 'full' | 'mark'
  className?: string
  /** Use the light emblem and wordmark on dark backgrounds. */
  onDark?: boolean
}

/** Emblem rebuilt as vector from the conference flier. Crisp at any size. */
const PALETTE = {
  light: {
    bodyFrom: '#0a663f', bodyTo: '#06361e',
    blueFrom: '#2a9be6', blueTo: '#0b6fc2',
    leafFrom: '#0a663f', leafTo: '#1f8a4f',
    vein: '#a9cf7e', head: '#0a663f', ring: '#0a663f',
  },
  // The same emblem lifted for dark backgrounds: the deep greens become light mint and lime so nothing disappears.
  dark: {
    bodyFrom: '#e6f2d0', bodyTo: '#9fd0a6',
    blueFrom: '#6cc3ff', blueTo: '#2b9cf0',
    leafFrom: '#62aa2a', leafTo: '#c5dc3f',
    vein: '#f3fbd3', head: '#c5dc3f', ring: '#06361e',
  },
} as const

export function Emblem({ className, onDark = false, decorative = false }: { className?: string; onDark?: boolean; decorative?: boolean }) {
  const id = useId().replace(/:/g, '')
  const p = onDark ? PALETTE.dark : PALETTE.light
  return (
    <svg viewBox="0 0 170 215" className={className} role={decorative ? undefined : "img"} aria-label={decorative ? undefined : "NEXUS-E emblem"} aria-hidden={decorative ? true : undefined}>
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.bodyFrom} />
          <stop offset="1" stopColor={p.bodyTo} />
        </linearGradient>
        <linearGradient id={`${id}-blue`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.blueFrom} />
          <stop offset="1" stopColor={p.blueTo} />
        </linearGradient>
        <linearGradient id={`${id}-leaf`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor={p.leafFrom} />
          <stop offset="1" stopColor={p.leafTo} />
        </linearGradient>
        <clipPath id={`${id}-globe`}>
          <circle cx="82" cy="132" r="31" />
        </clipPath>
      </defs>
      <path d="M60 98C62 52 100 14 163 4C160 56 122 96 60 98Z" fill={`url(#${id}-leaf)`} />
      <path d="M66 94C92 66 122 38 156 10" stroke={p.vein} strokeWidth="2.2" strokeLinecap="round" fill="none" opacity=".85" />
      <path d="M138 78C158 120 146 170 92 206C128 166 136 124 118 92C126 90 132 85 138 78Z" fill={`url(#${id}-blue)`} />
      <path d="M44 100C14 114 2 152 18 182C32 208 66 214 92 206C58 202 34 184 32 154C30 130 36 112 44 100Z" fill={`url(#${id}-body)`} />
      <circle cx="28" cy="80" r="12" fill={p.head} />
      <circle cx="82" cy="132" r="33" fill="#fff" />
      <circle cx="82" cy="132" r="31" fill="#cfe9f8" />
      <g clipPath={`url(#${id}-globe)`} fill="#1f8a4f">
        <path d="M62 112c8-8 20-8 24-2 3 5-3 9 1 14s-4 10-10 8-6 6-12 4-9-12-3-24Z" />
        <path d="M92 138c6-4 14-2 18 4s-2 16-10 18-12-8-8-22Z" />
        <path d="M70 150c6 2 10 8 8 14s-12 6-14-2 0-10 6-12Z" />
      </g>
      <circle cx="82" cy="132" r="31" fill="none" stroke={p.ring} strokeWidth="2.2" />
    </svg>
  )
}

export function Logo({ variant = 'full', className = '', onDark = false }: Props) {
  if (variant === 'mark') return <Emblem className={className} onDark={onDark} />
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Emblem className="h-11 w-auto shrink-0 sm:h-12" onDark={onDark} decorative />
      <div className="leading-none">
        <div className="font-display text-[1.55rem] font-bold sm:text-[1.7rem]" style={{ letterSpacing: '-0.04em' }}>
          <span className={onDark ? 'text-white' : 'text-green-900'}>NEXUS</span>
          <span className={onDark ? 'text-lime-500' : 'text-blue-600'}>-E</span>
          <sup className={`ml-0.5 align-top text-[0.5rem] font-bold ${onDark ? 'text-white/70' : 'text-green-800'}`}>TM</sup>
        </div>
        <div className={`mt-1 hidden text-[0.58rem] font-semibold uppercase tracking-[0.14em] sm:block ${onDark ? 'text-white/70' : 'text-ink-500'}`}>
          African Environmental
          <br />
          Expertise Exchange
        </div>
      </div>
    </div>
  )
}
