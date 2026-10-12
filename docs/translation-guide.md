# Translation guide

How the site picks a language, how a language is built, and how a native speaker reviews one.

## How a visitor gets a language

No popup, no banner, no question. The order is:

1. **A saved pick.** If the visitor ever chose a language from the picker in the header, that choice is kept in
   `localStorage` (guarded with try/catch) and used from then on. Nothing overrides it.
2. **The browser's language list**, if it contains a live language other than English. English is skipped on purpose: it
   is the default on many phones and says little about the visitor, while the country says more. Someone who really wants
   English chooses it once from the picker, and that is saved.
3. **The visitor's country**, from `api/geo.js`, a small Vercel Function that returns only `{country}`, copied from the
   `x-vercel-ip-country` header Vercel adds. It never reads, logs or stores the IP, and sends `Cache-Control: no-store`.
   The page asks once per visit (the answer, or the failure, is kept in `sessionStorage`), gives up after 1.5 seconds,
   and never holds the page up: English shows first and the page switches when the answer arrives.
4. **English.**

Only a visitor's own pick is saved. A language chosen by steps 2 or 3 is never saved, so it can change if the visitor
travels or changes their browser.

The admin area is staff-only and always English.

## Where things live (`src/i18n/`)

| File | What it is |
|------|------------|
| `locales.ts` | The language registry: code, English name, native name, direction (`ltr` or `rtl`), font script, and the list of planned later languages. |
| `countryLanguages.ts` | One row for each of the 54 African countries: `default` language and `additional` languages. |
| `detect.ts` | The detection order (pure functions, covered by tests). |
| `index.ts` | The loaders (one line per language), the saved choice, and the current words for code outside React. |
| `fallback.ts` | Per-key English fallback. |
| `en.ts`, `enCore.ts`, `enSite.ts` | English, the source of truth. `enCore` is bundled with every page, `enSite` only with the pages that need it. |
| `fr.ts`, `ar.ts`, `pt.ts` | Live translations, typed against English. |
| `review.json` | The review status of each translated text. |
| `fonts.ts` | Loads the font for a script (Arabic) only when a language that needs it is on screen. |

Only English is bundled with the page. Every other language is its own file, fetched when it is needed, and the Arabic
font is fetched only for Arabic.

## Adding a language (for example Swahili)

1. Add a row to `LOCALES` in `locales.ts` (and remove it from `PLANNED_LANGUAGES`). Give it `dir` and `font`.
2. Create `src/i18n/sw.ts`: `export const sw: Messages = {...}` (or `DeepPartial<Messages>` if it is not finished: English
   fills any text it lacks, key by key).
3. Add one line to `loaders` in `index.ts`, and the code to `LocaleCode` in `locales.ts`.
4. Add the language to `review.json`.
5. Run `npm test`. The check fails on any missing key, changed `{placeholder}` or changed list length.

Countries need no change: Kenya and Tanzania already say `sw`, so they switch to Swahili as soon as it is live.

A right-to-left language also needs `dir: 'rtl'` (the page direction follows it) and, if its script is not Latin, an
entry in `fonts.ts`. Public pages use logical positions (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`), so they mirror by
themselves.

## Checks

- `npm run check:i18n` (also run by `npm test`): every live language has exactly the same keys as English, the same
  placeholders and list lengths, and no empty text. It also checks the country data against the registration form's
  country list. TypeScript additionally refuses a live language file that lacks a key.
- `npm test`: the same, plus wording rules (no dashes, nothing says "Nigerian"), the Arabic and right to left rules, the
  detection order and the geo function.

## Reviewing translations with a spreadsheet

```
npm run i18n:export                         # writes docs/translations/translations.csv
npm run i18n:import -- <file.csv> [code]    # reads it back (all languages in the file, or one)
```

Columns: `key`, `priority`, `english`, then for each language its text and `<code>_status`.

- Every text starts as **needs native review**. The reviewer corrects the text and changes the status to **reviewed**.
- Rows marked `privacy and verification` carry legal or trust meaning (privacy text, the sign-in and verification flow,
  consent wording, status names). Review these first.
- A blank cell is not translated yet: the import leaves the key out and English fills it in.
- English is never changed by an import. Change English in `enCore.ts` or `enSite.ts`, then export again.
- Technical settings (`meta.*`) are not in the spreadsheet.

The import rewrites `src/i18n/<code>.ts` and `review.json`. Run `npm test` afterwards.

## Machine translation status

All French, Portuguese and Arabic text, and all Tier 2 text (Swahili, Amharic, Hausa, Yoruba, Igbo, Zulu, Xhosa,
Afrikaans, Somali, Oromo, Malagasy, Kinyarwanda, Shona), was machine translated from the English and is marked
**needs native review** in `review.json` and in `docs/translations/translations.csv`. The rows a native speaker should read
first are marked `privacy and verification` in the `priority` column: the privacy notice, the consent lines, verification,
and everything that says memberships are self-declared. Emails are English only for now. Arabic number words (for
example the day counts) need a native check for plural forms.

## When a country switches language

A country's default language is used only when that language is **complete** (`complete: true` in `locales.ts`, which means
every text is translated; `npm run check:i18n` fails the build if a live language lacks a key). A language that is
not complete is never chosen for a country, so a visitor is never switched into a half finished language.
Amharic is the one language that needs another script (Ethiopic); its font is fetched only while Amharic is on screen.
Oromo is written in the Latin script and needs no extra font. None of the new languages is right to left.

## Later tiers (not live)

Tigrinya, Kirundi, Setswana, Sesotho, Chichewa, Wolof, Lingala, Spanish, Bambara, Berber and Swati. They are already
named in `PLANNED_LANGUAGES`, and the country data already lists them for each country.
