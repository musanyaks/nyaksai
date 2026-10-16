'use client'

import { useCallback, useEffect } from 'react'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { toast } from 'sonner'

/* Set when a Radix dialog/sheet just closed via Escape — panic-hide must skip these. */
let lastDialogCloseAt = 0
export function markDialogClose() {
  lastDialogCloseAt = Date.now()
}

/**
 * Global keyboard shortcuts — the "keyboard-first" Nyaksai experience.
 * ⌘/Ctrl+X capture · ⌘/Ctrl+Enter send · ⌘/Ctrl+B collapse · Esc panic · ⌘/Ctrl+, settings
 * Reads fresh state imperatively so stale closures can't misfire (e.g. Esc closing a dialog).
 */
export function useShortcuts(capture: () => Promise<string | null>) {
  const onKey = useCallback(
    async (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      const store = useNyaksaiStore.getState()

      if (mod && e.key.toLowerCase() === 'x' && !e.shiftKey) {
        e.preventDefault()
        const ok = await capture()
        if (ok) {
          toast.success('Screenshot captured', { description: 'Attached to your next question.' })
        }
        return
      }
      if (mod && e.key === 'Enter') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('nyaksai:send'))
        return
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        store.cycleUIMode()
        return
      }
      if (mod && e.key === ',') {
        e.preventDefault()
        store.setSettingsOpen(true)
        return
      }
      if (
        e.key === 'Escape' &&
        !store.settingsOpen &&
        !store.historyOpen &&
        Date.now() - lastDialogCloseAt > 250
      ) {
        if (store.visible !== 'hidden') {
          e.preventDefault()
          store.setUIMode('hidden')
        }
      }
    },
    [capture]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => void onKey(e)
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKey])
}
