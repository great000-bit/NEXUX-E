// Institutions (professional bodies, councils, scientific societies, NGOs) and an expert's declared memberships.
// Everything an expert declares is self-declared. Membership numbers and licence details are private: they go to the
// database with the registration and come back only to the expert and to admins.

export const INSTITUTION_CATEGORIES = ['professional_body', 'statutory_council', 'scientific_society', 'ngo_network'] as const
export type InstitutionCategory = (typeof INSTITUTION_CATEGORIES)[number]

export type Institution = {
  id: string
  name: string
  acronym: string | null
  country: string | null
  category: InstitutionCategory
}

export const MEMBERSHIP_CATEGORIES = ['Member', 'Associate', 'Fellow', 'Student', 'Honorary', 'Other'] as const
export const AFFILIATION_TYPES = ['employee', 'consultant', 'member', 'volunteer', 'board_member', 'partner'] as const
export type AffiliationType = (typeof AFFILIATION_TYPES)[number]

export type AffiliationKind = 'professional' | 'ngo'

export const MAX_AFFILIATIONS = 20
export const AFFILIATION_LIMITS = { name: 200, membership_category: 80, membership_number: 80, licence_status: 120 } as const

/** One declared membership or affiliation in the form. */
export type AffiliationEntry = {
  kind: AffiliationKind
  /** The chosen institution, or null for "Other (specify)". */
  institution_id: string | null
  /** The institution's name, or the name the expert typed. */
  name: string
  acronym: string | null
  other: boolean
  membership_category: string
  membership_number: string
  licence_status: string
  affiliation_type: string
}

export const entryKey = (e: Pick<AffiliationEntry, 'institution_id' | 'name' | 'other'>) =>
  e.other ? `other:${e.name.trim().toLowerCase()}` : (e.institution_id ?? '')

export const kindOf = (category: InstitutionCategory): AffiliationKind => (category === 'ngo_network' ? 'ngo' : 'professional')

export function newEntry(kind: AffiliationKind, institution: Institution | null, typedName = ''): AffiliationEntry {
  return {
    kind,
    institution_id: institution?.id ?? null,
    name: institution?.name ?? typedName.trim(),
    acronym: institution?.acronym ?? null,
    other: !institution,
    membership_category: '',
    membership_number: '',
    licence_status: '',
    // A connection to an NGO is "member" until the expert says otherwise: one tap fewer on a phone.
    affiliation_type: kind === 'ngo' ? 'member' : '',
  }
}

/** Matches typing against a name, an acronym or a country, ignoring case and accents. */
const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export function searchInstitutions(list: readonly Institution[], query: string): Institution[] {
  const q = fold(query.trim())
  if (!q) return [...list]
  const words = q.split(/\s+/)
  return list.filter((i) => {
    const hay = fold(`${i.name} ${i.acronym ?? ''} ${i.country ?? ''}`)
    return words.every((w) => hay.includes(w))
  })
}

/** The older fields the directory and admin already use. They are still filled, so nothing that reads them changes. */
const LEGACY_CODES = ['NES', 'IEPN', 'NSE', 'NITP', 'IUCN'] as const
export function legacyFields(entries: readonly AffiliationEntry[]): { memberships: string[]; nes_number: string; iepn_status: string } {
  const codes = new Set<string>()
  let nes = ''
  let iepn = ''
  for (const e of entries) {
    const code = e.acronym && (LEGACY_CODES as readonly string[]).includes(e.acronym) ? e.acronym : null
    codes.add(code ?? 'Others')
    if (code === 'NES') nes = e.membership_number.trim()
    if (code === 'IEPN') iepn = (e.licence_status || e.membership_number).trim()
  }
  return { memberships: [...codes], nes_number: nes, iepn_status: iepn }
}

/** What goes to the registration function. A typed name has no id; an approved choice has no typed name. */
export function affiliationsPayload(entries: readonly AffiliationEntry[]) {
  return entries.map((e) => ({
    kind: e.kind,
    institution_id: e.other ? null : e.institution_id,
    other_name: e.other ? e.name.trim().slice(0, AFFILIATION_LIMITS.name) : null,
    membership_category: e.kind === 'professional' ? e.membership_category.slice(0, AFFILIATION_LIMITS.membership_category) : '',
    membership_number: e.kind === 'professional' ? e.membership_number.trim().slice(0, AFFILIATION_LIMITS.membership_number) : '',
    licence_status: e.kind === 'professional' ? e.licence_status.trim().slice(0, AFFILIATION_LIMITS.licence_status) : '',
    affiliation_type: e.kind === 'ngo' ? e.affiliation_type || 'member' : '',
  }))
}

/** True when an entry is fine to send. */
export function affiliationProblem(e: AffiliationEntry): 'name' | 'long' | null {
  if (e.other && e.name.trim().length < 2) return 'name'
  if (
    e.name.trim().length > AFFILIATION_LIMITS.name ||
    e.membership_number.trim().length > AFFILIATION_LIMITS.membership_number ||
    e.licence_status.trim().length > AFFILIATION_LIMITS.licence_status
  ) return 'long'
  return null
}
