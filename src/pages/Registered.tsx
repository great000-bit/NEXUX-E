import { usePageInfo } from '../lib/pageInfo'
import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { EXPERT_ID_KEY } from '../lib/form'
import { Emblem } from '../components/Logo'
import { useMessages } from '../i18n/I18nProvider'

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
  const t = useMessages().registered
  usePageInfo({ title: t.pageTitle, noindex: true })
  const [expertId] = useState(() => readId(state))
  const [copied, setCopied] = useState<'idle' | 'copied' | 'failed'>('idle')

  if (!expertId) {
    return (
      <div className="card mx-auto max-w-md p-8 text-center">
        <Emblem className="mx-auto h-16 w-auto opacity-60" />
        <h1 className="mt-5 text-2xl font-semibold text-green-900">{t.noneTitle}</h1>
        <p className="mt-2 text-ink-700">{t.noneText}</p>
        <Link to="/register" className="btn btn-primary mt-7 w-full">{t.start}</Link>
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
      <div className="pop mx-auto grid h-16 w-16 place-items-center rounded-full bg-lime-500/15 ring-1 ring-lime-500/40">
        <svg viewBox="0 0 24 24" className="h-9 w-9 text-lime-500" fill="none" stroke="currentColor" strokeWidth="2.6" aria-hidden="true">
          <path d="m5 12.5 4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <h1 className="mt-6 text-3xl font-semibold text-green-900 sm:text-4xl">{t.title}</h1>
      <p className="mt-3 text-ink-700">{t.welcome}</p>

      <section
        aria-labelledby="id-label"
        className="glass relative mt-8 overflow-hidden rounded-[var(--radius-xl)] px-6 py-8 text-white"
      >
        <div aria-hidden="true" className="absolute -end-10 -top-10 h-36 w-36 rounded-full bg-lime-500/20 blur-2xl" />
        <p id="id-label" className="relative text-xs font-bold uppercase tracking-[0.22em] text-lime-500">
          {t.idLabel}
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
              {t.copied}
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <rect x="7" y="7" width="9" height="9" rx="2" />
                <path d="M4 13V5a1 1 0 0 1 1-1h8" strokeLinecap="round" />
              </svg>
              {t.copy}
            </>
          )}
        </button>
        <p className="sr-only" role="status" aria-live="polite">
          {copied === 'copied' ? t.copiedSr : copied === 'failed' ? t.copyFailedSr : ''}
        </p>
        {copied === 'failed' && (
          <p className="relative mt-3 text-sm text-white/80">{t.copyBlocked}</p>
        )}
      </section>

      <section className="theme-light mt-6 rounded-[var(--radius-lg)] bg-green-100 p-6 text-start">
        <h2 className="text-xl font-semibold text-green-900">{t.nextTitle}</h2>
        <p className="mt-2 text-[0.95rem] text-ink-700">{t.nextText}</p>
      </section>

      <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
        <Link to="/verify" className="btn btn-primary w-full sm:w-auto">{t.verify}</Link>
        <Link to="/" className="btn btn-ghost w-full sm:w-auto">{t.home}</Link>
      </div>
    </div>
  )
}
