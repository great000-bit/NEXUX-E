import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Notice, Spinner } from './ui'
import { call } from '../lib/portal'

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
    setDone(
      value
        ? verified
          ? 'You are now listed in the public directory.'
          : 'Your choice is saved. You will appear in the directory once you are Verified.'
        : 'You have been removed from the public directory. Your public page no longer opens.',
    )
  }

  const live = listed && verified

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="listing-title">
      <h2 id="listing-title" className="text-xl font-semibold text-green-900">Your public listing</h2>
      <p className="mt-1 text-[0.95rem] font-semibold text-ink-900" role="status">
        {live && 'You are listed in the public directory.'}
        {listed && !verified && 'You have chosen to be listed. You will appear once you are Verified.'}
        {!listed && 'You are not listed in the public directory.'}
      </p>

      <div className="mt-3 rounded-[var(--radius-md)] bg-green-50 p-4 text-[0.95rem] text-ink-700">
        <p className="font-bold text-green-900">If you are listed, anyone can see:</p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>Your title and name, your position and organisation, and your state</li>
          <li>Your primary and secondary expertise, years of experience and highest qualification</li>
          <li>Your professional memberships and the kinds of assignment you are open to</li>
          <li>How far you can work, and your profile link if you gave one</li>
          <li>A Verified Expert badge</li>
        </ul>
        <p className="mt-3 font-bold text-green-900">Nobody can ever see your phone number, your email address or your documents.</p>
        <p className="mt-1">
          Only Verified Experts are listed. You can change your mind at any time, and your public page stops opening straight away.
        </p>
      </div>

      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {done && <div className="mt-3"><Notice tone="success">{done}</Notice></div>}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {listed ? (
          <button className="btn btn-ghost w-full sm:w-auto" onClick={() => void change(false)} disabled={saving}>
            {saving ? (<><Spinner label="Saving" /> Saving</>) : 'Remove me from the directory'}
          </button>
        ) : (
          <button className="btn btn-primary w-full sm:w-auto" onClick={() => void change(true)} disabled={saving}>
            {saving ? (<><Spinner label="Saving" /> Saving</>) : 'List me in the directory'}
          </button>
        )}
        {live && (
          <Link to={`/experts/${expertId}`} className="inline-flex min-h-11 items-center font-bold text-green-800 underline underline-offset-4">
            View my public page
          </Link>
        )}
      </div>
    </section>
  )
}
