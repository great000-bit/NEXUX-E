import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { reelMode, type MotionInputs } from './lib/motion.ts'
import { planSpin, randomInterval, ReelBoard } from './lib/reels.ts'
import { HERO_HOOKS, HERO_NODES } from './pages/home/content.ts'
import { EXPERTISE } from './lib/options.ts'

// Tests for the hero motion upgrade: the reels, the tagline, the aurora, the pointer effects and the developer credit.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')
const calm: MotionInputs = { reducedMotion: false, saveData: false, cores: 8, memoryGb: 8, hidden: false, desktopPointer: false }
const desktop: MotionInputs = { ...calm, desktopPointer: true }

/** A small deterministic random source. */
const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

test('the reels spin only when the hero may animate, swap instantly for reduced motion, and rest otherwise', () => {
  assert.equal(reelMode(calm), 'spin')
  assert.equal(reelMode({ ...calm, reducedMotion: true }), 'swap')
  assert.equal(reelMode({ ...calm, reducedMotion: true, cores: 2 }), 'swap', 'reduced motion still swaps text on a weak device')
  assert.equal(reelMode({ ...desktop, cores: 4, memoryGb: 4 }), 'spin', 'a 4 core laptop spins')
  assert.equal(reelMode({ ...desktop, cores: 2, memoryGb: 1 }), 'spin', 'core count never blocks a desktop-width screen')
  assert.equal(reelMode({ ...calm, saveData: true }), 'off')
  assert.equal(reelMode({ ...calm, hidden: true }), 'off', 'timers rest while the tab is hidden')
  assert.equal(reelMode({ ...calm, cores: 2 }), 'off', 'very weak phones keep the still poster')
  assert.equal(reelMode({ ...calm, memoryGb: 1 }), 'off')
  assert.equal(reelMode({ ...calm, cores: 4 }), 'spin', 'an ordinary phone spins')
})

test('a reel never lands on what it shows now or on what another slot shows, and never repeats in a row', () => {
  const rand = seeded(7)
  for (let n = 0; n < 500; n++) {
    const current = EXPERTISE[n % EXPERTISE.length]
    const taken = new Set<string>([EXPERTISE[(n + 3) % EXPERTISE.length], EXPERTISE[(n + 5) % EXPERTISE.length], EXPERTISE[(n + 9) % EXPERTISE.length]])
    const plan = planSpin({ pool: EXPERTISE, current, taken, rand })
    assert.ok(plan)
    assert.notEqual(plan.next, current, 'no repeat in a row')
    assert.ok(!taken.has(plan.next), 'not shown in another slot')
    assert.ok(plan.fillers.length >= 2 && plan.fillers.length <= 3, 'two or three items blur past')
    for (const f of plan.fillers) assert.ok(f !== plan.next && f !== current && !taken.has(f), 'fillers are distinct too')
    assert.equal(new Set(plan.fillers).size, plan.fillers.length)
  }
  assert.equal(planSpin({ pool: ['a'], current: 'a', taken: new Set(), rand: seeded(1) }), null, 'nothing to land on')
})

test('reels start at least a second apart, so they stop one after another', () => {
  const board = new ReelBoard(1000)
  assert.deepEqual([board.reserve(0), board.reserve(0), board.reserve(0), board.reserve(0)], [0, 1000, 2000, 3000])
  assert.equal(board.reserve(10_000), 0, 'an idle board starts at once')
  board.set('a', 'one')
  board.set('b', 'two')
  assert.deepEqual([...board.taken('a')], ['two'])
  board.remove('b')
  assert.equal(board.taken('a').size, 0)
})

test('each reel spins every 4 to 7 seconds', () => {
  const rand = seeded(3)
  for (let i = 0; i < 200; i++) {
    const ms = randomInterval(rand)
    assert.ok(ms >= 4000 && ms <= 7000, String(ms))
  }
})

test('the hook lines and the expertise pool are the supplied copy, with no repeats and no dashes', () => {
  assert.equal(HERO_HOOKS.length, 8)
  assert.equal(new Set(HERO_HOOKS).size, 8)
  assert.ok(HERO_HOOKS.includes('Ready for World Bank, AfDB and DFI projects.'))
  assert.equal(EXPERTISE.length, 15)
  for (const n of HERO_NODES) assert.ok((EXPERTISE as readonly string[]).includes(n.label), n.label)
  assert.doesNotMatch(JSON.stringify(HERO_HOOKS), /—|–/)
})

