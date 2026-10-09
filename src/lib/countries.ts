// The countries a person can register from: all 54 African countries, then "Other". The English names are the values
// stored in the database (and checked there by experts_country_valid); each language shows its own spelling of them.
export const DEFAULT_COUNTRY = 'Nigeria'

export const AFRICAN_COUNTRIES = [
  'Algeria', 'Angola', 'Benin', 'Botswana', 'Burkina Faso', 'Burundi', 'Cabo Verde', 'Cameroon', 'Central African Republic',
  'Chad', 'Comoros', 'Congo', "Côte d'Ivoire", 'Democratic Republic of the Congo', 'Djibouti', 'Egypt', 'Equatorial Guinea',
  'Eritrea', 'Eswatini', 'Ethiopia', 'Gabon', 'Gambia', 'Ghana', 'Guinea', 'Guinea-Bissau', 'Kenya', 'Lesotho', 'Liberia',
  'Libya', 'Madagascar', 'Malawi', 'Mali', 'Mauritania', 'Mauritius', 'Morocco', 'Mozambique', 'Namibia', 'Niger', 'Nigeria',
  'Rwanda', 'São Tomé and Príncipe', 'Senegal', 'Seychelles', 'Sierra Leone', 'Somalia', 'South Africa', 'South Sudan', 'Sudan',
  'Tanzania', 'Togo', 'Tunisia', 'Uganda', 'Zambia', 'Zimbabwe',
] as const

export const OTHER_COUNTRY = 'Other'

export const COUNTRIES = [...AFRICAN_COUNTRIES, OTHER_COUNTRY] as const
export type Country = (typeof COUNTRIES)[number]

export const isCountry = (v: string): v is Country => (COUNTRIES as readonly string[]).includes(v)

/** Nigeria is the only country with its own list of states. Everywhere else the person types a state, province or region. */
export const hasStateList = (country: string) => country === 'Nigeria'
