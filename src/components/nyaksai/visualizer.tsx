'use client'

import { useEffect, useRef, type RefObject } from 'react'

/**
 * Real-time audio visualizer — draws actual FFT bars from the live
 * AnalyserNode of a voice engine (like the reference app's AudioVisualizer canvas).
 */
export function Visualizer({
  analyserRef,
  active,
  height = 26,
  className = '',
}: {
  analyserRef: RefObject<AnalyserNode | null>
  active: boolean
  height?: number
  className?: string
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const BARS = 22
    const data = new Uint8Array(128)

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw)
      const analyser = analyserRef.current
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      const barW = Math.max(2, Math.floor(w / BARS) - 2)
      const gap = Math.max(2, Math.floor((w - barW * BARS) / Math.max(1, BARS - 1)) + 2)

      if (analyser) {
        analyser.getByteFrequencyData(data)
        for (let i = 0; i < BARS; i++) {
          // logarithmic-ish sampling of the spectrum
          const idx = Math.floor(Math.pow(i / BARS, 1.4) * 60) + 2
          const v = (data[idx] ?? 0) / 255
          const bh = Math.max(2, v * h)
          const x = i * (barW + gap)
          ctx.fillStyle = `rgba(52, 211, 153, ${0.35 + v * 0.65})`
          ctx.beginPath()
          ctx.roundRect(x, (h - bh) / 2, barW, bh, 1.5)
          ctx.fill()
        }
      } else {
        for (let i = 0; i < BARS; i++) {
          const x = i * (barW + gap)
          ctx.fillStyle = 'rgba(255,255,255,0.12)'
          ctx.beginPath()
          ctx.roundRect(x, h / 2 - 1, barW, 2, 1)
          ctx.fill()
        }
      }
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [analyserRef, active])

  return (
    <canvas
      ref={canvasRef}
      width={132}
      height={height}
      className={className}
      aria-hidden="true"
    />
  )
}