test('the reel animates transform only and keeps a fixed-size window', () => {
  const reel = read('src/pages/home/Reel.tsx')
  assert.match(reel, /translateY/)
  assert.doesNotMatch(reel, /filter|blur\(|top:|height:/, 'the strip never animates blur, offsets or size')
  assert.match(reel, /fill: 'forwards'/)
  assert.match(reel, /sr-only/, 'screen readers get the current text')
  const css = read('src/pages/home/home.css')
  assert.match(css, /\.reel \{[^}]*overflow: hidden/)
  assert.match(css, /mask-image: linear-gradient\(to bottom/)
  assert.match(css, /\.reel-ghost \{ filter: blur/, 'the blur is static, on the items that pass by')
})

test('the tagline moves by itself, in a loop, with nothing to click', () => {
  const tag = read('src/pages/home/Tagline.tsx')
  assert.doesNotMatch(tag, /onClick|<button|onMouse|onFocus/)
  assert.match(tag, /TICK_MS = 4000/)
  assert.match(tag, /nextIndex\(i, TAGLINES\.length\)/)
  const css = read('src/pages/home/home.css')
  assert.match(css, /seg-run 4s linear/, 'the segment fills in step with the 4 second tick')
  assert.match(css, /\.hero-tagline-title \{[^}]*height: 1\.5rem/, 'fixed height')
  assert.match(read('src/pages/home/Hero.tsx'), /placement="inline"/, 'phones get it centred under the buttons')
})

test('the aurora is three transform and opacity layers on different seamless loops of 20 to 40 seconds', () => {
  const css = read('src/pages/home/home.css')
  const layers = [...css.matchAll(/\.hero-mass-([abc]) \{ animation: aurora-\1 (\d+)s ease-in-out infinite; \}/g)]
  assert.equal(layers.length, 3)
  const secs = layers.map((m) => Number(m[2]))
  assert.equal(new Set(secs).size, 3, 'different lengths')
  for (const s of secs) assert.ok(s >= 20 && s <= 40, String(s))
  for (const name of ['aurora-a', 'aurora-b', 'aurora-c']) {
    const body = css.match(new RegExp('@keyframes ' + name + ' \\{([\\s\\S]*?)\\n\\}'))![1]
    assert.match(body, /0%, 100%/, name + ' ends where it began')
    assert.doesNotMatch(body, /filter|blur|width|height|top|left|margin/, name + ' animates transform and opacity only')
  }
  assert.doesNotMatch(css.slice(css.indexOf('.hero-mass-a'), css.indexOf('.hero-scrim')), /filter\s*:/, 'no blur filter on the layers')
})

test('the pointer glow and parallax are for a mouse only, and the glow moves by transform', () => {
  assert.match(read('src/pages/home/Hero.tsx'), /e\.pointerType !== 'mouse'/)
  const css = read('src/pages/home/home.css')
  assert.match(css, /@media \(hover: none\), \(pointer: coarse\) \{ \.hero-glow \{ display: none; \} \}/)
  assert.match(css, /\.hero-glow \{[^}]*transform: translate3d\(calc\(var\(--gx/)
})

test('the footer credits the developer with a safe external link, and no public page links to the admin', () => {
  const footer = read('src/components/Footer.tsx')
  assert.match(footer, /Designed and built by Great Emman-Wori/)
  assert.match(footer, /DEVELOPER_URL = 'https:\/\/www\.greatemmanwori\.cv'/)
  assert.match(footer, /href=\{DEVELOPER_URL\}/)
  assert.match(footer, /target="_blank"/)
  assert.match(footer, /rel="noopener noreferrer"/)
  assert.match(footer, /Contact developer/)
  assert.match(footer, /focus-visible:outline/)
  assert.doesNotMatch(footer, /admin/i)
})

test('a hidden tab pauses the hero in place, so coming back never replays the entrance', () => {
  const hook = read('src/pages/home/useHeroMotion.ts')
  assert.ok(hook.includes('motion: heroMotionAllowed(inputs)'), 'a hidden tab never switches motion off')
  assert.doesNotMatch(read('src/lib/motion.ts'), /i\.hidden\) return false|\.cores <= 4|\.memoryGb <= 2/, 'the old weak-device rule is gone')
  assert.ok(read('src/pages/home/Hero.tsx').includes("data-paused={hidden ? '' : undefined}"))
  assert.match(read('src/pages/home/home.css'), /\.hero-card\[data-paused\] \.hero-mass,[^}]*animation-play-state: paused/)
})
