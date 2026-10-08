import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { VerifiedBadge } from '../components/VerifiedBadge'
import { Notice, Spinner } from '../components/ui'
import { loadProfile, type PublicProfile } from '../lib/directory'
import { displayName, EXPERT_ID_PATTERN, linkLabel, safeProfileUrl } from '../lib/directoryFilters'
import { usePageMeta } from '../lib/meta'

type Loaded = { id: string; state: 'found'; profile: PublicProfile } | { id: string; state: 'missing' } | { id: string; state: 'error'; message: string }

const monthYear = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-NG', { month: 'long', year: 'numeric' }) : null

export default function ExpertProfile() {
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
          title: `${displayName(profile.title, profile.full_name)}, ${profile.primary_expertise} | NEXUS-E`,
          description: `${displayName(profile.title, profile.full_name)} is a Verified Expert in ${profile.primary_expertise} (${profile.state}, Nigeria) on NEXUS-E, the Nigerian Environmental Expertise Exchange.`,
          robots: 'index, follow',
          path: `/experts/${profile.expert_id}`,
        }
      : {
          title: 'Expert profile | NEXUS-E',
          description: 'This profile is not available on NEXUS-E.',
          robots: 'noindex, follow',
          path: `/experts/${valid ? id : ''}`.replace(/\/$/, '') || '/experts',
        },
  )

  if (!current) {
    return <div className="grid place-items-center py-24 text-green-800"><Spinner label="Loading the profile" className="h-8 w-8" /></div>
  }

  if (current.state === 'error') {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Notice title="We could not load this profile">{current.message}</Notice>
        <div className="flex flex-wrap gap-3">
          <button className="btn btn-primary" onClick={() => { setLoaded(null); setRetry((r) => r + 1) }}>Try again</button>
          <Link to="/experts" className="btn btn-ghost">Back to the directory</Link>
        </div>
      </div>
    )
  }

  if (current.state === 'missing' || !profile) {
    return (
      <div className="mx-auto max-w-lg text-center">
        <h1 className="text-3xl font-semibold text-green-900">This profile is not available</h1>
        <p className="mt-3 text-ink-700">
          There is no listed expert at this address. The expert may have chosen not to be listed, or the link may be wrong.
        </p>
        <Link to="/experts" className="btn btn-primary mt-6">Search the directory</Link>
      </div>
    )
  }

  const link = safeProfileUrl(profile.profile_url)
  const verified = monthYear(profile.verified_at)
  const rows: [string, string | null][] = [
    ['Primary expertise', profile.primary_expertise],
    ['Also works in', profile.secondary_expertise.length ? profile.secondary_expertise.join(', ') : null],
    ['Years of experience', profile.years_experience],
    ['Highest qualification', profile.qualification],
    ['Professional memberships', profile.memberships.length ? profile.memberships.join(', ') : null],
    ['Open to', profile.assignments.length ? profile.assignments.join(', ') : null],
    ['Can work', profile.availability],
  ]

  return (
    <article aria-labelledby="profile-name" className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-sm">
        <Link to="/experts" className="font-bold text-green-800 underline underline-offset-4">All experts</Link>
      </nav>

      <header className="card p-5 sm:p-7">
        <VerifiedBadge />
        <h1 id="profile-name" className="mt-3 text-3xl font-semibold text-green-900 sm:text-4xl">
          {displayName(profile.title, profile.full_name)}
        </h1>
        <p className="mt-1 break-words text-lg text-ink-700">{profile.position}</p>
        <p className="break-words text-ink-700">{profile.organisation} · {profile.state}</p>
        <p className="mt-3 text-sm text-ink-500">
          Expert ID {profile.expert_id}{verified ? ` · Verified ${verified}` : ''}
        </p>
      </header>

      <section className="card p-5 sm:p-6" aria-labelledby="profile-details">
        <h2 id="profile-details" className="text-xl font-semibold text-green-900">Expertise and experience</h2>
        <dl className="mt-3 divide-y divide-line text-sm">
          {rows.filter(([, v]) => v).map(([k, v]) => (
            <div key={k} className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
              <dt className="font-bold text-ink-500">{k}</dt>
              <dd className="min-w-0 break-words text-ink-900">{v}</dd>
            </div>
          ))}
          {link && (
            <div className="grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[11rem_1fr] sm:gap-3">
              <dt className="font-bold text-ink-500">Profile link</dt>
              <dd className="min-w-0 break-words">
                <a href={link} target="_blank" rel="noopener noreferrer nofollow" className="font-bold text-green-800 underline underline-offset-4">
                  {linkLabel(link)}<span className="sr-only"> (opens in a new tab)</span>
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      <p className="text-sm text-ink-500">
        This expert has been verified by NEXUS-E and has chosen to be listed. Phone numbers, email addresses and documents are never shown here.
      </p>
    </article>
  )
}
