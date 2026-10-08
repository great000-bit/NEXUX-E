import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { elbow, LinkBook, linkPhase, NETWORK_QUERY, nodeCount, pathLength, pointAlong, sliceFromHead, trimTail } from './lib/network.ts'
import { GRID, LINK_RANGE, NetworkSim } from './lib/networkSim.ts'

// Tests for the desktop network background: the geometry, the link rules, the simulation, and the mounting rules.

const root = path.resolve(import.meta.dirname, '..')
const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8')

const seeded = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296
  return seed / 4294967296
}

test('about 40 to 60 nodes, scaled by width', () => {
  assert.equal(nodeCount(1024), 40)
  assert.equal(nodeCount(1280), 43)
  assert.equal(nodeCount(1440), 48)
  assert.equal(nodeCount(1920), 60)
  assert.equal(nodeCount(5000), 60)
  assert.equal(nodeCount(300), 40)
})

test('paths: an elbow turns one right angle, and distances along it add up', () => {
  const p = elbow({ x: 0, y: 0 }, { x: 30, y: 40 })
  assert.deepEqual(p, [{ x: 0, y: 0 }, { x: 30, y: 0 }, { x: 30, y: 40 }])
  assert.equal(pathLength(p), 70)
  assert.deepEqual(pointAlong(p, 0), { x: 0, y: 0 })
  assert.deepEqual(pointAlong(p, 30), { x: 30, y: 0 })
  assert.deepEqual(pointAlong(p, 50), { x: 30, y: 20 })
  assert.deepEqual(pointAlong(p, 999), { x: 30, y: 40 }, 'clamped to the end')
  assert.deepEqual(pointAlong(p, -5), { x: 0, y: 0 }, 'clamped to the start')
})

test('trail slices are measured from the head and never longer than asked', () => {
  const trail = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }]
  assert.equal(pathLength(sliceFromHead(trail, 0, 50)), 50)
  assert.deepEqual(sliceFromHead(trail, 0, 50)[sliceFromHead(trail, 0, 50).length - 1], { x: 100, y: 50 }, 'ends at the head')
  const mid = sliceFromHead(trail, 25, 75)
  assert.equal(Math.round(pathLength(mid)), 50)
  assert.deepEqual(mid[1], { x: 100, y: 0 }, 'keeps the corner')
  assert.deepEqual(sliceFromHead(trail, 10, 10), [])
  assert.ok(pathLength(trimTail(trail, 80)) <= 80.0001)
  assert.equal(pathLength(trimTail(trail, 500)), 150)
})

test('links are capped, and the same pair rests before linking again', () => {
  const book = new LinkBook(2, 1000)
  assert.ok(book.canStart('a', 0))
  book.start('a', 0)
  assert.ok(!book.canStart('a', 10), 'already active')
  book.start('b', 0)
  assert.ok(!book.canStart('c', 0), 'at the cap')
  book.end('a')
  assert.ok(!book.canStart('a', 500), 'still cooling down')
  assert.ok(book.canStart('a', 1000), 'rested')
  assert.equal(book.size, 1)
  book.end('b')
  book.prune(10_000)
  assert.ok(book.canStart('b', 10_001))
})

test('a link draws out, a pulse runs along it, then it fades', () => {
  const start = linkPhase(0, 1000)
  assert.deepEqual([start.draw, start.pulse, start.alpha], [0, 0, 1])
  const mid = linkPhase(500, 1000)
  assert.equal(mid.draw, 1)
  assert.ok(mid.pulse > 0 && mid.pulse < 1)
  assert.equal(mid.alpha, 1)
  const end = linkPhase(1000, 1000)
  assert.deepEqual([end.draw, end.pulse, end.alpha], [1, 1, 0])
  assert.ok(linkPhase(900, 1000).alpha < 1 && linkPhase(900, 1000).alpha > 0)
})

test('the simulation: nodes stay on the circuit lines, links come and go, and nothing floods', () => {
  const sim = new NetworkSim(1280, 640, seeded(11))
  assert.equal(sim.nodes.length, nodeCount(1280))
  const starts = new Map<string, number>()
  let sawLink = false
  let maxActive = 0
  let t = 0
  for (let frame = 0; frame < 60 * 40; frame++) {
    t += 1000 / 60
    sim.step(1 / 60, t, null)
    maxActive = Math.max(maxActive, sim.links.length)
    if (sim.links.length) sawLink = true
    for (const L of sim.links) {
      if (!starts.has(L.key + '@' + L.born)) {
        const prev = [...starts.keys()].filter((k) => k.startsWith(L.key + '@')).map((k) => Number(k.split('@')[1]))
        for (const p of prev) assert.ok(L.born - p >= 2600 - 1, 'same pair relinked too soon')
        starts.set(L.key + '@' + L.born, L.born)
      }
    }
    for (const n of sim.nodes) {
      assert.ok(n.x > -50 && n.x < 1280 + 50 && n.y > -50 && n.y < 640 + 50, 'stays near the canvas')
      const horizontal = n.dir % 2 === 0
      const across = horizontal ? n.y : n.x
      assert.ok(Math.abs(across / GRID - Math.round(across / GRID)) < 1e-6, 'travels along a grid line')
    }
  }
  assert.ok(sawLink, 'two nodes came within range and linked')
  assert.ok(maxActive <= 16, 'at most 16 links at once: ' + maxActive)
  assert.ok(starts.size > 10, 'links keep coming: ' + starts.size)
})

