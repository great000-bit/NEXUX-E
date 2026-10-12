// Shared helpers for the translation tools (check, CSV export and import). Run through `node --import ./scripts/register-ts.mjs`
// so the TypeScript dictionaries can be imported as they are.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const dictDir = path.join(root, 'src', 'i18n')
export const reviewFile = path.join(dictDir, 'review.json')

export async function loadRegistry() {
  return import(pathToFileURL(path.join(dictDir, 'locales.ts')).href)
}

export async function loadDictionary(code) {
  const mod = await import(pathToFileURL(path.join(dictDir, `${code}.ts`)).href)
  return mod[code]
}

/** Every text in a dictionary by its path; lists by position: home.faq.items[0].q */
export function flatten(value, prefix = '') {
  if (typeof value === 'string') return { [prefix]: value }
  if (Array.isArray(value)) return Object.assign({}, ...value.map((v, i) => flatten(v, `${prefix}[${i}]`)))
  if (value && typeof value === 'object') {
    return Object.assign({}, ...Object.entries(value).map(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k)))
  }
  return {}
}

/** The reverse of flatten. */
export function unflatten(flat) {
  const out = {}
  for (const [key, text] of Object.entries(flat)) {
    const parts = key.match(/[^.[\]]+/g)
    let node = out
    parts.forEach((part, i) => {
      const last = i === parts.length - 1
      const nextIsIndex = !last && /^\d+$/.test(parts[i + 1])
      if (last) node[part] = text
      else node = node[part] ??= nextIsIndex ? [] : {}
    })
  }
  return out
}

export const placeholders = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',')

/** Keys that carry legal or trust meaning: a native speaker must read these first. */
export const PRIORITY = /^(home\.privacy|dashboard\.privacy|dashboard\.agree|dashboard\.listing|dashboard\.status|verify\.|portal\.errors|register\.fields\.consent|validation\.consent|language\.)/
export const priorityOf = (key) => (PRIORITY.test(key) ? 'privacy and verification' : '')

export function readReview() {
  try {
    return JSON.parse(fs.readFileSync(reviewFile, 'utf8'))
  } catch {
    return {}
  }
}

export function statusOf(review, code, key) {
  return review[code]?.keys?.[key] ?? review[code]?.default ?? 'needs native review'
}

// ---- CSV (RFC 4180)
export function toCsv(rows) {
  const cell = (v) => {
    const s = String(v ?? '')
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function parseCsv(text) {
  const src = text.replace(/^﻿/, '')
  const rows = []
  let row = []
  let field = ''
  let quoted = false
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++ }
      else if (c === '"') quoted = false
      else field += c
    } else if (c === '"') quoted = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((x) => x !== '')) rows.push(row)
      row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); if (row.some((x) => x !== '')) rows.push(row) }
  return rows
}

// ---- Writing a dictionary file
const IDENT = /^[A-Za-z_$][\w$]*$/
const quote = (s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n')}'`
export function serialise(value, indent = 0) {
  const pad = '  '.repeat(indent)
  const inner = '  '.repeat(indent + 1)
  if (typeof value === 'string') return quote(value)
  if (Array.isArray(value)) {
    if (value.every((v) => typeof v === 'string')) return `[\n${value.map((v) => `${inner}${quote(v)},`).join('\n')}\n${pad}]`
    return `[\n${value.map((v) => `${inner}${serialise(v, indent + 1)},`).join('\n')}\n${pad}]`
  }
  const lines = Object.entries(value).map(([k, v]) => `${inner}${IDENT.test(k) ? k : quote(k)}: ${serialise(v, indent + 1)},`)
  return `{\n${lines.join('\n')}\n${pad}}`
}
