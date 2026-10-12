import { useCallback, useEffect, useState } from 'react'
import { Notice, Spinner } from './ui'
import { call } from '../lib/portal'
import { useMessages } from '../i18n/I18nProvider'

type Item = {
  id: string
  kind: 'professional' | 'ngo'
  name: string
  acronym: string | null
  institution_status: 'approved' | 'pending'
  membership_category: string | null
  membership_number: string | null
  licence_status: string | null
  affiliation_type: string | null
  evidence_status: 'registered' | 'evidence_submitted' | 'verified'
}
type Loaded = { affiliations_public: boolean; items: Item[] }

/**
 * The expert's own memberships and affiliations, with the private details (membership number, licence) that only they and
 * NEXUS-E administrators can see. Everything here is self-declared. Showing it on the public page is the expert's own choice.
 */
export function AffiliationsCard({ token, onSessionEnded }: { token: string; onSessionEnded: () => void }) {
  const m = useMessages()
  const t = m.dashboard.affiliations
  const [data, setData] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const res = await call<Loaded>('affiliations', {}, token)
    if (!res.ok) {
      if (res.error === 'session_expired') return onSessionEnded()
      return setError(t.loadFailed)
    }
    setError(null)
    setData({ affiliations_public: res.affiliations_public, items: res.items })
  }, [token, onSessionEnded, t.loadFailed])
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const setPublic = async (value: boolean) => {
    setSaving(true)
    const res = await call('set_affiliations_public', { value }, token)
    setSaving(false)
    if (!res.ok) {
      if (res.error === 'session_expired') return onSessionEnded()
      return setError(res.message)
    }
    await load()
  }

  const opt = (group: 'membershipCategories' | 'affiliationTypes', v: string | null) => (v ? ((m.options[group] as Record<string, string>)[v] ?? v) : '')
  const status = (s: Item['evidence_status']) => ({ registered: t.statusRegistered, evidence_submitted: t.statusEvidenceSubmitted, verified: t.statusVerified })[s]

  return (
    <section className="card p-5 sm:p-6" aria-labelledby="aff-title">
      <h2 id="aff-title" className="text-xl font-semibold text-green-900">{t.title}</h2>
      <p className="mt-1 text-[0.95rem] text-ink-700">{t.intro}</p>
      <p className="mt-1 text-sm font-semibold text-ink-900">{t.private}</p>

      {error && <div className="mt-3"><Notice>{error}</Notice></div>}
      {!data && !error && <div className="mt-4 text-green-800"><Spinner label={m.common.loading} /></div>}

      {data && data.items.length === 0 && <p className="mt-4 text-sm text-ink-500">{t.empty}</p>}
      {data && data.items.length > 0 && (
        <>
          <ul className="mt-4 space-y-3">
            {data.items.map((i) => (
              <li key={i.id} className="rounded-[var(--radius-md)] bg-green-50 p-3">
                <p className="break-words font-semibold text-ink-900">
                  {i.name}
                  {i.institution_status === 'pending' && <span className="ms-2 rounded-full bg-warn-100 px-2 py-0.5 text-xs font-bold text-[#7a4b00]">{m.register.fields.aff.pending}</span>}
                </p>
                <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-sm text-ink-700 sm:grid-cols-2">
                  {i.kind === 'professional' ? (
                    <>
                      {i.membership_category && <Row k={t.category} v={opt('membershipCategories', i.membership_category)} />}
                      {i.membership_number && <Row k={t.number} v={i.membership_number} ltr />}
                      {i.licence_status && <Row k={t.licence} v={i.licence_status} />}
                    </>
                  ) : (
                    i.affiliation_type && <Row k={m.register.fields.aff.affiliationType} v={opt('affiliationTypes', i.affiliation_type)} />
                  )}
                  <Row k={t.evidence} v={status(i.evidence_status)} />
                </dl>
              </li>
            ))}
          </ul>

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="text-base font-bold text-green-900">{t.publicTitle}</h3>
            <p className="mt-1 text-sm text-ink-700" role="status">{data.affiliations_public ? t.publicOn : t.publicOff}</p>
            <button className="btn btn-ghost mt-3 w-full sm:w-auto" onClick={() => void setPublic(!data.affiliations_public)} disabled={saving}>
              {saving ? (<><Spinner label={m.dashboard.saving} /> {m.dashboard.saving}</>) : data.affiliations_public ? t.publicHide : t.publicShow}
            </button>
          </div>
        </>
      )}
    </section>
  )
}

function Row({ k, v, ltr }: { k: string; v: string; ltr?: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="font-bold text-ink-500">{k}:</dt>
      <dd className="min-w-0 break-words" dir={ltr ? 'ltr' : undefined}>{v}</dd>
    </div>
  )
}
