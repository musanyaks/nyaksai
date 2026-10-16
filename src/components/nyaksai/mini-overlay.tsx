'use client'

import { Camera, Eye, MessageSquareText } from 'lucide-react'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { useScreenshots } from '@/hooks/use-screenshots'
import { toast } from 'sonner'

/**
 * Mini overlay (⌘B): a small unassuming pill with the last answer.
 * Panic mode (Esc): collapses to a nearly invisible dot — click or ⌘B to restore.
 */
export function MiniOverlay() {
  const { visible, setUIMode, lastAnswer, lastQuestion, mode } = useNyaksaiStore()
  const { capture } = useScreenshots()

  if (visible === 'mini') {
    return (
      <div className="fixed z-40 bottom-4 right-4 w-[300px] rounded-xl border border-white/12 bg-neutral-950/85 backdrop-blur-xl shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 h-8 border-b border-white/8">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span className="text-[11px] font-bold text-neutral-200">nyaksai</span>
          <span className="text-[9px] text-neutral-500 uppercase tracking-wider ml-1">
            {mode} mode
          </span>
          <button
            onClick={() => setUIMode('hidden')}
            className="ml-auto w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-red-400"
            aria-label="Hide completely"
            title="Panic hide (Esc)"
          >
            <Eye className="w-3 h-3" />
          </button>
          <button
            onClick={() => setUIMode('full')}
            className="w-5 h-5 rounded flex items-center justify-center text-neutral-500 hover:text-emerald-300"
            aria-label="Restore overlay"
            title="Restore (⌘B)"
          >
            <MessageSquareText className="w-3 h-3" />
          </button>
        </div>
        <div className="p-3">
          {lastAnswer ? (
            <p className="text-[11px] leading-relaxed text-neutral-300 line-clamp-4">
              {lastAnswer.replace(/[#*`$]/g, '').slice(0, 240)}
            </p>
          ) : (
            <p className="text-[11px] text-neutral-500">
              Last answer shows here. Keep working — press ⌘X to capture, ⌘B to expand.
            </p>
          )}
          <div className="mt-2 flex items-center gap-1.5">
            <button
              onClick={async () => {
                const ok = await capture()
                if (ok) toast.success('Screenshot captured')
              }}
              className="flex items-center gap-1 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30 rounded-md px-2 h-6 hover:bg-emerald-500/10"
              aria-label="Quick capture"
            >
              <Camera className="w-3 h-3" /> Capture
            </button>
            <span className="text-[9px] text-neutral-600 ml-auto">
              {lastQuestion ? `“${lastQuestion.slice(0, 32)}”` : ''}
            </span>
          </div>
        </div>
      </div>
    )
  }

  // hidden / panic mode: a tiny dot only
  if (visible === 'hidden') {
    return (
      <button
        onClick={() => setUIMode('full')}
        aria-label="Restore Nyaksai"
        title="Restore Nyaksai (⌘B)"
        className="fixed z-50 bottom-2 right-2 w-2.5 h-2.5 rounded-full bg-emerald-400/50 hover:bg-emerald-400 transition-colors"
      />
    )
  }
  return null
}
