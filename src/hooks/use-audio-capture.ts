'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useNyaksaiStore } from '@/lib/nyaksai/store'

/**
 * REAL voice engine (the capture → VAD → WAV → STT pipeline of the reference desktop app):
 *  1. Captures raw PCM from the microphone (getUserMedia) or from a shared
 *     tab/screen's audio track (getDisplayMedia audio) — "their side" of the call.
 *  2. Runs an energy-based voice activity detector (adaptive noise floor,
 *     pre-speech buffer, silence hangover) like the reference app's Rust VAD.
 *  3. Encodes each detected utterance to 16 kHz mono WAV.
 *  4. POSTs it to /api/stt (built-in ASR model) and emits the transcript.
 */

export type AudioSource = 'mic' | 'system'
export type Sensitivity = 'low' | 'normal' | 'high'

const SENS_SCALE: Record<Sensitivity, number> = { low: 1.9, normal: 1, high: 0.55 }
const TARGET_RATE = 16000
const CHUNK_SAMPLES = 2048 // worklet accumulates this many frames before posting
const SILENCE_CHUNKS_TO_FINALIZE = 26 // ~1.1 s of silence closes an utterance
const SPEECH_CHUNKS_TO_START = 3 // ~90 ms of sound opens an utterance
const PREBUFFER_CHUNKS = 14 // ~0.6 s kept before speech starts

/* ─────────────────────────── audio helpers ─────────────────────────── */

const WORKLET_CODE = `
class PcmCollector extends AudioWorkletProcessor {
  constructor() {
    super()
    this._buf = new Float32Array(${CHUNK_SAMPLES})
    this._fill = 0
  }
  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    let i = 0
    while (i < ch.length) {
      const take = Math.min(ch.length - i, this._buf.length - this._fill)
      this._buf.set(ch.subarray(i, i + take), this._fill)
      this._fill += take
      i += take
      if (this._fill === this._buf.length) {
        this.port.postMessage(this._buf.slice(0))
        this._fill = 0
      }
    }
    return true
  }
}
registerProcessor('pcm-collector', PcmCollector)
`

function rmsOf(buf: Float32Array): number {
  let sum = 0
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
  return Math.sqrt(sum / buf.length)
}

function resampleTo16k(input: Float32Array, inputRate: number): Float32Array {
  if (inputRate === TARGET_RATE) return input
  const ratio = inputRate / TARGET_RATE
  const outLen = Math.max(1, Math.floor(input.length / ratio))
  const out = new Float32Array(outLen)
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio
    const idx = Math.floor(pos)
    const frac = pos - idx
    const a = input[idx] ?? 0
    const b = input[idx + 1] ?? a
    out[i] = a + (b - a) * frac
  }
  return out
}

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i))
  }
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let off = 44
  for (let i = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true)
  }
  return new Blob([view], { type: 'audio/wav' })
}

