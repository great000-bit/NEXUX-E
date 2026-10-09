import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice, Spinner } from './ui'
import { call } from '../lib/portal'
import { useMessages } from '../i18n/I18nProvider'

/**
 * Lets a signed-in expert choose whether they are in the public directory.
 * Being listed also needs Verified status, and the card says so plainly.
 */
export function ListingCard({
  expertId,
  verified,
  listed,
  token,
  onChanged,
  onSessionEnded,
}: {
  expertId: string
  verified: boolean
  /** The expert's current choice (discoverable). */
  listed: boolean
  token: string
  onChanged: () => Promise<void>
  onSessionEnded: () => void
}) {
  const t = useMessages().dashboard.listing
  const common = useMessages().dashboard
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const change = async (value: boolean) => {
    setError(null)
    setDone(null)
    setSaving(true)
    const res = await call('set_discoverable', { value }, token)
    if (!res.ok) {
      setSaving(false)
      if (res.error === 'session_expired') return onSessionEnded()
      return setError(res.message)
    }
    await onChanged()
    setSaving(false)
    setDone(value ? (verified ? t.doneLive : t.donePending) : t.doneRemoved)
  }

  const live = listed && verified

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="listing-title">
      <h2 id="listing-title" className="text-xl font-semibold text-green-900">{t.title}</h2>
      <p className="mt-1 text-[0.95rem] font-semibold text-ink-900" role="status">
        {live && t.live}
        {listed && !verified && t.pending}
        {!listed && t.notListed}
      </p>

      <div className="mt-3 rounded-[var(--radius-md)] bg-green-50 p-4 text-[0.95rem] text-ink-700">
        <p className="font-bold text-green-900">{t.seeTitle}</p>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          {t.sees.map((line) => <li key={line}>{line}</li>)}
        </ul>
        <p className="mt-3 font-bold text-green-900">{t.never}</p>
        <p className="mt-1">{t.onlyVerified}</p>
      </div>

      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {done && <div className="mt-3"><Notice tone="success">{done}</Notice></div>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {listed ? (
          <button className="btn btn-ghost w-full sm:w-auto" onClick={() => void change(false)} disabled={saving}>
            {saving ? (<><Spinner label={common.saving} /> {common.saving}</>) : t.remove}
          </button>
        ) : (
          <button className="btn btn-primary w-full sm:w-auto" onClick={() => void change(true)} disabled={saving}>
            {saving ? (<><Spinner label={common.saving} /> {common.saving}</>) : t.list}
          </button>
        )}
        {live && (
          <Link to={`/experts/${expertId}`} className="inline-flex min-h-11 items-center font-bold text-green-800 underline underline-offset-4">
            {t.viewPage}
          </Link>
        )}
      </div>
    </section>
  )
}
