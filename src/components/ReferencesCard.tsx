import { useState, type FormEvent } from 'react'
import { Notice, Spinner } from './ui'
import { call } from '../lib/portal'
import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'

export type Reference = { id: string; referee_name: string; organisation: string; relationship: string }

/**
 * References: the expert enters a referee's name, organisation and relationship. Nobody is emailed. A NEXUS-E reviewer may
 * check a reference as part of verification and records the outcome, which the expert does not see.
 */
export function ReferencesCard({ references, editable, token, onChanged, onSessionEnded }: {
  references: Reference[]
  editable: boolean
  token: string
  onChanged: () => void
  onSessionEnded: () => void
}) {
  const m = useMessages()
  const t = m.dashboard.references
  const [name, setName] = useState('')
  const [org, setOrg] = useState('')
  const [rel, setRel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const full = references.length >= 3

  const run = async (action: string, body: Record<string, unknown>) => {
    setBusy(true)
    const res = await call(action, body, token)
    setBusy(false)
    if (!res.ok) {
      if (res.error === 'session_expired') return onSessionEnded()
      setError(res.message)
      return false
    }
    setError(null)
    onChanged()
    return true
  }

  const add = async (e: FormEvent) => {
    e.preventDefault()
    if (await run('add_reference', { name, organisation: org, relationship: rel })) {
      setName('')
      setOrg('')
      setRel('')
    }
  }

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="refs-title">
      <h2 id="refs-title" className="text-xl font-semibold text-green-900">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-700">{t.help}</p>
      {error && <div className="mt-3"><Notice title={t.title}>{error}</Notice></div>}

      {references.length === 0 ? (
        <p className="mt-3 text-sm text-ink-500">{t.none}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line text-sm">
          {references.map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2.5">
              <span className="min-w-0 break-words">
                <span className="font-semibold text-ink-900">{r.referee_name}</span>
                <span className="text-ink-500"> {'·'} {r.organisation} {'·'} {r.relationship}</span>
              </span>
              {editable && (
                <button
                  type="button"
                  className="flex-none text-sm font-bold text-green-800 underline underline-offset-4"
                  disabled={busy}
                  onClick={() => void run('delete_reference', { id: r.id })}
                  aria-label={fmt(t.remove, { name: r.referee_name })}
                >
                  {m.dashboard.slot.delete}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        full ? (
          <p className="mt-3 text-sm text-ink-500">{t.limit}</p>
        ) : (
          <form onSubmit={(e) => void add(e)} className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ref-name" className="field-label">{t.name}</label>
              <input id="ref-name" className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label htmlFor="ref-org" className="field-label">{t.organisation}</label>
              <input id="ref-org" className="input" value={org} maxLength={160} onChange={(e) => setOrg(e.target.value)} autoComplete="off" />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ref-rel" className="field-label">{t.relationship}</label>
              <input id="ref-rel" className="input" value={rel} maxLength={160} onChange={(e) => setRel(e.target.value)} autoComplete="off" />
            </div>
            <div className="sm:col-span-2">
              <button className="btn btn-primary w-full sm:w-auto" disabled={busy || name.trim().length < 2 || org.trim().length < 2 || rel.trim().length < 2}>
                {busy ? <Spinner label={t.add} /> : t.add}
              </button>
            </div>
          </form>
        )
      ) : (
        <p className="mt-3 text-sm text-ink-500">{t.locked}</p>
      )}
    </section>
  )
}
