// Every word on the home page comes from the conference flier or the PRD. Nothing here is invented:
// no statistics, no testimonials, no client names.
import type { IconName } from '../../components/icons'

export const HERO = {
  eyebrow: 'Join the founding experts',
  headlineA: "Don't just be qualified.",
  headlineB: 'Be found.',
  subline:
    'Register once as an environmental professional and be discovered for projects, research and development finance.',
  small: '90 seconds. One professional profile. More opportunities.',
}

/** The four corner nodes (tablet and desktop) and the 2 by 2 chips (phones). */
export const HERO_NODES: { label: string; icon: IconName; corner: 'tl' | 'tr' | 'bl' | 'br' }[] = [
  { label: 'ESIA and Safeguards', icon: 'leaf', corner: 'tl' },
  { label: 'Climate Change and Carbon', icon: 'cloud-sun', corner: 'tr' },
  { label: 'Water and Hydrogeology', icon: 'droplet', corner: 'bl' },
  { label: 'Biodiversity and Ecosystems', icon: 'sprout', corner: 'br' },
]

/** Hook lines for the floating pills. They take turns on the reels; each is copy from the flier and the PRD. */
export const HERO_HOOKS = [
  'Your expertise, verified.',
  'Discovered by the people who fund the work.',
  'One profile. Many opportunities.',
  'Be found. Be verified. Be engaged.',
  'Where Nigerian environmental expertise gets noticed.',
  'Built for ESIA, safeguards and research.',
  'Ready for World Bank, AfDB and DFI projects.',
  'Your credentials, in one trusted profile.',
] as const

export const TAGLINES = [
  { title: 'Be found.', text: 'Get discovered for projects, research and development finance.' },
  { title: 'Be verified.', text: 'Back your profile with evidence.' },
  { title: 'Be engaged.', text: 'Match with opportunities that fit your expertise.' },
] as const

export const MEMBERSHIP_STRIP = {
  lead: 'Add your professional memberships to your profile',
  items: ['NES', 'IEPN', 'NSE', 'NIA', 'NITP', 'NIM', 'IUCN'],
}

export const ABOUT = {
  eyebrow: 'What is NEXUS-E?',
  title: "Nigeria's Verified Environmental Experts Registry",
  lead: 'NEXUS-E connects qualified Nigerian environmental professionals with opportunities in projects, consultancies, research, government programmes and development finance.',
  cards: [
    {
      icon: 'people',
      title: 'Experts bring expertise.',
      text: 'Qualified Nigerian environmental professionals register once and build a verified profile.',
    },
    {
      icon: 'link',
      title: 'Clients bring opportunities.',
      text: 'Projects, consultancies, research, government programmes and development finance.',
    },
    {
      icon: 'leaf',
      title: 'NEXUS-E connects the two.',
      text: "A searchable directory and opportunities that fit each expert's profile.",
    },
  ] satisfies { icon: IconName; title: string; text: string }[],
}

export const EXPERTISE_SECTION = {
  eyebrow: 'Key areas of expertise',
  title: 'Eighteen areas, one registry',
  lead: 'Choose your main area and up to three more when you register.',
}

export const STEPS: { icon: IconName; title: string; text: string }[] = [
  { icon: 'phone-qr', title: 'Scan', text: 'Scan the QR code' },
  { icon: 'document', title: 'Register', text: 'Complete a 90-second form' },
  { icon: 'shield-check', title: 'Verify', text: 'Build your full profile and upload evidence' },
  { icon: 'user-search', title: 'Be found', text: 'Get matched with relevant opportunities' },
]

export const HOW = {
  eyebrow: 'How it works',
  title: 'Four steps from the flier to the directory',
  quote: 'Building a discoverable, evidence-based network of Nigerian environmental expertise.',
}

export const WHY = {
  eyebrow: 'Why register',
  title: 'Be part of something credible',
  items: [
    'Showcase your expertise',
    'Get discovered for opportunities',
    'Be part of a credible, verified network of Nigerian professionals',
  ],
}

export const AUDIENCE = {
  eyebrow: 'Who finds you',
  title: 'The people who fund and commission the work',
  items: [
    { icon: 'leaf', label: 'Projects' },
    { icon: 'people', label: 'Consultancies' },
    { icon: 'search', label: 'Research' },
    { icon: 'columns', label: 'Government' },
    { icon: 'factory', label: 'Industry' },
    { icon: 'globe', label: 'Development finance' },
    { icon: 'plane', label: 'International opportunities' },
  ] satisfies { icon: IconName; label: string }[],
}

export const PRIVACY = {
  eyebrow: 'Your privacy',
  title: 'Listed only with your consent',
  lead: 'Only experts who are verified and who consent are listed. Phone numbers and emails are never shown publicly.',
  points: [
    'You choose whether to be discoverable when you register, and you can change your mind at any time.',
    'Registration data is stored securely and is visible only to authorised administrators.',
    'The directory does not replace statutory or professional licensing.',
  ],
}

export const DIRECTORY = {
  eyebrow: 'The directory',
  title: 'Find a Verified Expert',
  lead: 'Every expert listed has had their credentials checked and has chosen to be listed.',
  empty: 'No experts are listed yet. They will appear here once they are verified and have chosen to be listed.',
}

export const CTA = {
  title: 'Join the founding experts',
  text: '90 seconds. One professional profile. More opportunities.',
}

export const FAQ = {
  eyebrow: 'FAQ',
  title: 'Frequently asked questions',
  intro: 'Answers about registering, verification and how your profile is found.',
  items: [
    {
      q: 'What is NEXUS-E?',
      a: 'NEXUS-E is a verified registry of environmental professionals. You register once, build one professional profile, and get verified, so organisations looking for expertise can find you.',
    },
    {
      q: 'What are the benefits of registering?',
      a: 'You get one verified professional profile that shows your expertise, experience and the areas you can work in. Verified experts can be found by people searching for the right specialist, and can express interest in project opportunities posted on the platform for projects, research and development finance.',
    },
    {
      q: 'How do I get found?',
      a: 'Once your profile is verified and you have chosen to be listed, it appears in the searchable expert directory. People can search and filter by expertise and location. Keep your profile complete and up to date so the right opportunities match you.',
    },
    {
      q: 'Is my profile secure?',
      a: 'Yes. Your phone number and email address are never shown publicly. Documents you upload for verification are kept in private storage and are used only to verify you. You sign in with a one-time code sent to your email, and you choose whether your profile is listed in the directory.',
    },
    {
      q: 'How does verification work?',
      a: 'After you register, you upload supporting evidence of your qualifications and experience. Our team reviews it and your profile moves from Pending to Under review and then to Verified. If we need more evidence, we will tell you what to add.',
    },
    {
      q: 'Does NEXUS-E replace professional licensing?',
      a: 'No. NEXUS-E does not replace statutory or professional licensing. It confirms your expertise on the registry and helps you be found.',
    },
  ],
} as const
