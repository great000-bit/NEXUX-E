// The words currently on screen, kept in one place so code outside React (the form checks, the server answers, the file
// checks) says the same thing as the page. Components read the same dictionary through useMessages().
// The site is English only for now: nothing here reads storage or loads another language. The French and Portuguese
// files (fr.ts, pt.ts) stay in the repository, unused, so a later plan can reuse them.
import { enRuntime as en } from './enCore'
import type { Messages } from './en'
import { DEFAULT_LOCALE, type LocaleCode } from './locales'

export { fmt } from './types'
export type { Messages } from './en'

let currentMessages: Messages = en
let currentCode: LocaleCode = DEFAULT_LOCALE

export const messages = (): Messages => currentMessages
export const currentLocale = (): LocaleCode => currentCode

export function setCurrent(code: LocaleCode, m: Messages) {
  currentCode = code
  currentMessages = m
}