export async function transcribeBlob(blob: Blob): Promise<string> {
  const form = new FormData()
  form.append('audio', blob, 'utterance.wav')
  // BYOK: when a custom provider is enabled, transcribe through it (OpenAI-compatible).
  const cp = useNyaksaiStore.getState().customProvider
  if (cp?.enabled && cp.apiKey && cp.baseUrl) {
    form.append('providerBaseUrl', cp.baseUrl.trim().replace(/\/+$/, ''))
    form.append('providerApiKey', cp.apiKey)
    form.append('providerModel', cp.sttModel.trim() || 'whisper-1')
  }
  const res = await fetch('/api/stt', { method: 'POST', body: form })
  if (!res.ok) {
    let msg = 'Transcription failed'
    try {
      const j = (await res.json()) as { error?: string }
      msg = j.error ?? msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  const j = (await res.json()) as { text?: string }
  return (j.text ?? '').trim()
}

/* ─────────────────────────── the hook ─────────────────────────── */

export interface VoiceEngineOptions {
  source: AudioSource
  sensitivity: Sensitivity
  /** Fired with a finalized, transcribed utterance. */
  onTranscript: (text: string) => void
  onError: (message: string, description?: string) => void
  /** Stop automatically after the first finalized utterance (push-to-talk dictation). */
  singleUtterance?: boolean
}

export function useVoiceEngine({
  source,
  sensitivity,
  onTranscript,
  onError,
  singleUtterance,
}: VoiceEngineOptions) {
  const [active, setActive] = useState(false)
  const [starting, setStarting] = useState(false)
  const [speaking, setSpeaking] = useState(false) // VAD currently hears speech
  const [transcribing, setTranscribing] = useState(false)
  const [level, setLevel] = useState(0) // smoothed 0..1 for meters

  const cleanupRef = useRef<(() => void) | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const optsRef = useRef({ sensitivity, onTranscript, onError, singleUtterance })
  optsRef.current = { sensitivity, onTranscript, onError, singleUtterance }
  const singleRef = useRef(false)

  const start = useCallback(async () => {
    if (cleanupRef.current || starting) return
    setStarting(true)
    singleRef.current = !!optsRef.current.singleUtterance

    let ctx: AudioContext | null = null
    let stream: MediaStream | null = null
    let stopped = false
    let nodeCleanup: () => void = () => undefined
    const cleanupHolder: { fn: () => void } = { fn: () => undefined }

    const stopInternal = () => {
      if (cleanupRef.current !== cleanupHolder.fn) return
      cleanupRef.current = null
      stopped = true
      nodeCleanup()
      try {
        srcNode?.disconnect()
      } catch {
        /* ignore */
      }
      try {
        muteGain?.disconnect()
      } catch {
        /* ignore */
      }
      stream?.getTracks().forEach((t) => t.stop())
      void audioCtx?.close().catch(() => undefined)
      analyserRef.current = null
      setActive(false)
      setSpeaking(false)
      setLevel(0)
    }
    cleanupHolder.fn = stopInternal

    let srcNode: MediaStreamAudioSourceNode | null = null
    let muteGain: GainNode | null = null
    let audioCtx: AudioContext | null = null

    const finishUtterance = async (chunks: Float32Array[], rate: number) => {
      const totalLen = chunks.reduce((n, c) => n + c.length, 0)
      if (totalLen < rate * 0.35) return // < 0.35 s — ignore noise blips
      const merged = new Float32Array(totalLen)
      let off = 0
      for (const c of chunks) {
        merged.set(c, off)
        off += c.length
      }
      const wav = encodeWav(resampleTo16k(merged, rate), TARGET_RATE)
      setTranscribing(true)
      try {
        const text = await transcribeBlob(wav)
        if (text) optsRef.current.onTranscript(text)
      } catch (e) {
        optsRef.current.onError(
          e instanceof Error ? e.message : 'Transcription failed',
          'Check your connection and try again.'
        )
      } finally {
        setTranscribing(false)
      }
    }

    try {
      if (source === 'mic') {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        })
      } else {
        // System audio: the user shares the call tab/window WITH audio.
        stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
          } as MediaTrackConstraints,
        })
        const audioTracks = stream.getAudioTracks()
        if (audioTracks.length === 0) {
          stream.getTracks().forEach((t) => t.stop())
          throw Object.assign(new Error('No audio was shared'), {
            friendly:
              "Pick the call tab and enable 'Also share tab audio' to hear the other side.",
          })
        }
        // Video was only needed to unlock audio capture — drop it immediately.
        stream.getVideoTracks().forEach((t) => t.stop())
      }

      try {
        ctx = new AudioContext({ sampleRate: TARGET_RATE })
      } catch {
        ctx = new AudioContext()
      }
      audioCtx = ctx
      if (audioCtx.state === 'suspended') await audioCtx.resume()

      srcNode = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      srcNode.connect(analyser)
      analyserRef.current = analyser

      muteGain = audioCtx.createGain()
      muteGain.gain.value = 0 // never monitor captured audio back to output
      muteGain.connect(audioCtx.destination)

      // VAD state
      const rate = audioCtx.sampleRate
      let noiseFloor = 0.008
      let speechRun = 0
      let silenceRun = 0
      let collecting = false
      let collected: Float32Array[] = []
      let prebuffer: Float32Array[] = []
      let collectedCount = 0

      const handleChunk = (chunk: Float32Array) => {
        if (stopped) return
        const rms = rmsOf(chunk)
        setLevel((prev) => prev * 0.75 + Math.min(1, rms * 14) * 0.25)

        const scale = SENS_SCALE[optsRef.current.sensitivity] ?? 1
        const threshold = Math.max(0.004, noiseFloor * 3.2) * scale

        const isSpeech = rms > threshold
        const isSilence = rms < threshold * 0.55

        if (!collecting) {
          noiseFloor = noiseFloor * 0.98 + rms * 0.02 // adapt to background
        }

        if (isSpeech) speechRun++
        else speechRun = 0
        if (isSilence) silenceRun++
        else silenceRun = 0

        if (!collecting && speechRun >= SPEECH_CHUNKS_TO_START) {
          collecting = true
          setSpeaking(true)
          collected = [...prebuffer]
          collectedCount = collected.reduce((n, c) => n + c.length, 0)
          prebuffer = []
        }

        if (collecting) {
          collected.push(chunk)
          collectedCount += chunk.length
          if (silenceRun >= SILENCE_CHUNKS_TO_FINALIZE || collectedCount / rate > 47) {
            collecting = false
            setSpeaking(false)
            silenceRun = 0
            speechRun = 0
            const out = collected
            collected = []
            void finishUtterance(out, rate)
            if (singleRef.current) {
              cleanupRef.current?.()
            }
          }
        } else {
          prebuffer.push(chunk)
          if (prebuffer.length > PREBUFFER_CHUNKS) prebuffer.shift()
        }
      }

      if (audioCtx.audioWorklet) {
        const blobUrl = URL.createObjectURL(
          new Blob([WORKLET_CODE], { type: 'application/javascript' })
        )
        await audioCtx.audioWorklet.addModule(blobUrl)
        URL.revokeObjectURL(blobUrl)
        const node = new AudioWorkletNode(audioCtx, 'pcm-collector')
        node.port.onmessage = (ev: MessageEvent<Float32Array>) => handleChunk(ev.data)
        srcNode.connect(node)
        node.connect(muteGain)
        nodeCleanup = () => {
          node.port.onmessage = null
          try {
            node.disconnect()
          } catch {
            /* ignore */
          }
        }
      } else {
        // Legacy fallback for browsers without AudioWorklet
        const proc = audioCtx.createScriptProcessor(CHUNK_SAMPLES, 1, 1)
        proc.onaudioprocess = (ev) =>
          handleChunk(new Float32Array(ev.inputBuffer.getChannelData(0)))
        srcNode.connect(proc)
        proc.connect(muteGain)
        nodeCleanup = () => {
          proc.onaudioprocess = null
          try {
            proc.disconnect()
          } catch {
            /* ignore */
          }
        }
      }

      const onTrackEnded = () => {
        optsRef.current.onError(
          'Audio sharing ended',
          'The shared tab or screen stopped broadcasting audio.'
        )
        stopInternal()
      }
      stream.getAudioTracks()[0]?.addEventListener('ended', onTrackEnded)

      cleanupRef.current = stopInternal
      setActive(true)
    } catch (e) {
      stream?.getTracks().forEach((t) => t.stop())
      void ctx?.close().catch(() => undefined)
      analyserRef.current = null
      const friendly = (e as { friendly?: string }).friendly
      const name = (e as { name?: string }).name
      if (friendly) {
        optsRef.current.onError((e as Error).message, friendly)
      } else if (name === 'NotAllowedError') {
        optsRef.current.onError(
          source === 'mic' ? 'Microphone permission denied' : 'Screen share dismissed',
          source === 'mic'
            ? 'Allow microphone access in your browser to use this feature.'
            : 'Pick a tab/window and enable sharing its audio.'
        )
      } else {
        optsRef.current.onError(e instanceof Error ? e.message : 'Could not start audio capture')
      }
    } finally {
      setStarting(false)
    }
  }, [source, starting])

  const stop = useCallback(() => {
    cleanupRef.current?.()
  }, [])

  useEffect(
    () => () => {
      cleanupRef.current?.()
    },
    []
  )

  return { active, starting, speaking, transcribing, level, analyserRef, start, stop }
}
