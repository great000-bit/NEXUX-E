import { useEffect, useRef } from 'react'
import { particleCount } from '../../lib/motion'

type Dot = { x: number; y: number; r: number; vx: number; vy: number; phase: number; speed: number }

/**
 * Fine star dust on a canvas. It stops when it is scrolled out of view and when the tab is hidden,
 * runs at a capped pixel ratio, and is only mounted when the hero is allowed to animate.
 */
export function StarDust() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let width = 0
    let height = 0
    let dots: Dot[] = []
    let raf = 0
    let visible = true

    const seed = () => {
      const count = particleCount(window.innerWidth)
      dots = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.1 + 0.3,
        vx: (Math.random() - 0.5) * 0.04,
        vy: (Math.random() - 0.5) * 0.03,
        phase: Math.random() * Math.PI * 2,
        speed: 0.0004 + Math.random() * 0.0008,
      }))
    }

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      width = canvas.clientWidth
      height = canvas.clientHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      seed()
    }

    const draw = (t: number) => {
      ctx.clearRect(0, 0, width, height)
      for (const d of dots) {
        d.x += d.vx
        d.y += d.vy
        if (d.x < 0) d.x = width
        else if (d.x > width) d.x = 0
        if (d.y < 0) d.y = height
        else if (d.y > height) d.y = 0
        const a = 0.18 + 0.32 * (0.5 + 0.5 * Math.sin(d.phase + t * d.speed))
        ctx.fillStyle = `rgba(226, 240, 222, ${a.toFixed(3)})`
        ctx.beginPath()
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const loop = (t: number) => {
      draw(t)
      raf = visible && !document.hidden ? requestAnimationFrame(loop) : 0
    }
    const start = () => {
      if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop)
    }

    resize()
    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible) start()
    })
    io.observe(canvas)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    document.addEventListener('visibilitychange', start)
    start()

    return () => {
      cancelAnimationFrame(raf)
      io.disconnect()
      ro.disconnect()
      document.removeEventListener('visibilitychange', start)
    }
  }, [])

  return <canvas ref={ref} aria-hidden="true" className="absolute inset-0 h-full w-full" />
}
