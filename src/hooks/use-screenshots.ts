'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useNyaksaiStore } from '@/lib/nyaksai/store'

const MAX_WIDTH = 1600

/* Module-level singletons — one shared screen stream for every hook consumer. */
let videoEl: HTMLVideoElement | null = null
let streamRef: MediaStream | null = null

function ensureVideo() {
  if (!videoEl && typeof document !== 'undefined') {
    const v = document.createElement('video')
    v.muted = true
    v.playsInline = true
    v.style.position = 'fixed'
    v.style.opacity = '0'
    v.style.pointerEvents = 'none'
    v.style.width = '1px'
    v.style.height = '1px'
    videoEl = v
    document.body.appendChild(v)
  }
  return videoEl
}

/**
 * Browser screen capture (getDisplayMedia). The user picks the screen/window to
 * share once; every "capture" grabs a fresh frame — mirroring the reference app's
 * screenshot flow. The stream is shared app-wide and ends when the user
 * clicks "Stop sharing".
 */
export function useScreenshots() {
  const [starting, setStarting] = useState(false)
  const streamActive = useNyaksaiStore((s) => s.streamActive)
  const setStreamActive = useNyaksaiStore((s) => s.setStreamActive)
  const addScreenshots = useNyaksaiStore((s) => s.addScreenshots)

  const startStream = useCallback(async (): Promise<boolean> => {
    if (streamRef && streamRef.active) return true
    setStarting(true)
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { displaySurface: 'monitor' } as MediaTrackConstraints,
        audio: false,
      })
      streamRef = stream
      const video = ensureVideo()
      if (video) {
        video.srcObject = stream
        await video.play().catch(() => undefined)
      }
      setStreamActive(true)
      stream.getVideoTracks()[0]?.addEventListener('ended', () => {
        streamRef = null
        setStreamActive(false)
        toast.info('Screen sharing stopped')
      })
      return true
    } catch {
      toast.error('Screen capture was blocked or dismissed', {
        description: 'Grant screen-sharing permission and try again (⌘X).',
      })
      return false
    } finally {
      setStarting(false)
    }
  }, [setStreamActive])

  const capture = useCallback(async (): Promise<string | null> => {
    const ok = await startStream()
    if (!ok) return null
    const video = videoEl
    if (!video || !video.videoWidth) {
      toast.error('No screen stream available yet')
      return null
    }
    try {
      const scale = Math.min(1, MAX_WIDTH / video.videoWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
      addScreenshots([dataUrl])
      return dataUrl
    } catch {
      toast.error('Failed to capture screenshot')
      return null
    }
  }, [addScreenshots, startStream])

  const stopStream = useCallback(() => {
    streamRef?.getTracks().forEach((t) => t.stop())
    streamRef = null
    if (videoEl) videoEl.srcObject = null
    setStreamActive(false)
  }, [setStreamActive])

  useEffect(
    () => () => {
      /* keep stream alive across mounts on purpose (shared overlay session) */
    },
    []
  )

  return { capture, startStream, stopStream, streamActive, starting }
}
