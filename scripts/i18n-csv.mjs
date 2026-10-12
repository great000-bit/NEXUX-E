// CSV export and import, so a native speaker can review translations in a spreadsheet.
//
//   npm run i18n:export                      writes docs/translations/translations.csv
//   npm run i18n:import -- <file.csv> [xx]   reads it back (all languages in the file, or just xx)
//
// Columns: key, priority, english, then for each language: its text and its status. Every text starts as
// "needs native review". A reviewer fixes the text and sets the status to "reviewed". English is never changed by an import.
import fs from 'node:fs'
import path from 'node:path'
import { flatten, loadDictionary, loadRegistry, parseCsv, priorityOf, readReview, reviewFile, root, serialise, statusOf, toCsv, unflatten, dictDir } from './i18n-lib.mjs'
import { en } from '../src/i18n/en.ts'

const [command, fileArg, only] = process.argv.slice(2)
const { LOCALES } = await loadRegistry()
const others = LOCALES.filter((l) => l.code !== 'en')
const english = flatten(en)

if (command === 'export') {
  const review = readReview()
  const dicts = Object.fromEntries(await Promise.all(others.map(async (l) => [l.code, flatten(await loadDictionary(l.code))])))
  const header = ['key', 'priority', 'english', ...others.flatMap((l) => [l.code, `${l.code}_status`])]
  const rows = [header]
  for (const key of Object.keys(english)) {
    if (key.startsWith('meta.')) continue // technical settings, not words for a reviewer
    rows.push([key, priorityOf(key), english[key], ...others.flatMap((l) => [dicts[l.code][key] ?? '', statusOf(review, l.code, key)])])
  }
  const out = path.join(root, 'docs', 'translations', 'translations.csv')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, toCsv(rows))
  console.log(`Wrote ${out} (${rows.length - 1} texts, ${others.length} languages)`)
} else if (command === 'import') {
  if (!fileArg) throw new Error('Usage: npm run i18n:import -- <file.csv> [language code]')
  const rows = parseCsv(fs.readFileSync(path.resolve(fileArg), 'utf8'))
  const [header, ...body] = rows
  const col = (name) => header.indexOf(name)
  if (col('key') < 0) throw new Error('The file has no "key" column')
  const review = readReview()
  for (const l of others) {
    if (only && l.code !== only) continue
    if (col(l.code) < 0) continue
    // The technical settings (meta.*) are not in the spreadsheet: keep the ones the file already has.
    const flat = Object.fromEntries(Object.entries(flatten(await loadDictionary(l.code))).filter(([k]) => k.startsWith('meta.')))
    review[l.code] = { default: review[l.code]?.default ?? 'needs native review', keys: {} }
    let blanks = 0
    for (const row of body) {
      const key = row[col('key')]
      if (!(key in english) || key.startsWith('meta.')) continue
      const text = (row[col(l.code)] ?? '').trim()
      if (text === '') { blanks += 1; continue }
      flat[key] = text
      if ((row[col(`${l.code}_status`)] ?? '').trim().toLowerCase() === 'reviewed') review[l.code].keys[key] = 'reviewed'
    }
    const complete = blanks === 0
    const type = complete ? 'Messages' : 'DeepPartial<Messages>'
    const imports = complete ? "import type { Messages } from './en'" : "import type { Messages } from './en'\nimport type { DeepPartial } from './types'"
    const file = `// ${l.native}. Generated from the review spreadsheet by scripts/i18n-csv.mjs. English is the source of truth.\n${complete ? '' : '// Some texts are not translated yet: English fills them in, key by key.\n'}${imports}\n\nexport const ${l.code}: ${type} = ${serialise(unflatten(flat))}\n`
    fs.writeFileSync(path.join(dictDir, `${l.code}.ts`), file)
    console.log(`${l.code}: wrote ${Object.keys(flat).length} texts${blanks ? `, ${blanks} blank (English fallback)` : ''}`)
  }
  fs.writeFileSync(reviewFile, JSON.stringify(review, null, 2) + '\n')
} else {
  console.error('Usage: node scripts/i18n-csv.mjs export | import <file.csv> [language code]')
  process.exit(1)
}