test('nodes sometimes turn a right angle, and keep a short corner list', () => {
  const sim = new NetworkSim(1280, 640, seeded(5))
  let turned = 0
  let t = 0
  const before = sim.nodes.map((n) => n.dir)
  for (let frame = 0; frame < 60 * 20; frame++) {
    t += 1000 / 60
    sim.step(1 / 60, t, null)
    for (const n of sim.nodes) assert.ok(n.corners.length <= 7)
  }
  sim.nodes.forEach((n, i) => {
    if (n.dir !== before[i]) turned++
  })
  assert.ok(turned > 5, 'many nodes changed direction: ' + turned)
  for (const n of sim.nodes) assert.ok(n.speed >= 110 && n.speed <= 260, 'fast, but not frantic')
})

test('a mouse links to nearby nodes briefly, at most four at once, and only while it is there', () => {
  const sim = new NetworkSim(1280, 640, seeded(21))
  let t = 0
  let maxMouse = 0
  let sawMouse = false
  for (let frame = 0; frame < 60 * 12; frame++) {
    t += 1000 / 60
    const near = sim.nodes[0]
    sim.step(1 / 60, t, { x: near.x + 20, y: near.y + 20 })
    const m = sim.links.filter((l) => l.mouse).length
    maxMouse = Math.max(maxMouse, m)
    if (m) sawMouse = true
    for (const l of sim.links) if (l.mouse) assert.ok(t - l.born <= 700 + 20)
  }
  assert.ok(sawMouse)
  assert.ok(maxMouse <= 4, 'mouse links: ' + maxMouse)
  // Take the mouse away and every mouse link ends on the next step.
  sim.step(1 / 60, t + 20, null)
  assert.equal(sim.links.filter((l) => l.mouse).length, 0)
  assert.ok(LINK_RANGE > 0)
})

test('it mounts only on a large screen with a mouse, only when the hero may animate, lazily and after idle', () => {
  assert.equal(NETWORK_QUERY, '(min-width: 1024px) and (pointer: fine)')
  const hero = read('src/pages/home/Hero.tsx')
  assert.match(hero, /lazy\(\(\) => import\('\.\/NetworkBackground'\)\)/)
  assert.doesNotMatch(hero, /import NetworkBackground/, 'never imported statically')
  assert.match(hero, /useMediaQuery\(NETWORK_QUERY\)/)
  assert.match(hero, /const wantNetwork = motion && desktopPointer/, 'reduced motion, data saver and weak devices get nothing extra')
  assert.match(hero, /wantNetwork && networkReady/)
  assert.match(hero, /requestIdleCallback/)
})

test('the canvas is one rAF loop, pixel ratio capped at 2, paused off screen and when hidden, behind the text', () => {
  const src = read('src/pages/home/NetworkBackground.tsx')
  const cap = Number(src.match(/const MAX_DPR = ([\d.]+)/)?.[1])
  assert.ok(cap >= 1 && cap <= 2, 'the pixel ratio cap is at most 2')
  assert.match(src, /Math\.min\(window\.devicePixelRatio \|\| 1, MAX_DPR\)/)
  assert.equal((src.match(/requestAnimationFrame\(loop\)/g) ?? []).length, 2, 'one loop, started and continued')
  assert.match(src, /IntersectionObserver/)
  assert.match(src, /document\.hidden/)
  assert.match(src, /ResizeObserver/)
  assert.match(src, /e\.pointerType !== 'mouse'/)
  assert.match(src, /aria-hidden="true"/)
  assert.doesNotMatch(src, /filter|shadowBlur/, 'the glow is a stamped sprite, never a per-frame blur')
  const css = read('src/pages/home/home.css')
  assert.match(css, /\.hero-network \{[^}]*pointer-events: none/)
  const hero = read('src/pages/home/Hero.tsx')
  assert.ok(hero.indexOf('<NetworkBackground />') < hero.indexOf('className="hero-scrim"'), 'drawn under the scrim, so the text stays readable')
})
