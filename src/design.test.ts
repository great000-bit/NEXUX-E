import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

// A contrast audit of the design system. Every pair of colours used for text or for the edge of a control is
// checked against WCAG AA (4.5 to 1 for text, 3 to 1 for large text and for the boundary of an interface part),
// and each colour must really exist in the stylesheet so this list cannot drift away from the design.

const root = path.resolve(import.meta.dirname, '..')
const css = fs.readFileSync(path.join(root, 'src/index.css'), 'utf8')
const homeCss = fs.readFileSync(path.join(root, 'src/pages/home/home.css'), 'utf8')

type RGB = [number, number, number]
const hex = (h: string): RGB => {
  const v = h.replace('#', '')
  return [0, 2, 4].map((i) => Number.parseInt(v.slice(i, i + 2), 16)) as RGB
}
const lin = (c: number) => {
  const s = c / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const lum = ([r, g, b]: RGB) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
const ratio = (a: RGB, b: RGB) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
/** A colour with some opacity laid over a solid background. */
const over = (fg: RGB, alpha: number, bg: RGB): RGB => fg.map((c, i) => Math.round(c * alpha + bg[i] * (1 - alpha))) as RGB

const NIGHT = '#03110a' // the page shell
const NIGHT_900 = '#051a10'
const HERO = '#0a2418' // about as bright as the hero gets behind the headline, after the scrim
const WHITE: RGB = [255, 255, 255]
// A glass card is white at 7 to 10 percent over the shell. Test the brighter case.
const glass = over(WHITE, 0.1, hex(NIGHT_900))

const mustExist = (...colours: string[]) => {
  for (const c of colours) assert.ok(css.toLowerCase().includes(c.toLowerCase()) || homeCss.toLowerCase().includes(c.toLowerCase()), `${c} is not in the stylesheet`)
}

test('every colour in this audit really is in the stylesheet', () => {
  mustExist(NIGHT, NIGHT_900, '#f1f8e6', '#cbdacf', '#9fb6a6', '#c5dc3f', '#04140d', '#6f8277', '#66746b', '#2f3d35', '#5a695f', '#0b4a2a', '#06361e', '#d9ec7a', '#e1ee8a')
})

test('dark shell text: headings, body and muted text pass AA on the shell and on glass', () => {
  const night = hex(NIGHT)
  for (const [name, colour] of [['heading', '#f1f8e6'], ['body', '#cbdacf'], ['muted', '#9fb6a6']] as const) {
    assert.ok(ratio(hex(colour), night) >= 4.5, `${name} on the shell: ${ratio(hex(colour), night).toFixed(2)}`)
    assert.ok(ratio(hex(colour), glass) >= 4.5, `${name} on glass: ${ratio(hex(colour), glass).toFixed(2)}`)
  }
  assert.ok(ratio(hex('#f1f8e6'), night) >= 7, 'headings pass AAA')
})

test('lime accents (eyebrows, badges, the tagline title) pass AA on the shell and on glass', () => {
  for (const c of ['#c5dc3f', '#d9ec7a', '#e1ee8a']) {
    assert.ok(ratio(hex(c), hex(NIGHT)) >= 4.5, `${c} on the shell: ${ratio(hex(c), hex(NIGHT)).toFixed(2)}`)
    assert.ok(ratio(hex(c), glass) >= 4.5, `${c} on glass: ${ratio(hex(c), glass).toFixed(2)}`)
  }
})

test('buttons: lime on dark, deep green on light, and the glass button, all pass AA', () => {
  assert.ok(ratio(hex('#04140d'), hex('#c5dc3f')) >= 7, 'lime button label')
  assert.ok(ratio(WHITE, hex('#0b4a2a')) >= 7, 'deep green button label')
  assert.ok(ratio(hex('#f1f8e6'), over(WHITE, 0.14, hex(NIGHT_900))) >= 4.5, 'glass button label on its hover state')
})

test('solid light panels: body, muted and link text pass AA on the panel', () => {
  const panel = hex('#fbfdf8')
  for (const [name, c] of [['body', '#2f3d35'], ['muted', '#5a695f'], ['link', '#0b4a2a'], ['heading', '#06361e'], ['placeholder', '#66746b']] as const) {
    assert.ok(ratio(hex(c), panel) >= 4.5, `${name} on a panel: ${ratio(hex(c), panel).toFixed(2)}`)
    assert.ok(ratio(hex(c), WHITE) >= 4.5, `${name} on white: ${ratio(hex(c), WHITE).toFixed(2)}`)
  }
})

test('the edge of every form field and choice is at least 3 to 1 against its panel', () => {
  for (const bg of ['#ffffff', '#fbfdf8']) {
    assert.ok(ratio(hex('#6f8277'), hex(bg)) >= 3, `field border on ${bg}: ${ratio(hex('#6f8277'), hex(bg)).toFixed(2)}`)
  }
  // And the stylesheet really uses that border, with no paler one left behind.
  assert.ok(!/#b4c3ae|#c3cfbc;\s*border-radius: var\(--radius-md\);\s*font/i.test(css), 'no pale field border remains')
})

test('the hero headline stays readable even where "Be found." fades', () => {
  // The fade ends at about 50 percent of a translucent mint over the hero, and it is large text (3 to 1).
  const faded = over(hex('#d8f0be'), 0.5, hex(HERO))
  assert.ok(ratio(faded, hex(HERO)) >= 3, `faded end of the headline: ${ratio(faded, hex(HERO)).toFixed(2)}`)
  assert.ok(ratio(WHITE, hex(HERO)) >= 7, 'the white part of the headline')
})

test('hero small print passes AA over the hero', () => {
  const hero = hex(HERO)
  for (const [name, rgb, a] of [['subline', [236, 245, 230], 0.88], ['small line', [214, 228, 216], 0.78], ['node sub label', [190, 208, 196], 0.85], ['tagline text', [214, 228, 216], 0.88]] as const) {
    const c = over(rgb as unknown as RGB, a, hero)
    assert.ok(ratio(c, hero) >= 4.5, `${name}: ${ratio(c, hero).toFixed(2)}`)
  }
})

test('footer and strip text pass AA on the footer band', () => {
  const band = over(hex(NIGHT_900), 0.6, hex(NIGHT))
  for (const [name, a] of [['links', 0.8], ['small text', 0.7], ['copyright', 0.6]] as const) {
    const c = over(WHITE, a, band)
    assert.ok(ratio(c, band) >= 4.5, `${name} at ${a * 100}%: ${ratio(c, band).toFixed(2)}`)
  }
  const strip = over(WHITE, 0.55, hex(NIGHT))
  assert.ok(ratio(strip, hex(NIGHT)) >= 4.5, 'membership strip')
})
