// Talks to the two public database functions behind the directory. They return only experts who are
// Verified and chose to be listed, and only the fields shown on a public profile.
import { isConfigured } from './config'
import { publicRpc } from './rest'
import { EXPERT_ID_PATTERN, searchArgs, type Filters } from './directoryFilters'

export type Listing = {
  expert_id: string
  title: string
  full_name: string
  position: string
  organisation: string
  state: string
  primary_expertise: string
  years_experience: string
  qualification: string
}

export type PublicProfile = Listing & {
  secondary_expertise: string[]
  memberships: string[]
  assignments: string[]
  availability: string
  profile_url: string | null
  verified_at: string | null
}

export type Result<T> = ({ ok: true } & T) | { ok: false; message: string }

const SEARCH_FAILED = 'We could not load the directory. Please check your connection and try again.'

export async function searchExperts(f: Filters): Promise<Result<{ total: number; items: Listing[] }>> {
  if (!isConfigured) return { ok: false, message: 'The directory is not open yet. Please try again later.' }
  try {
    const res = await publicRpc('directory_search', searchArgs(f))
    if (!res.ok || !res.data) return { ok: false, message: SEARCH_FAILED }
    const d = res.data as { total: number; items: Listing[] }
    return { ok: true, total: Number(d.total) || 0, items: Array.isArray(d.items) ? d.items : [] }
  } catch {
    return { ok: false, message: SEARCH_FAILED }
  }
}

/** profile is null when nobody is listed under that ID, for whatever reason. */
export async function loadProfile(expertId: string): Promise<Result<{ profile: PublicProfile | null }>> {
  if (!EXPERT_ID_PATTERN.test(expertId)) return { ok: true, profile: null }
  if (!isConfigured) return { ok: false, message: 'The directory is not open yet. Please try again later.' }
  try {
    const res = await publicRpc('directory_profile', { p_expert_id: expertId })
    if (!res.ok) return { ok: false, message: 'We could not load this profile. Please check your connection and try again.' }
    return { ok: true, profile: (res.data as PublicProfile | null) ?? null }
  } catch {
    return { ok: false, message: 'We could not load this profile. Please check your connection and try again.' }
  }
}
