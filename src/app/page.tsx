'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { Video, Mic, Phone, Users, Code2, Download } from 'lucide-react'
import { OverlayWindow } from '@/components/nyaksai/overlay-window'
import { MiniOverlay } from '@/components/nyaksai/mini-overlay'
import { SettingsDialog } from '@/components/nyaksai/settings-dialog'
import { HistoryDrawer } from '@/components/nyaksai/history-drawer'
import { BundleDialog } from '@/components/nyaksai/bundle-dialog'
import { useShortcuts } from '@/hooks/use-shortcuts'
import { useScreenshots } from '@/hooks/use-screenshots'

/**
 * Nyaksai web — "One overlay, no tab, no trace."
 *
 * The page simulates a desktop mid-interview (editor + call) so the floating
 * translucent overlay can be experienced exactly like the real app.
 */
export default function Home() {
  const { capture } = useScreenshots()
  useShortcuts(capture)
  const [bundleOpen, setBundleOpen] = useState(false)

  // Desktop shell (Electron) bridge: the global capture hotkey comes from the OS layer.
  useEffect(() => {
    const shell = (window as unknown as { nyaksai?: { onCapture?: (cb: () => void) => void } })
      .nyaksai
    shell?.onCapture?.(() => {
      void capture()
    })
  }, [capture])
  // SSR-safe “mounted” check (needed for persisted store + window sizing)
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0b0e14] text-neutral-200">
      {/* ─── simulated desktop wallpaper ─── */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#1a2233_0%,#0b0e14_55%,#07090d_100%)]" />
      <div className="absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:44px_44px]" />

      {/* ─── fake interview environment behind the overlay ─── */}
      <main className="relative z-0 max-w-5xl mx-auto px-4 pt-10 pb-16 select-none" aria-hidden="true">
        {/* fake call bar */}
        <div className="flex items-center justify-between rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 rounded-full bg-gradient-to-br from-emerald-500/40 to-teal-600/30 border border-white/10 flex items-center justify-center text-[11px] font-bold">
              JM
            </span>
            <div>
              <p className="text-[13px] font-semibold text-neutral-100">Jane Mercer — Senior Engineer @ Nimbus</p>
              <p className="text-[11px] text-neutral-500">Technical interview · 42:17</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[Mic, Video, Users].map((Icon, i) => (
              <span key={i} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Icon className="w-3.5 h-3.5 text-neutral-400" />
              </span>
            ))}
            <span className="w-8 h-8 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
              <Phone className="w-3.5 h-3.5 text-red-400 rotate-[135deg]" />
            </span>
          </div>
        </div>

        {/* fake editor with interview question */}
        <div className="mt-5 rounded-2xl border border-white/8 bg-[#0d1117]/90 overflow-hidden shadow-2xl">
          <div className="flex items-center gap-2 px-4 h-10 border-b border-white/6 bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
            <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
            <span className="ml-3 flex items-center gap-1.5 text-[11px] text-neutral-500">
              <Code2 className="w-3.5 h-3.5" /> interview — main.ts
            </span>
          </div>
          <div className="p-5 space-y-3">
            <p className="text-[14px] font-semibold text-neutral-100">
              1. Two Sum <span className="ml-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded px-1.5 py-0.5">EASY</span>
            </p>
            <p className="text-[12px] leading-relaxed text-neutral-400 max-w-xl">
              Given an array of integers <code className="text-emerald-300">nums</code> and an
              integer <code className="text-emerald-300">target</code>, return indices of the two
              numbers such that they add up to target. Exactly one solution exists.
            </p>
            <pre className="rounded-xl bg-black/50 border border-white/6 p-4 text-[12px] leading-6 text-neutral-300 font-mono overflow-hidden">
              <span className="text-violet-400">function</span> <span className="text-sky-300">twoSum</span>(nums: <span className="text-amber-300">number</span>[], target: <span className="text-amber-300">number</span>): <span className="text-amber-300">number</span>[] {'{'}
              {'\n'}  <span className="text-neutral-600">{'// your solution here…'}</span>
              {'\n'}{'}'}
            </pre>
            <p className="text-[11px] text-neutral-600">
              Follow-up: can you come up with an algorithm less than O(n²) time complexity?
            </p>
          </div>
        </div>

        <p className="mt-4 text-[11px] text-neutral-600 text-center">
          This backdrop simulates the meeting you would keep open — the floating overlay above is
          the real thing: live transcription of your mic &amp; shared tab audio, streaming answers,
          and screen capture. Press Esc to panic-hide, ⌘B to collapse.
        </p>

        {/* code bundle + stealth shell — fixed bottom strip, clear of the floating overlay */}
        <div className="pointer-events-none fixed inset-x-0 bottom-4 z-10 flex flex-wrap items-center justify-center gap-2 px-3">
          <button
            onClick={() => setBundleOpen(true)}
            className="pointer-events-auto rounded-full border border-white/10 bg-neutral-950/80 px-4 py-2 text-[12px] font-medium text-neutral-200 backdrop-blur-md transition-colors hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-200"
          >
            <Download className="mr-1.5 -mt-0.5 inline h-3.5 w-3.5" />
            Download code bundle (.zip)
          </button>
          <span className="hidden rounded-full border border-white/8 bg-neutral-950/60 px-3 py-2 text-[11px] text-neutral-500 backdrop-blur-md sm:inline">
            Desktop shell: invisible to screen capture · absent from taskbar
          </span>
        </div>
      </main>

      <BundleDialog open={bundleOpen} onOpenChange={setBundleOpen} />

      {/* ─── the overlay itself ─── */}
      {mounted && (
        <>
          <OverlayWindow />
          <MiniOverlay />
        </>
      )}
      <SettingsDialog />
      <HistoryDrawer />
    </div>
  )
}
