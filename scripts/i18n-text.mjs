// A compact text format for writing a translation, and the tool that turns it into a dictionary file.
//
//   npm run i18n:template                         prints the English as a template (section headers, then "leaf = text")
//   npm run i18n:from-text -- <code> <file.txt>   writes src/i18n/<code>.ts from such a file
//
// Format: "[home.faq]" starts a section, then one "leaf = text" line per text; lists use [0], [1] ... in the leaf
// ("items[0].q = ..."). Lines starting with # are comments. A text that is the same in every language (an acronym, an
// example address) may be left out: it is copied from English. Anything else that is missing is an error, so a language
// can never be marked complete with texts missing.
import fs from 'node:fs'
import path from 'node:path'
import { dictDir, flatten, loadDictionary, placeholders, serialise, unflatten } from './i18n-lib.mjs'
import { en } from '../src/i18n/en.ts'

const english = flatten(en)

/** Texts that read the same in every language. */
const SAME_EVERYWHERE = (key, text) =>
  key === 'meta.siteName' ||
  /^[A-Z0-9][A-Z0-9 /.&+-]*$/.test(text) && text.length <= 12 ||
  /@example\.com$|^linkedin\.com\/in\//.test(text) ||
  /^[0-9+ ]+$/.test(text)

const [command, codeArg, fileArg] = process.argv.slice(2)

if (command === 'template') {
  let section = ''
  const out = []
  for (const [key, text] of Object.entries(english)) {
    const m = /^(.*?)(?:\.([^.[\]]+(?:\[\d+\](?:\.[^.[\]]+)*)?))$/.exec(key)
    const sec = m ? m[1] : ''
    const leaf = m ? m[2] : key
    if (sec !== section) { out.push(`\n[${sec}]`); section = sec }
    if (SAME_EVERYWHERE(key, text)) continue
    out.push(`${leaf} = ${text}`)
  }
  console.log(out.join('\n'))
} else if (command === 'from-text' || command === 'merge') {
  if (!codeArg || !fileArg) throw new Error('Usage: npm run i18n:from-text -- <code> <file.txt>')
  // "merge" adds the texts in the file to a dictionary that already exists, and leaves the rest as it is.
  const flat = command === 'merge' ? flatten(await loadDictionary(codeArg)) : {}
  let section = ''
  const lines = fs.readFileSync(path.resolve(fileArg), 'utf8').split(/\r?\n/)
  lines.forEach((raw, n) => {
    const line = raw.trim()
    if (!line || line.startsWith('#')) return
    const head = /^\[(.*)\]$/.exec(line)
    if (head) { section = head[1]; return }
    const eq = line.indexOf(' = ')
    if (eq < 0) throw new Error(`line ${n + 1}: expected "leaf = text": ${line.slice(0, 60)}`)
    const leaf = line.slice(0, eq).trim()
    flat[section ? `${section}.${leaf}` : leaf] = line.slice(eq + 3).trim()
  })
  const problems = []
  for (const [key, text] of Object.entries(english)) {
    if (!(key in flat)) {
      if (key === 'meta.code') flat[key] = codeArg
      else if (SAME_EVERYWHERE(key, text)) flat[key] = text
      else problems.push(`missing: ${key}`)
    } else if (placeholders(flat[key]) !== placeholders(text)) problems.push(`placeholders differ: ${key}`)
  }
  for (const key of Object.keys(flat)) if (!(key in english)) problems.push(`not an English key: ${key}`)
  flat['meta.code'] = codeArg
  if (problems.length) {
    console.error(`${problems.length} problems:\n` + problems.slice(0, 80).join('\n'))
    process.exit(1)
  }
  const file = `// ${codeArg}. Machine translated from the English file, which stays the source of truth. Marked "needs native review" in review.json.\nimport type { Messages } from './en'\n\nexport const ${codeArg}: Messages = ${serialise(unflatten(flat))}\n`
  fs.writeFileSync(path.join(dictDir, `${codeArg}.ts`), file)
  console.log(`${codeArg}: wrote ${Object.keys(flat).length} texts`)
} else {
  console.error('Usage: node scripts/i18n-text.mjs template | from-text <code> <file.txt>')
  process.exit(1)
}
