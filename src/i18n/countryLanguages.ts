// One row for each of the 54 African countries: the language a visitor from there is shown, and the other languages
// people there commonly use. `name` is the exact name used in the registration form's country list.
//
// `default` is the language chosen for a visitor from that country, when that language is live (see LOCALES). When it is
// not live yet, the visitor sees English. So a language going live later (say Swahili) needs no change here: Kenya and
// Tanzania already say `sw`. `additional` lists the other languages for later tiers, and for choosing what to translate next.
//
// Tonight's defaults follow the agreed map: Arabic for EG, LY and SD; French for BJ, BF, BI, CF, CD, CG, CI, CM, DJ, DZ,
// GA, GN, KM, MA, MG, ML, MR, NE, SN, TD, TG, TN; Portuguese for AO, CV, GW, MZ, ST; English everywhere else.

export type CountryLanguages = {
  name: string
  default: string
  additional: readonly string[]
}

export const COUNTRY_LANGUAGES: Readonly<Record<string, CountryLanguages>> = {
  DZ: { name: 'Algeria', default: 'fr', additional: ['ar', 'ber'] },
  AO: { name: 'Angola', default: 'pt', additional: [] },
  BJ: { name: 'Benin', default: 'fr', additional: [] },
  BW: { name: 'Botswana', default: 'en', additional: ['tn'] },
  BF: { name: 'Burkina Faso', default: 'fr', additional: [] },
  BI: { name: 'Burundi', default: 'fr', additional: ['rn', 'en', 'sw'] },
  CV: { name: 'Cabo Verde', default: 'pt', additional: [] },
  CM: { name: 'Cameroon', default: 'fr', additional: ['en'] },
  CF: { name: 'Central African Republic', default: 'fr', additional: [] },
  TD: { name: 'Chad', default: 'fr', additional: ['ar'] },
  KM: { name: 'Comoros', default: 'fr', additional: ['ar'] },
  CG: { name: 'Congo', default: 'fr', additional: ['ln'] },
  CI: { name: "Côte d'Ivoire", default: 'fr', additional: [] },
  CD: { name: 'Democratic Republic of the Congo', default: 'fr', additional: ['sw', 'ln'] },
  DJ: { name: 'Djibouti', default: 'fr', additional: ['ar', 'so'] },
  EG: { name: 'Egypt', default: 'ar', additional: ['en'] },
  GQ: { name: 'Equatorial Guinea', default: 'es', additional: ['fr', 'pt'] },
  ER: { name: 'Eritrea', default: 'ti', additional: ['ar', 'en'] },
  SZ: { name: 'Eswatini', default: 'en', additional: ['ss'] },
  ET: { name: 'Ethiopia', default: 'am', additional: ['om', 'ti', 'so', 'en'] },
  GA: { name: 'Gabon', default: 'fr', additional: [] },
  GM: { name: 'Gambia', default: 'en', additional: [] },
  GH: { name: 'Ghana', default: 'en', additional: [] },
  GN: { name: 'Guinea', default: 'fr', additional: [] },
  GW: { name: 'Guinea-Bissau', default: 'pt', additional: [] },
  KE: { name: 'Kenya', default: 'sw', additional: ['en'] },
  LS: { name: 'Lesotho', default: 'en', additional: ['st'] },
  LR: { name: 'Liberia', default: 'en', additional: [] },
  LY: { name: 'Libya', default: 'ar', additional: [] },
  MG: { name: 'Madagascar', default: 'fr', additional: ['mg'] },
  MW: { name: 'Malawi', default: 'en', additional: ['ny'] },
  ML: { name: 'Mali', default: 'fr', additional: ['bm'] },
  MR: { name: 'Mauritania', default: 'fr', additional: ['ar'] },
  MU: { name: 'Mauritius', default: 'en', additional: ['fr'] },
  MA: { name: 'Morocco', default: 'fr', additional: ['ar', 'ber'] },
  MZ: { name: 'Mozambique', default: 'pt', additional: ['sw'] },
  NA: { name: 'Namibia', default: 'en', additional: ['af'] },
  NE: { name: 'Niger', default: 'fr', additional: ['ha'] },
  NG: { name: 'Nigeria', default: 'en', additional: ['ha', 'yo', 'ig'] },
  RW: { name: 'Rwanda', default: 'rw', additional: ['en', 'fr', 'sw'] },
  ST: { name: 'São Tomé and Príncipe', default: 'pt', additional: [] },
  SN: { name: 'Senegal', default: 'fr', additional: ['wo'] },
  SC: { name: 'Seychelles', default: 'en', additional: ['fr'] },
  SL: { name: 'Sierra Leone', default: 'en', additional: [] },
  SO: { name: 'Somalia', default: 'so', additional: ['ar', 'en'] },
  ZA: { name: 'South Africa', default: 'en', additional: ['zu', 'xh', 'af'] },
  SS: { name: 'South Sudan', default: 'en', additional: ['ar'] },
  SD: { name: 'Sudan', default: 'ar', additional: ['en'] },
  TZ: { name: 'Tanzania', default: 'sw', additional: ['en'] },
  TG: { name: 'Togo', default: 'fr', additional: [] },
  TN: { name: 'Tunisia', default: 'fr', additional: ['ar'] },
  UG: { name: 'Uganda', default: 'en', additional: ['sw'] },
  ZM: { name: 'Zambia', default: 'en', additional: [] },
  ZW: { name: 'Zimbabwe', default: 'en', additional: ['sn'] },
}
