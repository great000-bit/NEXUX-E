// Decides whether an uploaded file is acceptable by looking at its bytes, never at its name.
// Pure functions only, so the same code runs in the Edge Function and in tests.

export const MAX_BYTES = 5 * 1024 * 1024
export const MAX_FILES = 8

export type Detected = { mime: 'application/pdf' | 'image/jpeg' | 'image/png'; ext: 'pdf' | 'jpg' | 'png' }

export type FileCheck =
  | { ok: true; type: Detected }
  | { ok: false; code: 'empty' | 'too_large' | 'bad_type' | 'active_content'; message: string }

const startsWith = (bytes: Uint8Array, sig: number[]) => sig.every((b, i) => bytes[i] === b)

export function detectType(bytes: Uint8Array): Detected | null {
  // %PDF-
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf' }
  // FF D8 FF
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' }
  // 89 PNG CR LF 1A LF
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' }
  return null
}

/** PDFs that run scripts or launch programs have no place in an evidence upload. */
export function pdfHasActiveContent(bytes: Uint8Array): boolean {
  const text = new TextDecoder('latin1').decode(bytes)
  return /\/(JavaScript|Launch)\b|\/JS\b/.test(text)
}

export function checkFile(bytes: Uint8Array): FileCheck {
  if (bytes.length === 0) {
    return { ok: false, code: 'empty', message: 'This file is empty. Please choose the file again.' }
  }
  if (bytes.length > MAX_BYTES) {
    return { ok: false, code: 'too_large', message: 'This file is larger than 5 MB. Please choose a smaller one, or a lower resolution scan.' }
  }
  const type = detectType(bytes)
  if (!type) {
    return {
      ok: false,
      code: 'bad_type',
      message: 'We could not read this file as a PDF, JPG or PNG. Please save or scan it again in one of those formats.',
    }
  }
  if (type.mime === 'application/pdf' && pdfHasActiveContent(bytes)) {
    return {
      ok: false,
      code: 'active_content',
      message: 'This PDF contains active content, such as scripts, which we cannot accept. Please print it to a new PDF or upload a photo of the document.',
    }
  }
  return { ok: true, type }
}

/** Plain file names only: the extension decides nothing, but we still keep a sensible label. */
export function extensionOf(name: string): string {
  const m = /\.([A-Za-z0-9]{1,5})$/.exec(name.trim())
  return m ? m[1].toLowerCase() : ''
}
