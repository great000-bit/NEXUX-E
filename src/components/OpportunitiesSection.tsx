import { useEffect, useState } from 'react'
import { Notice, Spinner } from './ui'
import { call } from '../lib/portal'
import { daysLeft, formatDay, type ExpertOpportunity } from '../lib/opportunities'
import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'

type Loaded = { token: string; verified: boolean; items: ExpertOpportunity[] } | { token: string; error: string }

/** Open opportunities for a signed-in expert. Matching ones come first, and say why. */
export function OpportunitiesSection({ token, onSessionEnded }: { token: string; onSessionEnded: () => void }) {
  const m = useMessages()
  const t = m.dashboard.opportunities
  const note = (deadline: string) => {
    const d = daysLeft(deadline)
    return d < 0 ? t.closed : d === 0 ? t.closesToday : d === 1 ? t.oneDayLeft : fmt(t.daysLeft, { n: d })
  }
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState<Record<string, string>>({})

  useEffect(() => {
    let live = true
    call<{ verified: boolean; items: ExpertOpportunity[] }>('opportunities', {}, token).then((res) => {
      if (!live) return
      if (res.ok) return setLoaded({ token, verified: res.verified, items: res.items })
      if (res.error === 'session_expired') return onSessionEnded()
      setLoaded({ token, error: res.message })
    })
    return () => {
      live = false
    }
  }, [token, retry, onSessionEnded])

  const current = loaded?.token === token ? loaded : null

  const setInterest = async (o: ExpertOpportunity, on: boolean) => {
    setBusy(o.id)
    setErrors((e) => ({ ...e, [o.id]: '' }))
    setNotes((n) => ({ ...n, [o.id]: '' }))
    const res = await call('interest', { opportunity_id: o.id, on }, token)
    setBusy(null)
    if (!res.ok) {
      if (res.error === 'session_expired') return onSessionEnded()
      // If it closed while the page was open, refresh so the list is right.
      if (res.error === 'not_open') setRetry((r) => r + 1)
      return setErrors((e) => ({ ...e, [o.id]: res.message }))
    }
    setLoaded((l) =>
      l && 'items' in l ? { ...l, items: l.items.map((x) => (x.id === o.id ? { ...x, interested: on } : x)) } : l,
    )
    setNotes((n) => ({
      ...n,
      [o.id]: on ? t.thanks : t.withdrawn,
    }))
  }

  return (
    <section aria-labelledby="opps-title" className="space-y-4">
      <div>
        <h2 id="opps-title" className="text-2xl font-semibold text-green-900">{t.title}</h2>
        <p className="mt-1 text-[0.95rem] text-ink-700">{t.intro}</p>
      </div>

      {!current && <div className="grid place-items-center py-8 text-green-800"><Spinner label={t.loading} className="h-7 w-7" /></div>}

      {current && 'error' in current && (
        <div className="space-y-3">
          <Notice title={t.loadFailed}>{current.error}</Notice>
          <button className="btn btn-ghost" onClick={() => { setLoaded(null); setRetry((r) => r + 1) }}>{m.common.tryAgain}</button>
        </div>
      )}

      {current && 'items' in current && !current.verified && current.items.length > 0 && (
        <Notice tone="info" title={t.onlyVerifiedTitle}>{t.onlyVerifiedText}</Notice>
      )}

      {current && 'items' in current && current.items.length === 0 && (
        <div className="card p-6 text-center">
          <h3 className="text-lg font-semibold text-green-900">{t.noneTitle}</h3>
          <p className="mt-1 text-[0.95rem] text-ink-700">{t.noneText}</p>
        </div>
      )}

      {current && 'items' in current && current.items.length > 0 && (
        <ul className="space-y-3">
          {current.items.map((o) => (
            <li key={o.id} className="card p-5" style={{ borderRadius: 'var(--radius-lg)' }}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 text-lg font-semibold text-green-900">{o.title}</h3>
                {o.matches && (
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-lime-500 px-2.5 py-1 text-xs font-bold text-green-950">
                    <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m3.5 8.5 3 3 6-7" />
                    </svg>
                    {t.matches}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-ink-700">
                {o.opp_type} · {o.location}
              </p>
              <p className="text-sm text-ink-500">
                {fmt(t.expressBy, { date: formatDay(o.deadline, m.meta.dateLocale), note: note(o.deadline) })}
              </p>
              <p className="mt-3 whitespace-pre-wrap break-words text-[0.95rem] text-ink-900">{o.description}</p>
              <p className="mt-3 text-sm text-ink-500">
                <span className="font-bold text-ink-700">{t.needed}</span>
                {o.expertise_needed.map((x) => (m.options.expertise as Record<string, string>)[x] ?? x).join(', ')}
              </p>

              {errors[o.id] && <p className="field-error" role="alert">{errors[o.id]}</p>}
              {notes[o.id] && <p className="mt-3 text-sm font-semibold text-green-800" role="status">{notes[o.id]}</p>}

              <div className="mt-4">
                {o.interested ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-bold text-green-800">{t.interested}</span>
                    <button className="btn btn-ghost !min-h-11" disabled={busy === o.id} onClick={() => void setInterest(o, false)}>
                      {busy === o.id ? (<><Spinner label={m.dashboard.saving} /> {m.dashboard.saving}</>) : t.withdraw}
                    </button>
                  </div>
                ) : current.verified ? (
                  <button className="btn btn-primary w-full sm:w-auto" disabled={busy === o.id} onClick={() => void setInterest(o, true)}>
                    {busy === o.id ? (<><Spinner label={m.dashboard.saving} /> {m.dashboard.saving}</>) : t.express}
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
