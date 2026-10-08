import { test } from 'node:test'
import assert from 'node:assert/strict'
import { attempts, fitWithin, jpgName, MAX_SIDE, MIN_SIDE, needsCompression, prepareImage, TARGET_BYTES } from './image.ts'

const MB = 1024 * 1024

test('a typical phone photo (4032 by 3024) is brought down to 2000 on the long side, keeping its shape', () => {
  const r = fitWithin(4032, 3024)
  assert.equal(Math.max(r.width, r.height), MAX_SIDE)
  assert.equal(r.width, 2000)
  assert.equal(r.height, 1500)
  assert.ok(Math.abs(r.width / r.height - 4032 / 3024) < 0.01)
})

test('portrait photos and square pictures are handled the same way', () => {
  assert.deepEqual(fitWithin(3024, 4032), { width: 1500, height: 2000, scale: 2000 / 4032 })
  assert.equal(fitWithin(5000, 5000).width, 2000)
})

test('a picture that already fits is never enlarged', () => {
  const r = fitWithin(800, 600)
  assert.deepEqual(r, { width: 800, height: 600, scale: 1 })
})

test('only photos that are too heavy or too large are shrunk', () => {
  assert.equal(needsCompression(7 * MB, 4032, 3024), true, 'heavy and large')
  assert.equal(needsCompression(1 * MB, 4032, 3024), true, 'light but too many pixels')
  assert.equal(needsCompression(3 * MB, 1200, 900), true, 'few pixels but too heavy')
  assert.equal(needsCompression(TARGET_BYTES, 2000, 1500), false, 'exactly at the limits')
  assert.equal(needsCompression(300 * 1024, 1000, 800), false, 'small scans stay untouched')
})

test('the try schedule goes from gentle to firm and never below the minimum quality or size factor', () => {
  const list = attempts()
  assert.deepEqual(list[0], { quality: 0.85, sideFactor: 1 }, 'the first try is the gentlest')
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1]
    const b = list[i]
    assert.ok(b.sideFactor <= a.sideFactor, 'pictures only get smaller')
    if (b.sideFactor === a.sideFactor) assert.ok(b.quality < a.quality, 'quality only drops within a size')
  }
  assert.ok(list.every((t) => t.quality >= 0.55 && t.sideFactor >= 0.55))
  // The smallest try on a 2000 px photo is still a usable 1100 px picture.
  assert.ok(Math.round(2000 * Math.min(...list.map((t) => t.sideFactor))) >= MIN_SIDE)
})

test('a compressed photo is named .jpg, whatever it was called before', () => {
  assert.equal(jpgName('IMG_2041.PNG'), 'IMG_2041.jpg')
  assert.equal(jpgName('licence.scan.jpeg'), 'licence.scan.jpg')
  assert.equal(jpgName('noextension'), 'noextension.jpg')
  assert.equal(jpgName('.png'), 'photo.jpg')
})

test('PDFs and other files come back untouched', async () => {
  const pdf = new File([new Uint8Array(6 * MB)], 'licence.pdf', { type: 'application/pdf' })
  const out = await prepareImage(pdf)
  assert.equal(out.file, pdf)
  assert.equal(out.resized, false)
  const txt = new File(['hello'], 'notes.txt', { type: 'text/plain' })
  assert.equal((await prepareImage(txt)).file, txt)
})
