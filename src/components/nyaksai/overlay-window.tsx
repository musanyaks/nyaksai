'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  History,
  MessageSquareText,
  Mic,
  Minus,
  EyeOff,
  Settings2,
  Camera,
  Monitor,
} from 'lucide-react'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { useScreenshots } from '@/hooks/use-screenshots'
import { AskPane } from './ask-pane'
import { ListenPane } from './listen-pane'
import { toast } from 'sonner'

/**
 * The Nyaksai overlay: a translucent, draggable always-on-top style window
 * floating above a simulated desktop.
 */
export function OverlayWindow() {
  const { mode, setMode, setUIMode, setSettingsOpen, setHistoryOpen, streamActive, visible } =
    useNyaksaiStore()
  const { capture, starting } = useScreenshots()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ dx: number; dy: number } | null>(null)
  const winRef = useRef<HTMLDivElement>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only the empty title-bar strip drags the window — never interactive children
      // (tabs, buttons), otherwise a click "pins" the overlay to absolute coords.
      if ((e.target as HTMLElement).closest('button, input, textarea, select, a')) return
      const el = winRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top }
      // convert from CSS-centered layout to absolute coords on first drag
      setPos((p) => p ?? { x: rect.left, y: rect.top })
      ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    },
    []
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragRef.current) return
    setPos({
      x: Math.min(Math.max(4, e.clientX - dragRef.current.dx), Math.max(4, window.innerWidth - 120)),
      y: Math.min(Math.max(4, e.clientY - dragRef.current.dy), Math.max(4, window.innerHeight - 60)),
    })
  }, [])

  const onPointerUp = useCallback(() => {
    dragRef.current = null
  }, [])

  /* keep a dragged overlay inside the viewport when the window resizes */
  useEffect(() => {
    const onResize = () => {
      setPos((p) =>
        p
          ? {
              x: Math.min(p.x, Math.max(4, window.innerWidth - 120)),
              y: Math.min(p.y, Math.max(4, window.innerHeight - 60)),
            }
          : p
      )
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const screenshot = useCallback(async () => {
    const ok = await capture()
    if (ok) {
      toast.success('Screenshot captured', {
        description: 'Attached to your next question.',
      })
      setMode('ask')
    }
  }, [capture, setMode])

  if (visible !== 'full') return null

  return (
    <div
      ref={winRef}
      className="fixed z-40 w-[min(660px,94vw)] h-[min(620px,88vh)] rounded-2xl border border-white/12 bg-neutral-950/[0.82] backdrop-blur-2xl shadow-[0_24px_80px_-12px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
      style={
        pos
          ? { left: pos.x, top: pos.y }
          : { left: '50%', top: '5vh', transform: 'translateX(-50%)' }
      }
      aria-label="Nyaksai overlay"
    >
      {/* title bar (drag handle) */}
      <div
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="shrink-0 flex items-center gap-2 px-3 h-11 border-b border-white/8 cursor-grab active:cursor-grabbing select-none touch-none"
      >
        <span className="flex items-center gap-1.5 pr-1">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
          <span className="text-[13px] font-bold tracking-tight text-neutral-100">nyaksai</span>
        </span>

        {/* mode tabs */}
        <div className="flex items-center rounded-lg bg-white/5 border border-white/10 p-0.5 ml-1">
          <button
            onClick={() => setMode('ask')}
            aria-pressed={mode === 'ask'}
            className={`flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
              mode === 'ask'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <MessageSquareText className="w-3 h-3" /> Ask
          </button>
          <button
            onClick={() => setMode('listen')}
            aria-pressed={mode === 'listen'}
            className={`flex items-center gap-1 h-6 px-2.5 rounded-md text-[11px] font-semibold transition-colors ${
              mode === 'listen'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Mic className="w-3 h-3" /> Listen
          </button>
        </div>

        <div className="ml-auto flex items-center gap-0.5">
          <span
            className="flex items-center gap-1 mr-1 text-[9px] font-medium text-neutral-500"
            title={streamActive ? 'Screen sharing active' : 'Screen not shared yet'}
          >
            <Monitor className="w-3 h-3" />
            <span
              className={`w-1.5 h-1.5 rounded-full ${streamActive ? 'bg-emerald-400' : 'bg-neutral-600'}`}
            />
          </span>
          <IconBtn label="Capture screenshot (⌘X)" onClick={screenshot} disabled={starting}>
            <Camera className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="History" onClick={() => setHistoryOpen(true)}>
            <History className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Settings (⌘,)" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Mini overlay (⌘B)" onClick={() => setUIMode('mini')}>
            <Minus className="w-4 h-4" />
          </IconBtn>
          <IconBtn label="Panic hide (Esc)" onClick={() => setUIMode('hidden')}>
            <EyeOff className="w-4 h-4" />
          </IconBtn>
        </div>
      </div>

      {/* body */}
      <div className="flex-1 min-h-0">
        {mode === 'ask' ? <AskPane /> : <ListenPane />}
      </div>
    </div>
  )
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-emerald-300 hover:bg-white/5 disabled:opacity-40 transition-colors"
    >
      {children}
    </button>
  )
}
