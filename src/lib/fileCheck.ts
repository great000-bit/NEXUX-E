import { fmt, messages } from '../i18n'
import { MAX_FILE_BYTES } from './verification'

// An early, friendly check in the browser. The server repeats it on the real stored bytes,
// so this is for speed and clear messages, not for security.

export type Mime = 'application/pdf' | 'image/jpeg' | 'image/png'
export type ClientCheck = { ok: true; mime: Mime } | { ok: false; message: string }

export function sniff(head: Uint8Array): Mime | null {
  const has = (sig: number[]) => sig.every((b, i) => head[i] === b)
  if (has([0x25, 0x50, 0x44, 0x46, 0x2d])) return 'application/pdf'
  if (has([0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (has([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png'
  return null
}

export async function checkBeforeUpload(file: File): Promise<ClientCheck> {
  const t = messages().files
  if (file.size === 0) return { ok: false, message: t.empty }
  if (file.size > MAX_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1)
    return { ok: false, message: fmt(t.tooLarge, { mb }) }
  }
  if (!/\.(pdf|jpe?g|png)$/i.test(file.name)) {
    return { ok: false, message: t.badName }
  }
  const head = new Uint8Array(await file.slice(0, 16).arrayBuffer())
  const mime = sniff(head)
  if (!mime) {
    return { ok: false, message: t.notReal }
  }
  return { ok: true, mime }
}

export const formatSize = (bytes: number) => {
  const t = messages().files
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} ${t.unitKb}` : `${(bytes / (1024 * 1024)).toFixed(1)} ${t.unitMb}`
}
