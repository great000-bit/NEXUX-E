// Shrinks big phone photos in the browser before they are uploaded, so weak mobile data is not wasted
// and nobody is turned away for a 7 MB photo. PDFs are never touched. The server still enforces 5 MB.

export const TARGET_BYTES = 2 * 1024 * 1024
export const MAX_SIDE = 2000
export const MIN_SIDE = 1000

/** The size an image should be drawn at so its longest side is at most `max`. Never enlarges. */
export function fitWithin(width: number, height: number, max = MAX_SIDE) {
  const longest = Math.max(width, height)
  const scale = longest > max ? max / longest : 1
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)), scale }
}

/** True when a photo is worth shrinking: too many bytes, or too many pixels. */
export function needsCompression(bytes: number, width: number, height: number): boolean {
  return bytes > TARGET_BYTES || Math.max(width, height) > MAX_SIDE
}

/**
 * The tries to make, in order: good quality first, then lower quality, then a smaller picture.
 * Each try is { quality, sideFactor } where sideFactor scales the already fitted size.
 */
export function attempts(): { quality: number; sideFactor: number }[] {
  const out: { quality: number; sideFactor: number }[] = []
  for (const sideFactor of [1, 0.85, 0.7, 0.55]) {
    for (const quality of [0.85, 0.75, 0.65, 0.55]) out.push({ quality, sideFactor })
  }
  return out
}

export const jpgName = (name: string) => `${name.replace(/\.[^./\\]+$/, '') || 'photo'}.jpg`

export type Prepared = { file: File; resized: boolean; before: number }

async function decode(file: File): Promise<{ draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === 'function') {
    // 'from-image' applies the phone's rotation, so portrait photos do not come out sideways.
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    return { width: bmp.width, height: bmp.height, draw: (ctx, w, h) => ctx.drawImage(bmp, 0, 0, w, h), close: () => bmp.close() }
  }
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    return { width: img.naturalWidth, height: img.naturalHeight, draw: (ctx, w, h) => ctx.drawImage(img, 0, 0, w, h), close: () => undefined }
  } finally {
    URL.revokeObjectURL(url)
  }
}

const toBlob = (canvas: HTMLCanvasElement, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))

/**
 * Returns the file to upload. Small photos and anything that is not a JPG or PNG come back unchanged.
 * If the picture cannot be read in the browser, it also comes back unchanged and the server decides.
 */
export async function prepareImage(file: File): Promise<Prepared> {
  const unchanged: Prepared = { file, resized: false, before: file.size }
  if (!/^image\/(jpeg|png)$/.test(file.type) && !/\.(jpe?g|png)$/i.test(file.name)) return unchanged

  let src
  try {
    src = await decode(file)
  } catch {
    return unchanged
  }
  try {
    if (!needsCompression(file.size, src.width, src.height)) return unchanged

    const fitted = fitWithin(src.width, src.height)
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return unchanged

    let best: Blob | null = null
    for (const { quality, sideFactor } of attempts()) {
      const w = Math.max(1, Math.round(fitted.width * sideFactor))
      const h = Math.max(1, Math.round(fitted.height * sideFactor))
      if (Math.max(w, h) < MIN_SIDE && sideFactor < 1) break
      canvas.width = w
      canvas.height = h
      // White behind the picture, because a JPEG has no transparency (a screenshot of a certificate, say).
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, w, h)
      src.draw(ctx, w, h)
      const blob = await toBlob(canvas, quality)
      if (!blob) continue
      if (!best || blob.size < best.size) best = blob
      if (blob.size <= TARGET_BYTES) break
    }
    if (!best) return unchanged
    // Never make a file bigger just to resize it.
    if (best.size >= file.size && file.size <= TARGET_BYTES) return unchanged
    return {
      file: new File([best], jpgName(file.name), { type: 'image/jpeg', lastModified: Date.now() }),
      resized: true,
      before: file.size,
    }
  } finally {
    src.close()
  }
}
