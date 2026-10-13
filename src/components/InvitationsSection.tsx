import { useEffect, useState } from 'react'
import { Spinner } from './ui'
import { call } from '../lib/portal'
import { formatDay } from '../lib/opportunities'
import { useMessages } from '../i18n/I18nProvider'

type Invitation = {
  opportunity_id: string
  title: string
  description: string
  opp_type: string
  location: string
  country: string | null
  deadline: string
  expertise_needed: string[]
  experience_level: string | null
  response: 'invited' | 'interested' | 'not_interested'
  share_contact: boolean
  open: boolean
}

/**
 * Opportunities an administrator chose this expert for. The expert answers interested or not interested,
 * and contact details are shared with the organisation only if they tick the separate box.
 */
export function InvitationsSection({ token, onSessionEnded }: { token: string; onSessionEnded: () => void }) {
  const m = useMessages()
  const t = m.dashboard.invitations
  const [items, setItems] = useState<Invitation[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [share, setShare] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [editing, setEditing] = useState<Record<string, boolean>>({})

  useEffect(() => {
    let live = true
    call<{ items: Invitation[] }>('invitations', {}, token).then((res) => {
      if (!live) return
      if (res.ok) return setItems(res.items)
      if (res.error === 'session_expired') return onSessionEnded()
      setItems([])
    })
    return () => {
      live = false
    }
  }, [token, onSessionEnded])

  const answer = async (o: Invitation, response: 'interested' | 'not_interested') => {
    setBusy(o.opportunity_id)
    setError(null)
    const sharing = response === 'interested' && (share[o.opportunity_id] ?? false)
    const res = await call('respond_invitation', { opportunity_id: o.opportunity_id, response, share_contact: sharing }, token)
    setBusy(null)
    if (!res.ok) {
      if (res.error === 'session_expired') return onSessionEnded()
      return setError(res.message)
    }
    setItems((list) => (list ?? []).map((x) => (x.opportunity_id === o.opportunity_id ? { ...x, response, share_contact: sharing } : x)))
    setEditing((e) => ({ ...e, [o.opportunity_id]: false }))
    setSaved(o.opportunity_id)
  }

  if (!items || items.length === 0) return null

  return (
    <section aria-labelledby="invites-title" className="space-y-3">
      <div>
        <h2 id="invites-title" className="text-2xl font-semibold text-green-900">{t.title}</h2>
        <p className="mt-1 text-[0.95rem] text-ink-700">{t.intro}</p>
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <ul className="space-y-3">
        {items.map((o) => {
          const answered = o.response !== 'invited' && !editing[o.opportunity_id]
          return (
            <li key={o.opportunity_id} className="card p-5" style={{ borderRadius: 'var(--radius-lg)' }}>
              <h3 className="min-w-0 break-words text-lg font-semibold text-green-900">{o.title}</h3>
              <p className="mt-1 text-sm text-ink-700">{o.opp_type} · {o.location}{o.country ? `, ${o.country}` : ''}</p>
              <p className="text-sm text-ink-500">{formatDay(o.deadline, m.meta.dateLocale)}</p>
              <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem] text-ink-900">{o.description}</p>
              <p className="mt-3 text-sm text-ink-500">
                <span className="font-bold text-ink-700">{m.dashboard.opportunities.needed}</span>
                {o.expertise_needed.map((x) => (m.options.expertise as Record<string, string>)[x] ?? x).join(', ')}
              </p>
              {o.experience_level && (
                <p className="text-sm text-ink-500">
                  <span className="font-bold text-ink-700">{t.level}</span>
                  {o.experience_level}
                </p>
              )}

              {!o.open ? (
                <p className="mt-3 text-sm font-semibold text-ink-700">{t.closedNote}</p>
              ) : answered ? (
                <div className="mt-4 space-y-1">
                  <p className="text-sm font-bold text-green-800" role={saved === o.opportunity_id ? 'status' : undefined}>
                    {o.response === 'interested' ? t.saidInterested : t.saidNot}
                  </p>
                  {o.response === 'interested' && <p className="text-sm text-ink-700">{o.share_contact ? t.contactShared : t.contactPrivate}</p>}
                  {saved === o.opportunity_id && <p className="text-sm text-ink-500">{t.saved}</p>}
                  <button className="btn btn-ghost !min-h-11" onClick={() => setEditing((e) => ({ ...e, [o.opportunity_id]: true }))}>{t.change}</button>
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  <label className="choice" data-checked={share[o.opportunity_id] ?? false}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={share[o.opportunity_id] ?? false}
                      onChange={(e) => setShare((s) => ({ ...s, [o.opportunity_id]: e.target.checked }))}
                    />
                    <span className="choice-mark choice-check" aria-hidden="true" />
                    <span className="flex-1 text-[0.95rem]">{t.shareContact}</span>
                  </label>
                  <div className="flex flex-wrap gap-3">
                    <button className="btn btn-primary w-full sm:w-auto" disabled={busy === o.opportunity_id} onClick={() => void answer(o, 'interested')}>
                      {busy === o.opportunity_id ? <Spinner label={m.dashboard.saving} /> : t.interested}
                    </button>
                    <button className="btn btn-ghost w-full sm:w-auto" disabled={busy === o.opportunity_id} onClick={() => void answer(o, 'not_interested')}>
                      {t.notInterested}
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
