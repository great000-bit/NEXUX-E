// The build check for translations: fails when a live language is missing a key (or has an extra one), changes a
// {placeholder}, changes the length of a list, or leaves a text empty. Also checks the country data against the
// registration form's country list. Run with: npm run check:i18n
import { COUNTRIES, AFRICAN_COUNTRIES } from '../src/lib/countries.ts'
import { COUNTRY_LANGUAGES } from '../src/i18n/countryLanguages.ts'
import { flatten, loadDictionary, loadRegistry, placeholders } from './i18n-lib.mjs'
import { en } from '../src/i18n/en.ts'

const { LOCALES, KNOWN_LANGUAGE_CODES } = await loadRegistry()
const problems = []
const english = flatten(en)

for (const l of LOCALES) {
  if (l.code === 'en') continue
  const dict = flatten(await loadDictionary(l.code))
  for (const key of Object.keys(english)) {
    if (!(key in dict)) problems.push(`${l.code}: missing key ${key}`)
    else if (dict[key].trim() === '') problems.push(`${l.code}: empty text for ${key}`)
    else if (placeholders(dict[key]) !== placeholders(english[key])) problems.push(`${l.code}: placeholders differ from English in ${key}`)
  }
  for (const key of Object.keys(dict)) if (!(key in english)) problems.push(`${l.code}: extra key ${key} (not in English)`)
}

const names = new Set(Object.values(COUNTRY_LANGUAGES).map((c) => c.name))
for (const name of AFRICAN_COUNTRIES) if (!names.has(name)) problems.push(`country data: no row for ${name}`)
if (Object.keys(COUNTRY_LANGUAGES).length !== AFRICAN_COUNTRIES.length) problems.push('country data: the number of rows is not 54')
for (const [iso, row] of Object.entries(COUNTRY_LANGUAGES)) {
  for (const code of [row.default, ...row.additional]) if (!KNOWN_LANGUAGE_CODES.includes(code)) problems.push(`country data: ${iso} uses unknown language ${code}`)
}
void COUNTRIES

if (problems.length) {
  console.error(`Translation check failed (${problems.length}):\n` + problems.slice(0, 60).map((p) => '  ' + p).join('\n'))
  process.exit(1)
}
console.log(`Translation check passed: ${LOCALES.length} languages, ${Object.keys(english).length} texts each, 54 countries.`)
