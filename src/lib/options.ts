// Single source of truth for every dropdown and choice list in the PRD (sections 5 and 6).

export const TITLES = ['Prof', 'Dr', 'Engr', 'Arc', 'Tpl', 'Mr', 'Mrs', 'Ms', 'Other'] as const

export const STATES = [
  'Abia', 'Adamawa', 'Akwa Ibom', 'Anambra', 'Bauchi', 'Bayelsa', 'Benue', 'Borno',
  'Cross River', 'Delta', 'Ebonyi', 'Edo', 'Ekiti', 'Enugu', 'Federal Capital Territory',
  'Gombe', 'Imo', 'Jigawa', 'Kaduna', 'Kano', 'Katsina', 'Kebbi', 'Kogi', 'Kwara',
  'Lagos', 'Nasarawa', 'Niger', 'Ogun', 'Ondo', 'Osun', 'Oyo', 'Plateau', 'Rivers',
  'Sokoto', 'Taraba', 'Yobe', 'Zamfara', 'Outside Nigeria',
] as const

export const EXPERTISE = [
  'ESIA and Safeguards',
  'Biodiversity and Ecosystems',
  'Water and Hydrogeology',
  'Geology and Earth Sciences',
  'Climate Change and Carbon',
  'Social and Economic Studies',
  'Gender and Inclusion',
  'Pollution and Environmental Quality',
  'GIS and Remote Sensing',
  'Marine and Blue Economy',
  'Environmental Engineering',
  'Policy, Governance and Regulation',
  'ESG and Sustainability',
  'Occupational and Community Health',
  'Other Specialised Expertise',
  'Environmental Educator',
  'Environmental IT',
  'Environmental Media',
] as const

export const MAX_SECONDARY = 3

export const YEARS = ['Under 5', '5 to 10', '11 to 20', '21 to 30', '30+'] as const

// The PRD asks for a dropdown but does not list the options. This is a standard ladder.
export const QUALIFICATIONS = [
  'OND / NCE',
  'HND',
  "Bachelor's degree (BSc, BEng, BTech)",
  'Postgraduate diploma',
  "Master's degree (MSc, MEng, MPhil)",
  'Doctorate (PhD)',
  'Professional certification only',
  'Other',
] as const

export const MEMBERSHIPS = ['NES', 'IEPN', 'NSE', 'NIA', 'NITP', 'NIM', 'IUCN', 'Others'] as const

export const ASSIGNMENTS = [
  'Consulting',
  'ESIA/EIA',
  'Environmental and Social Safeguards',
  'Technical Expert Panels',
  'Field Surveys',
  'Research',
  'Government Projects',
  'World Bank/AfDB/DFI Projects',
  'Oil and Gas',
  'Infrastructure',
  'Training',
  'Expert Review',
  'Short-term international assignments',
] as const

export const AVAILABILITY = ['State only', 'Nigeria', 'West Africa', 'Africa', 'International'] as const
