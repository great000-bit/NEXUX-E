// Shared verification vocabulary: statuses, evidence kinds and the plain language that goes with them.

export type VStatus = 'pending' | 'under_review' | 'more_evidence' | 'verified' | 'not_verified'

export const STATUS_ORDER: VStatus[] = ['pending', 'under_review', 'more_evidence', 'verified', 'not_verified']

export const STATUS_LABEL: Record<VStatus, string> = {
  pending: 'Pending',
  under_review: 'Under review',
  more_evidence: 'More evidence needed',
  verified: 'Verified',
  not_verified: 'Not verified',
}

/** What each status means to the expert, in one or two friendly sentences. */
export const STATUS_HELP: Record<VStatus, string> = {
  pending: 'You are registered. Add your documents below and submit them when you are ready.',
  under_review: 'We have your documents and a reviewer is looking at them. We will email you as soon as there is a decision.',
  more_evidence: 'We need a little more from you. Read the message below, add or replace documents, then submit again.',
  verified: 'Your profile has been verified. Thank you for completing the process.',
  not_verified: 'We could not verify your profile this time. The reason is below.',
}

export const isStatus = (v: string): v is VStatus => (STATUS_ORDER as string[]).includes(v)

export type EvidenceKind = 'membership' | 'licence' | 'qualification' | 'cv'

export const KIND_INFO: Record<EvidenceKind, { title: string; help: string; required: boolean }> = {
  membership: {
    title: 'Professional membership',
    help: 'A membership card or certificate from a professional body such as NES, IEPN, NSE, NIA, NITP, NIM or IUCN.',
    required: false,
  },
  licence: {
    title: 'Professional licence',
    help: 'Your practising licence or registration certificate, if you have one.',
    required: false,
  },
  qualification: {
    title: 'Highest qualification',
    help: 'The certificate for your highest qualification.',
    required: false,
  },
  cv: {
    title: 'CV (optional)',
    help: 'A short CV helps reviewers, but it is not needed on its own.',
    required: false,
  },
}

/** Bodies an expert can pick for a membership document. These match the database. */
export const BODIES = ['NES', 'IEPN', 'NSE', 'NIA', 'NITP', 'NIM', 'IUCN', 'Other'] as const

export const MAX_FILE_BYTES = 5 * 1024 * 1024
export const MAX_FILES = 8
