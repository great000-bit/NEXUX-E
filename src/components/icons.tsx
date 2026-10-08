import type { ReactNode } from 'react'

/**
 * One line icon set for the whole site: 24 px grid, 1.6 px round strokes, drawn to match each other.
 * Decorative by default (aria-hidden). Pass a label to make one meaningful.
 */
const PATHS = {
  // Interface
  'arrow-right': <><path d="M5 12h14" /><path d="m13 6 6 6-6 6" /></>,
  'arrow-up-right': <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  'arrow-down': <><path d="M12 5v14" /><path d="m6 13 6 6 6-6" /></>,
  menu: <><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></>,
  close: <><path d="m6 6 12 12" /><path d="M18 6 6 18" /></>,
  user: <><circle cx="12" cy="8" r="3.6" /><path d="M5 20c0-3.9 3.1-6.5 7-6.5s7 2.6 7 6.5" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  'shield-check': <><path d="M12 3 5 6v5.5c0 4.3 3 7.7 7 9.5 4-1.8 7-5.2 7-9.5V6z" /><path d="m8.8 12 2.4 2.4 4.2-4.6" /></>,

  // The fifteen areas of expertise
  link: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  leaf: <><path d="M5 19C5 11 10 6 19 5c0 9-5 14-13 14" /><path d="M5 19 13 11" /></>,
  sprout: <><path d="M12 21V11" /><path d="M12 14c-4 0-6-2-6-6 4 0 6 2 6 6Z" /><path d="M12 11c0-4 2-6 6-6 0 4-2 6-6 6Z" /></>,
  droplet: <path d="M12 3c3.5 4.5 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 2.5-6.5 6-11Z" />,
  mountain: <><path d="M3 19 9 9l4 6 2.5-3.5L21 19z" /><path d="m7 12.5 2 1.5 2-1.5" /></>,
  'cloud-sun': <><circle cx="17.5" cy="6.5" r="2.2" /><path d="M7 19a4 4 0 0 1-.4-8 5.2 5.2 0 0 1 9.6 1.4A3.3 3.3 0 0 1 16.5 19z" /></>,
  'bar-chart': <><path d="M3 20h18" /><path d="M6 20v-7" /><path d="M12 20V6" /><path d="M18 20v-10" /></>,
  people: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" /><circle cx="17" cy="9" r="2.4" /><path d="M16 13.7c2.8-.3 5 1.6 5 4.8" /></>,
  cog: <><circle cx="12" cy="12" r="3" /><circle cx="12" cy="12" r="6.6" /><path d="M12 3v2.4M12 18.6V21M3 12h2.4M18.6 12H21M5.6 5.6l1.7 1.7M16.7 16.7l1.7 1.7M18.4 5.6l-1.7 1.7M7.3 16.7l-1.7 1.7" /></>,
  'map-pin': <><path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10Z" /><circle cx="12" cy="11" r="2.2" /></>,
  waves: <><path d="M3 8.5c2 0 2.5-1.5 4.5-1.5S10 8.5 12 8.5 14.5 7 16.5 7 19 8.5 21 8.5" /><path d="M3 13.5c2 0 2.5-1.5 4.5-1.5S10 13.5 12 13.5 14.5 12 16.5 12 19 13.5 21 13.5" /><path d="M3 18.5c2 0 2.5-1.5 4.5-1.5S10 18.5 12 18.5 14.5 17 16.5 17 19 18.5 21 18.5" /></>,
  hardhat: <><path d="M5 15a7 7 0 0 1 14 0" /><path d="M3 15h18v3H3z" /><path d="M12 8v7" /></>,
  scales: <><path d="M12 4v16" /><path d="M7 20h10" /><path d="M5 7h14" /><path d="M5 7 2.6 13a2.9 2.9 0 0 0 4.8 0z" /><path d="M19 7l-2.4 6a2.9 2.9 0 0 0 4.8 0z" /></>,
  buildings: <><path d="M4 20V6l7-2v16" /><path d="M11 20V9l9 3v8" /><path d="M3 20h18" /><path d="M7 9h1M7 13h1M14.5 14h1M14.5 17h1" /></>,
  'heart-pulse': <><path d="M12 20S4 15 4 9.2A4.4 4.4 0 0 1 12 6.6 4.4 4.4 0 0 1 20 9.2C20 15 12 20 12 20Z" /><path d="M6.5 12h3l1.4-2.6 2.4 5 1.4-2.4h2.8" /></>,
  clipboard: <><rect x="6" y="4" width="12" height="17" rx="2" /><path d="M9.5 4V3h5v1" /><path d="m9.2 13 2.1 2.1 3.7-3.9" /></>,

  // How it works
  'phone-qr': <><rect x="6.5" y="2.5" width="11" height="19" rx="2.4" /><rect x="9.3" y="6" width="2.3" height="2.3" /><rect x="12.4" y="6" width="2.3" height="2.3" /><rect x="9.3" y="9.1" width="2.3" height="2.3" /><path d="M13 10h1.6M12.6 12.4h2" /><path d="M10.5 18.6h3" /></>,
  document: <><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4" /><path d="M9.8 12h5M9.8 15.6h5" /></>,
  'user-search': <><circle cx="10" cy="8" r="3.2" /><path d="M4 20c0-3.5 2.7-6 6-6 1.2 0 2.3.3 3.2.9" /><circle cx="17" cy="16.5" r="3" /><path d="m19.2 18.7 2.3 2.3" /></>,

  // Who finds you
  search: <><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></>,
  columns: <><path d="m3 9 9-5 9 5z" /><path d="M5.5 9v9M9.8 9v9M14.2 9v9M18.5 9v9" /><path d="M3 20h18" /></>,
  factory: <><path d="M3 20V12l6-3v3l6-3v3l6-3v11z" /><path d="M7 16h2M12 16h2M17 16h2" /></>,
  globe: <><circle cx="12" cy="12" r="8.5" /><path d="M3.5 12h17" /><path d="M12 3.5c3 3 3 14 0 17" /><path d="M12 3.5c-3 3-3 14 0 17" /></>,
  plane: <><path d="M21 4 3 10.5l7.5 2.7L13.5 21z" /><path d="m21 4-10.5 9.2" /></>,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  className = 'h-5 w-5',
  strokeWidth = 1.6,
  label,
}: {
  name: IconName
  className?: string
  strokeWidth?: number
  label?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  )
}

/** The icon for each area of expertise, keyed by the exact names used in registration. */
export const EXPERTISE_ICON: Record<string, IconName> = {
  'ESIA and Safeguards': 'leaf',
  'Biodiversity and Ecosystems': 'sprout',
  'Water and Hydrogeology': 'droplet',
  'Geology and Earth Sciences': 'mountain',
  'Climate Change and Carbon': 'cloud-sun',
  'Social and Economic Studies': 'bar-chart',
  'Gender and Inclusion': 'people',
  'Pollution and Environmental Quality': 'cog',
  'GIS and Remote Sensing': 'map-pin',
  'Marine and Blue Economy': 'waves',
  'Environmental Engineering': 'hardhat',
  'Policy, Governance and Regulation': 'scales',
  'ESG and Sustainability': 'buildings',
  'Occupational and Community Health': 'heart-pulse',
  'Other Specialised Expertise': 'clipboard',
}
