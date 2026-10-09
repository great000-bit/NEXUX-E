// The complete English dictionary: the source of truth. Every other language is typed against it, so a missing or extra
// key is a compile error, and the wording tests compare placeholders and list lengths with it. At run time the site
// loads it in two parts (see enCore.ts and enSite.ts) so the registration page does not carry the home page's words.
import { enCore } from './enCore'
import { enSite } from './enSite'
import type { Widen } from './types'

export const en = { ...enCore, ...enSite }

export type Messages = Widen<typeof en>
