import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { EXPERT_ID_KEY } from '../lib/form'
import { Emblem } from '../components/Logo'

function readId(state: unknown): string | null {
  const fromState = (state as { expertId?: string } | null)?.expertId
  if (fromState) return fromState
  try {
    return sessionStorage.getItem(EXPERT_ID_KEY)
  } catch {
    return null
  }
}

export default function Registered() {
  const { state } = useLocation()
  const [expertId] = useState(() => readId(state))
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  if (!expertId) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <Emblem className="mx-auto h-16 w-auto opacity-60" />
        <h1 className="mt-5 text-2xl font-semibold text-green-900">No registration found</h1>
        <p className="mt-2 text-ink-700">
          We could not find a recent registration on this device. If you registered before, check your email for your
          Expert ID.
        </p>
        <Link to="/register" className="btn btn-primary mt-7 w-full">Start registration</Link>
      </div>
    )
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(expertId)
      setCopied('copied')
    } catch {
      // Older mobile browsers: fall back to selecting the text for a manual copy.
      const node = document.getElementById('expert-id')
      if (node) {
        const range = document.createRange()
        range.selectNodeContents(node)
        const sel = window.getSelection()
        sel?.removeAllRanges()
        sel?.addRange(range)
      }
      setCopied('failed')
    }
    window.setTimeout(() => setCopied('idle'), 2400)
  }

  return (
    <div className="mx-auto max-w-lg text-center">
      <div className="pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-green-500/15">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-green-700" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-6 text-3xl font-semibold text-green-900 sm:text-4xl">You are registered</h1>
      <p className="mt-3 text-ink-700">Welcome to the founding experts of NEXUS-E. Keep your Expert ID safe.</p>

      <section
        aria-labelledby="id-label"
        className="relative mt-8 overflow-hidden rounded-[var(--radius-xl)] bg-green-900 px-6 py-8 text-white shadow-lg"
      >
        <div aria-hidden="true" className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-green-700/60 blur-2xl" />
        <p id="id-label" className="relative text-xs font-bold uppercase tracking-[0.22em] text-lime-500">
          Your Expert ID
        </p>
        <p
          id="expert-id"
          className="relative mt-3 select-all font-display text-[2.4rem] font-semibold tracking-wide sm:text-5xl"
          style={{ fontVariantNumeric: 'lining-nums tabular-nums' }}
        >
          {expertId}
        </p>
        <button type="button" onClick={copy} className="btn btn-accent relative mt-6 w-full sm:w-auto sm:px-8">
          {copied === 'copied' ? (
            <>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
                <path d="m4 10.5 4 4L16 6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Copied
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="7" y="7" width="9" height="9" rx="2" />
                <path d="M4 13V5a1 1 0 0 1 1-1h8" strokeLinecap="round" />
              </svg>
              Copy Expert ID
            </>
          )}
        </button>
        <p className="sr-only" role="status" aria-live="polite">
          {copied === 'copied' ? 'Expert ID copied to clipboard' : copied === 'failed' ? 'Copy failed. The ID is selected, press copy on your device.' : ''}
        </p>
        {copied === 'failed' && (
          <p className="relative mt-3 text-sm text-white/80">Copy was blocked. The ID is selected so you can copy it manually.</p>
        )}
      </section>

      <section className="mt-6 rounded-[var(--radius-lg)] bg-green-100 p-6 text-left">
        <h2 className="text-xl font-semibold text-green-900">Next: complete your verification</h2>
        <p className="mt-2 text-[0.95rem] text-ink-700">
          Complete verification to earn Verified Expert status. After the conference we will invite you to confirm your membership, licence and credentials using your Expert ID. There is nothing more to do today.
        </p>
      </section>

      <Link to="/" className="btn btn-ghost mt-8">Back to home</Link>
    </div>
  )
}
