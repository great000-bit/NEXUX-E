import { elbow, LinkBook, nodeCount, pathLength, type Pt } from './network'

// The moving parts of the hero network, with no drawing and no DOM, so the rules can be tested in Node.

export const GRID = 48 // spacing of the invisible circuit lines the nodes travel on
export const TURN_CHANCE = 0.2 // chance of a right-angle turn at each crossing
export const LINK_RANGE = 150
export const LINK_LIFE = 1100 // ms
export const MOUSE_RANGE = 170
export const MOUSE_LIFE = 700
export const TRAIL = 130
const NEW_LINKS_PER_FRAME = 2

export type Node = { x: number; y: number; dir: number; speed: number; corners: Pt[] }
export type Link = { key: string; a: number; b: number; born: number; life: number; mouse: boolean }

export const DX = [1, 0, -1, 0]
export const DY = [0, 1, 0, -1]

export class NetworkSim {
  nodes: Node[] = []
  links: Link[] = []
  readonly width: number
  readonly height: number
  private readonly rand: () => number
  private readonly pairBook = new LinkBook(16, 2600)
  private readonly mouseBook = new LinkBook(4, 1800)

  constructor(width: number, height: number, rand: () => number = Math.random) {
    this.width = width
    this.height = height
    this.rand = rand
    this.nodes = Array.from({ length: nodeCount(width) }, () => this.spawn(true))
  }

  private spawn(anywhere: boolean): Node {
    const { width, height, rand } = this
    const dir = Math.floor(rand() * 4)
    const horizontal = dir % 2 === 0
    const row = (limit: number) => Math.round((rand() * Math.floor(limit / GRID) * GRID) / GRID) * GRID // always a multiple of GRID, inside the canvas
    let x: number
    let y: number
    if (horizontal) {
      y = row(height)
      x = anywhere ? rand() * width : dir === 0 ? -8 : width + 8
    } else {
      x = row(width)
      y = anywhere ? rand() * height : dir === 1 ? -8 : height + 8
    }
    const back = anywhere ? TRAIL : 0
    return { x, y, dir, speed: 110 + rand() * 150, corners: [{ x: x - DX[dir] * back, y: y - DY[dir] * back }] }
  }

  private move(n: Node, dt: number) {
    const horizontal = n.dir % 2 === 0
    const prev = horizontal ? n.x : n.y
    n.x += DX[n.dir] * n.speed * dt
    n.y += DY[n.dir] * n.speed * dt
    const next = horizontal ? n.x : n.y

    // Crossing one of the circuit lines: sometimes turn a right angle onto it.
    const a = Math.floor(prev / GRID)
    const b = Math.floor(next / GRID)
    if (a !== b && this.rand() < TURN_CHANCE) {
      const c = (DX[n.dir] + DY[n.dir] > 0 ? b : a) * GRID
      if (horizontal) n.x = c
      else n.y = c
      if (n.x >= 0 && n.x <= this.width && n.y >= 0 && n.y <= this.height) {
        n.corners.push({ x: n.x, y: n.y })
        if (n.corners.length > 6) n.corners.shift()
        n.dir = (n.dir + (this.rand() < 0.5 ? 1 : 3)) % 4
      }
    }
    if (n.x < -40 || n.x > this.width + 40 || n.y < -40 || n.y > this.height + 40) Object.assign(n, this.spawn(false))
  }

  /** Advances the nodes by `dt` seconds, starts and ends links, and follows the mouse when there is one. */
  step(dt: number, now: number, mouse: Pt | null) {
    for (const n of this.nodes) this.move(n, dt)
    this.startLinks(now, mouse)

    const alive: Link[] = []
    for (const L of this.links) {
      const book = L.mouse ? this.mouseBook : this.pairBook
      const A = this.nodes[L.a]
      const B: Pt | null = L.mouse ? mouse : this.nodes[L.b]
      const range = (L.mouse ? MOUSE_RANGE : LINK_RANGE) * 1.9
      if (now - L.born >= L.life || !A || !B || pathLength(elbow(A, B)) > range) book.end(L.key)
      else alive.push(L)
    }
    this.links = alive
    if (Math.floor(now / 2000) !== Math.floor((now - dt * 1000) / 2000)) {
      this.pairBook.prune(now)
      this.mouseBook.prune(now)
    }
  }

  private startLinks(now: number, mouse: Pt | null) {
    const { nodes } = this
    let started = 0
    for (let i = 0; i < nodes.length && started < NEW_LINKS_PER_FRAME; i++) {
      for (let j = i + 1; j < nodes.length && started < NEW_LINKS_PER_FRAME; j++) {
        const dx = nodes[i].x - nodes[j].x
        const dy = nodes[i].y - nodes[j].y
        if (dx * dx + dy * dy > LINK_RANGE * LINK_RANGE) continue
        const key = i + '-' + j
        if (!this.pairBook.canStart(key, now)) continue
        this.pairBook.start(key, now)
        this.links.push({ key, a: i, b: j, born: now, life: LINK_LIFE, mouse: false })
        started++
      }
    }
    if (!mouse) return
    for (let i = 0; i < nodes.length; i++) {
      const dx = nodes[i].x - mouse.x
      const dy = nodes[i].y - mouse.y
      if (dx * dx + dy * dy > MOUSE_RANGE * MOUSE_RANGE) continue
      const key = 'm' + i
      if (!this.mouseBook.canStart(key, now)) continue
      this.mouseBook.start(key, now)
      this.links.push({ key, a: i, b: -1, born: now, life: MOUSE_LIFE, mouse: true })
    }
  }
}
