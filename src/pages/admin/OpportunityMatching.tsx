import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/StatusBadge'
import { COUNTRIES } from '../../lib/countries'
import { YEARS } from '../../lib/options'
import { supabase } from '../../lib/supabase'
import { csvFileName, downloadCsvText, shortlistToCsv, type ShortlistRow } from './csv'

type Suggestion = {
  expert_id: string
  title: string
  full_name: string
  organisation: string
  country: string
  primary_expertise: string
  years_experience: string
  consulting_availability: string | null
  verification_status: string
  score: number
  reasons: { points: number; text: string }[]
  invitation: 'invited' | 'interested' | 'not_interested' | null
}

const RESPONSE_LABEL: Record<string, string> = { invited: 'Invited, no answer yet', interested: 'Interested', not_interested: 'Not interested' }
const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '')

/**
 * Matching for one opportunity. The list is a points table with a written reason for every point, so an administrator can see
 * why someone is suggested. Nobody is contacted until an administrator ticks them and invites them, and an expert's email and
 * phone appear in the shortlist only if that expert agreed to share them.
 */
export function OpportunityMatching({ id, open }: { id: string; open: boolean }) {
  const [country, setCountry] = useState('')
  const [level, setLevel] = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [invitations, setInvitations] = useState<ShortlistRow[]>([])
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const [d, s, i] = await Promise.all([
      supabase.rpc('admin_get_opportunity_matching', { p_id: id }),
      supabase.rpc('admin_match_experts', { p_id: id }),
      supabase.rpc('admin_opportunity_invitations', { p_id: id }),
    ])
    if (d.error || s.error || i.error) return setError('We could not load the suggestions.')
    const det = d.data as { country: string | null; experience_level: string | null }
    setCountry(det.country ?? '')
    setLevel(det.experience_level ?? '')
    setSuggestions((s.data as Suggestion[]) ?? [])
    setInvitations((i.data as ShortlistRow[]) ?? [])
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const saveDetails = async () => {
    setBusy(true)
    setMessage(null)
    const { error: e } = await supabase.rpc('admin_set_opportunity_matching', { p_id: id, p_country: country || null, p_level: level || null })
    setBusy(false)
    if (e) return setError('We could not save the matching details.')
    setError(null)
    setMessage('Saved. The suggestions below use the new details.')
    await load()
  }

  const invite = async () => {
    if (picked.size === 0) return
    setBusy(true)
    setMessage(null)
    const { data, error: e } = await supabase.rpc('admin_invite_experts', { p_id: id, p_expert_ids: [...picked] })
    setBusy(false)
    if (e) return setError(e.message === 'not_open' ? 'The opportunity must be open to send invitations.' : 'We could not send the invitations.')
    const r = data as { invited: number; skipped: number }
    setError(null)
    setPicked(new Set())
    setMessage(`${r.invited} invitation${r.invited === 1 ? '' : 's'} sent${r.skipped ? `, ${r.skipped} skipped (already invited or not listed)` : ''}.`)
    await load()
  }

  const toggle = (expertId: string) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(expertId)) n.delete(expertId)
      else n.add(expertId)
      return n
    })

  const interested = invitations.filter((r) => r.response === 'interested')

  return (
    <section className="card p-5 sm:p-7" aria-labelledby="match-title">
      <h2 id="match-title" className="text-xl font-semibold text-green-900">Suggested experts</h2>
      <p className="mt-1 text-sm text-ink-700">
        Only experts who agreed to be listed are suggested. Points: 40 for the primary expertise (25 for a secondary one), 20 for the country, 15 for enough
        experience, 15 for consulting availability and 10 for verified by NEXUS-E review. Nobody is contacted until you invite them.
      </p>
      {error && <p className="mt-2 text-sm text-danger-600" role="alert">{error}</p>}
      {message && <p className="mt-2 text-sm font-semibold text-green-800" role="status">{message}</p>}

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label htmlFor="m-country" className="field-label">Country (optional)</label>
          <select id="m-country" className="input" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">Any country</option>
            {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="m-level" className="field-label">Experience asked for (optional)</label>
          <select id="m-level" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">Any level</option>
            {YEARS.map((y) => <option key={y} value={y}>{y} years or more</option>)}
          </select>
        </div>
        <button className="btn btn-ghost !min-h-11" disabled={busy} onClick={() => void saveDetails()}>Save details</button>
      </div>

      {suggestions === null && !error && <p className="mt-4 text-sm text-ink-500">Looking for experts...</p>}
      {suggestions && suggestions.length === 0 && <p className="mt-4 text-sm text-ink-700">No listed expert matches the expertise asked for yet.</p>}
      {suggestions && suggestions.length > 0 && (
        <>
          <ul className="mt-4 divide-y divide-line">
            {suggestions.map((s) => (
              <li key={s.expert_id} className="py-3">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 h-5 w-5 flex-none"
                    aria-label={`Select ${s.full_name}`}
                    checked={picked.has(s.expert_id)}
                    disabled={s.invitation !== null || !open}
                    onChange={() => toggle(s.expert_id)}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-bold text-green-900">
                      {s.title} {s.full_name}
                      <span className="ml-2 rounded-full bg-green-100 px-2 py-0.5 text-xs font-bold text-green-800">{s.expert_id}</span>
                      <span className="ml-2 rounded-full bg-lime-500 px-2 py-0.5 text-xs font-bold text-green-950">{s.score} points</span>
                    </p>
                    <p className="break-words text-sm text-ink-700">{s.organisation} · {s.country} · {s.years_experience} years</p>
                    <ul className="mt-1 list-disc ps-5 text-sm text-ink-700">
                      {s.reasons.map((r, i) => <li key={i}>{r.text} (+{r.points})</li>)}
                    </ul>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <StatusBadge status={s.verification_status} />
                      {s.invitation && <span className="text-xs font-bold text-ink-700">{RESPONSE_LABEL[s.invitation]}</span>}
                      <Link to={`/admin/verification/${s.expert_id}`} className="text-sm font-bold text-green-800 underline underline-offset-4">View record</Link>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button className="btn btn-primary" disabled={busy || picked.size === 0 || !open} onClick={() => void invite()}>
              Invite {picked.size || ''} selected
            </button>
            {!open && <span className="text-sm text-ink-500">Open the opportunity to send invitations.</span>}
          </div>
        </>
      )}

      <h3 className="mt-8 text-lg font-semibold text-green-900">Invitations and answers ({invitations.length})</h3>
      {invitations.length === 0 ? (
        <p className="mt-1 text-sm text-ink-500">Nobody has been invited yet.</p>
      ) : (
        <ul className="mt-2 divide-y divide-line text-sm">
          {invitations.map((r) => (
            <li key={r.expert_id} className="py-2">
              <span className="font-bold text-green-900">{r.title} {r.full_name}</span> <span className="text-ink-500">{r.expert_id}</span>
              <span className="block text-ink-700">
                {RESPONSE_LABEL[r.response]}{r.responded_at ? ` on ${when(r.responded_at)}` : ''}
                {r.response === 'interested' ? (r.share_contact ? ' · agreed to share contact details' : ' · contact details not shared') : ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          className="btn btn-ghost !min-h-11"
          disabled={interested.length === 0}
          onClick={() => downloadCsvText(shortlistToCsv(invitations), csvFileName('shortlist', 'opportunity'))}
        >
          Export shortlist CSV
        </button>
        <span className="text-xs text-ink-500">The shortlist has only experts who are interested. Email and phone are included only for those who agreed to share them.</span>
      </div>
    </section>
  )
}
