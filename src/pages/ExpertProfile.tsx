import '../i18n/enSite'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { Notice, Spinner } from '../components/ui'
import { loadProfile, type PublicProfile } from '../lib/directory'
import { displayName, EXPERT_ID_PATTERN, linkLabel, safeProfileUrl } from '../lib/directoryFilters'
import { usePageMeta } from '../lib/meta'
import { fmt } from '../i18n'
import { useMessages } from '../i18n/I18nProvider'

type Loaded = { id: string; state: 'found'; profile: PublicProfile } | { id: string; state: 'missing' } | { id: string; state: 'error'; message: string }

const monthYear = (iso: string | null, dateLocale: string) =>
  iso ? new Date(iso).toLocaleDateString(dateLocale, { month: 'long', year: 'numeric' }) : null

/** Every state of the page (loading, error, not found, found) fills at least most of a screen, so nothing below it jumps when the answer arrives. */
function Frame({ children }: { children: ReactNode }) {
  return <div className="min-h-[85svh]">{children}</div>
}

export default function ExpertProfile() {
  const m = useMessages()
  const t = m.profile
  const label = (group: string, value: string) => (m.options as Record<string, Record<string, string>>)[group]?.[value] ?? value
  const { expertId = '' } = useParams()
  const id = expertId.toUpperCase()
  const valid = EXPERT_ID_PATTERN.test(id)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (!valid) return
    let live = true
    loadProfile(id).then((res) => {
      if (!live) return
      if (!res.ok) setLoaded({ id, state: 'error', message: res.message })
      else if (res.profile) setLoaded({ id, state: 'found', profile: res.profile })
      else setLoaded({ id, state: 'missing' })
    })
    return () => {
      live = false
    }
  }, [id, valid, retry])

  const current = !valid ? ({ id, state: 'missing' } as Loaded) : loaded?.id === id ? loaded : null
  const profile = current?.state === 'found' ? current.profile : null

  // Only a listed expert is ever offered to search engines. Everything else, including while loading, is noindex.
  usePageMeta(
    profile
      ? {
          title: `${displayName(profile.title, profile.full_name)}, ${label('expertise', profile.primary_expertise)} | NEXUS-E`,
          description: fmt(t.metaDescription, {
            name: displayName(profile.title, profile.full_name),
            expertise: label('expertise', profile.primary_expertise),
            place: [profile.state, profile.country ? label('countries', profile.country) : null].filter(Boolean).join(', '),
          }),
          robots: 'index, follow',
          path: `/experts/${profile.expert_id}`,
        }
      : {
          title: t.metaTitle,
          description: t.metaMissing,
          robots: 'noindex, follow',
          path: `/experts/${valid ? id : ''}`.replace(/\/$/, '') || '/experts',
        },
  )

  if (!current) {
    return <Frame><div className="grid place-items-center py-24 text-green-800"><Spinner label={t.loading} className="h-8 w-8" /></div></Frame>
  }

  if (current.state === 'error') {
    return (
      <Frame>
      <div className="mx-auto max-w-lg space-y-4">
        <Notice title={t.errorTitle}>{current.message}</Notice>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => { setLoaded(null); setRetry((r) => r + 1) }}>{m.common.tryAgain}</button>
          <Link to="/experts" className="btn btn-ghost">{t.backToDirectory}</Link>
        </div>
      </div>
      </Frame>
    )
  }

  if (current.state === 'missing' || !profile) {
    return (
      <Frame>
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-3xl font-semibold text-green-900">{t.missingTitle}</h1>
        <p className="mt-3 text-ink-700">{t.missingText}</p>
        <Link to="/experts" className="btn btn-primary mt-6">{t.searchDirectory}</Link>
      </div>
      </Frame>
    )
  }

  const link = safeProfileUrl(profile.profile_url)
  const verified = monthYear(profile.verified_at, m.meta.dateLocale)
  const place = [profile.state, profile.country ? label('countries', profile.country) : null].filter(Boolean).join(', ')
  const rows: [string, string | null][] = [
    [t.rows.primary, label('expertise', profile.primary_expertise)],
    [t.rows.secondary, profile.secondary_expertise.length ? profile.secondary_expertise.map((x) => label('expertise', x)).join(', ') : null],
    [t.rows.years, label('years', profile.years_experience)],
    [t.rows.qualification, label('qualifications', profile.qualification)],
    [t.rows.memberships, profile.memberships.length ? profile.memberships.map((x) => label('memberships', x)).join(', ') : null],
    [t.rows.openTo, profile.assignments.length ? profile.assignments.map((x) => label('assignments', x)).join(', ') : null],
    [t.rows.canWork, label('availability', profile.availability)],
  ]

  return (
    <Frame>
    <article aria-labelledby="profile-name" className="space-y-6">
      <nav aria-label={t.breadcrumb} className="text-sm">
        <Link to="/experts" className="font-bold text-green-800 underline underline-offset-4">{t.all}</Link>
      </nav>

      <header className="glass rounded-[var(--radius-xl)] p-5 sm:p-7">
        <VerifiedBadge />
        <h1 id="profile-name" className="mt-3 text-3xl font-semibold text-green-900 sm:text-4xl">
          {displayName(profile.title, profile.full_name)}
        </h1>
        <p className="mt-1 break-words text-lg text-ink-700">{profile.position}</p>
        <p className="break-words text-ink-700">{profile.organisation} · {place}</p>
        <p className="mt-3 text-sm text-ink-500">
          {fmt(t.idLine, { id: profile.expert_id })}{verified ? fmt(t.verifiedLine, { date: verified }) : ''}
        </p>
      </header>

      <section className="glass-flat rounded-[var(--radius-xl)] p-5 sm:p-6" aria-labelledby="profile-details">
        <h2 id="profile-details" className="text-xl font-semibold text-green-900">{t.detailsTitle}</h2>
        <dl className="mt-3 divide-y divide-line text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
              <dt className="font-bold text-ink-500">{k}</dt>
              <dd className="min-w-0 break-words text-ink-900">{v}</dd>
            </div>
          ))}
          {link && (
            <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
              <dt className="font-bold text-ink-500">{t.rows.link}</dt>
              <dd className="min-w-0 break-words">
                <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-green-800 underline underline-offset-4">
                  {linkLabel(link)}<span className="sr-only"> {m.common.opensInNewTab}</span>
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <p className="text-sm text-ink-500">{t.note}</p>
    </article>
    </Frame>
  )
}
