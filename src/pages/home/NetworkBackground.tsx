import { useEffect, useRef } from 'react'
import { elbow, linkPhase, pathLength, pointAlong, sliceFromHead, type Pt } from '../../lib/network'
import { NetworkSim, TRAIL } from '../../lib/networkSim'

// Glowing lime nodes run along a faint circuit grid. When two come close a right-angle link draws between them,
// a short pulse runs along it, and it fades. A mouse links to the nodes near it, briefly.
// The moving parts live in lib/networkSim.ts; this file only draws them.

const BANDS = 4
// The pixel ratio is capped well under the limit of 2: the lines and glows are soft, and a full-size canvas at 2x
// halved the frame rate on a machine without a GPU (measured), while 1x holds 60 frames a second.
const MAX_DPR = 1

/** A soft lime glow, drawn once and stamped for every node and pulse. */
function makeGlow(): HTMLCanvasElement {
  const size = 48
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  grad.addColorStop(0, 'rgba(198, 241, 53, 0.95)')
  grad.addColorStop(0.22, 'rgba(198, 241, 53, 0.4)')
  grad.addColorStop(0.6, 'rgba(198, 241, 53, 0.08)')
  grad.addColorStop(1, 'rgba(198, 241, 53, 0)')
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  return c
}

/**
 * One canvas, one requestAnimationFrame loop. Mounted only on a large screen with a precise pointer and only when
 * the hero is allowed to animate (see Hero.tsx). It stops when scrolled out of view or when the tab is hidden, and
 * the pixel ratio is capped at 2. It sits behind the text and takes no pointer events.
 */
export default function NetworkBackground() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const glow = makeGlow()

    let sim: NetworkSim | null = null
    let mouse: Pt | null = null
    let raf = 0
    let last = 0
    let visible = true
    let resizeTimer = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR)
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      sim = new NetworkSim(width, height)
    }

    const stroke = (pts: Pt[]) => {
      if (pts.length < 2) return
      ctx.moveTo(pts[0].x, pts[0].y)
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
    }

    const draw = (s: NetworkSim, now: number) => {
      const { nodes, links, width, height } = s
      ctx.clearRect(0, 0, width, height)
      ctx.lineWidth = 1
      ctx.lineJoin = 'round'

      // Trails: a faint line behind each node, in bands that fade toward the tail.
      const trails = nodes.map((n) => [...n.corners, { x: n.x, y: n.y }])
      for (let b = 0; b < BANDS; b++) {
        ctx.strokeStyle = `rgba(150, 225, 130, ${(0.5 * Math.pow(1 - b / BANDS, 1.1)).toFixed(3)})`
        ctx.beginPath()
        for (const t of trails) stroke(sliceFromHead(t, (b * TRAIL) / BANDS, ((b + 1) * TRAIL) / BANDS))
        ctx.stroke()
      }

      // Links: draw out, a pulse runs along, then fade.
      for (const L of links) {
        const A = nodes[L.a]
        const B: Pt | null = L.mouse ? mouse : nodes[L.b]
        if (!A || !B) continue
        const path = elbow(A, B)
        const len = pathLength(path)
        const { draw: drawn, pulse, alpha } = linkPhase(now - L.born, L.life)
        ctx.strokeStyle = `rgba(198, 241, 53, ${(0.7 * alpha).toFixed(3)})`
        ctx.beginPath()
        stroke(sliceFromHead(path, len - len * drawn, len))
        ctx.stroke()
        if (pulse > 0 && pulse < 1) {
          const p = pointAlong(path, len * pulse)
          ctx.globalAlpha = 0.9 * alpha
          ctx.drawImage(glow, p.x - 14, p.y - 14, 28, 28)
          ctx.globalAlpha = 1
        }
      }

      // Nodes: a soft glow with a small bright core.
      ctx.fillStyle = '#c6f135'
      for (const n of nodes) {
        ctx.globalAlpha = 0.85
        ctx.drawImage(glow, n.x - 16, n.y - 16, 32, 32)
        ctx.globalAlpha = 1
        ctx.beginPath()
        ctx.arc(n.x, n.y, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      if (sim) {
        const dt = last ? Math.min(0.05, (t - last) / 1000) : 0
        last = t
        sim.step(dt, t, mouse)
        draw(sim, t)
      }
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0
      if (!raf) last = 0
    }
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop)
    }

    // The mouse position, relative to the canvas. Touch and pen are ignored.
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      const r = canvas.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      mouse = x >= 0 && x <= r.width && y >= 0 && y <= r.height ? { x, y } : null
    }
    const onLeave = () => {
      mouse = null
    }

    resize()
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    io.observe(canvas)
    const ro = new ResizeObserver(() => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(resize, 150)
    })
    ro.observe(canvas)
    document.addEventListener('visibilitychange', start)
    window.addEventListener('pointermove', onMove, { passive: true })
    document.documentElement.addEventListener('pointerleave', onLeave)
    start()

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(resizeTimer)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', start)
      window.removeEventListener('pointermove', onMove)
      document.documentElement.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="hero-network" />
}
