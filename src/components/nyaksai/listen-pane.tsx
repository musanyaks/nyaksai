'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Square, Wand2, UserRound, Copy, Check, Mic, MonitorSpeaker } from 'lucide-react'
import { toast } from 'sonner'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { useVoiceEngine } from '@/hooks/use-audio-capture'
import { STYLE_HINTS } from '@/lib/nyaksai/prompts'
import { streamAsk } from '@/lib/nyaksai/stream'
import { Visualizer } from './visualizer'
import { Markdown } from './markdown'

interface SavedAnswer {
  question: string
  answer: string
  ts: number
}

interface Line {
  id: string
  speaker: 'You' | 'Them'
  text: string
  ts: number
}

const isQuestion = (t: string) =>
  /\?\s*$/.test(t.trim()) ||
  /^(what|why|how|when|where|who|which|can you|could you|tell me|explain|describe|do you|have you|walk me|so)\b/i.test(
    t.trim()
  )

export function ListenPane() {
  const {
    autoResponse,
    pauseDelaySec,
    systemPromptListen,
    responseStyle,
    vadSensitivity,
    setLastExchange,
  } = useNyaksaiStore()

  const [lines, setLines] = useState<Line[]>([])
  const [answer, setAnswer] = useState('') // live streamed suggestion
  const [finalAnswer, setFinalAnswer] = useState('')
  const [thinking, setThinking] = useState(false)
  const [answers, setAnswers] = useState<SavedAnswer[]>([])
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)
  const linesRef = useRef<Line[]>([])
  const abortRef = useRef<AbortController | null>(null)
  linesRef.current = lines

  const pushLine = useCallback((speaker: 'You' | 'Them', text: string) => {
    setLines((prev) => [
      ...prev,
      { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, speaker, text, ts: Date.now() },
    ])
  }, [])

  /* ── REAL engines: mic = your side, system audio = their side ── */
  const mic = useVoiceEngine({
    source: 'mic',
    sensitivity: vadSensitivity,
    onTranscript: (text) => pushLine('You', text),
    onError: (m, d) => toast.error(m, { description: d }),
  })
  const sys = useVoiceEngine({
    source: 'system',
    sensitivity: 'normal',
    onTranscript: (text) => pushLine('Them', text),
    onError: (m, d) => toast.error(m, { description: d }),
  })

  const listening = mic.active || sys.active

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [lines, answer])

  const suggest = useCallback(async () => {
    if (busyRef.current) return
    const finals = linesRef.current.slice(-16)
    if (finals.length === 0) {
      toast.error('Nothing to respond to yet', {
        description: 'Start listening and let the conversation flow.',
      })
      return
    }
    busyRef.current = true
    setThinking(true)
    setGenerating(true)
    setAnswer('')
    setFinalAnswer('')

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const transcript = finals.map((l) => `${l.speaker}: ${l.text}`).join('\n')
      const result = await streamAsk(
        {
          messages: [
            {
              role: 'user',
              text: 'Here is the live conversation transcript. Give me exactly what I should say next.',
            },
          ],
          context: transcript,
          systemPrompt: `${systemPromptListen}\n\n${STYLE_HINTS[responseStyle] ?? ''}`,
        },
        (chunk) => setAnswer((prev) => prev + chunk),
        controller.signal
      )
      const content = result.content.trim()
      setFinalAnswer(content)
      setAnswer('')
      if (content) setLastExchange('Live conversation', content)
      const q = [...finals].reverse().find((l) => l.text.length > 8)?.text ?? 'Live conversation'
      setAnswers((prev) => [...prev.slice(-9), { question: q, answer: content, ts: Date.now() }])
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error(e instanceof Error ? e.message : 'Could not generate a suggestion')
      }
      setAnswer('')
    } finally {
      setThinking(false)
      setGenerating(false)
      busyRef.current = false
      abortRef.current = null
    }
  }, [systemPromptListen, responseStyle, setLastExchange])

  /* auto-response: on question detected (from REAL transcribed utterances) */
  useEffect(() => {
    if (autoResponse !== 'question' || !listening || busyRef.current) return
    const last = lines[lines.length - 1]
    if (!last || last.ts < Date.now() - 5000) return
    if (isQuestion(last.text)) {
      const t = setTimeout(suggest, 1200)
      return () => clearTimeout(t)
    }
  }, [lines, listening, autoResponse, suggest])

  /* auto-response: after every pause */
  useEffect(() => {
    if (autoResponse !== 'pause' || !listening || busyRef.current) return
    if (lines.length === 0) return
    const t = setTimeout(suggest, pauseDelaySec * 1000)
    return () => clearTimeout(t)
  }, [lines.length, autoResponse, pauseDelaySec, listening, suggest])

  const copyAnswer = useCallback(() => {
    const t = finalAnswer || answer
    if (!t) return
    navigator.clipboard?.writeText(t).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [finalAnswer, answer])

  const stopAndSave = useCallback(() => {
    mic.stop()
    sys.stop()
    if (lines.length === 0) return
    fetch('/api/meetings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Session ${new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        language: 'en-US',
        transcript: lines.map((l) => ({ speaker: l.speaker, text: l.text, ts: l.ts })),
        answers,
      }),
    })
      .then(() => toast.success('Session saved to meetings'))
      .catch(() => toast.error('Could not save the session'))
  }, [mic, sys, lines, answers])

  const sourceBtn = (
    engine: typeof mic,
    label: string,
    icon: React.ReactNode,
    activeCls: string
  ) => (
    <button
      onClick={() => (engine.active ? engine.stop() : void engine.start())}
      disabled={engine.starting}
      aria-pressed={engine.active}
      className={`flex items-center gap-1.5 h-7.5 px-2.5 rounded-lg text-[11px] font-semibold border transition-colors disabled:opacity-50 ${
        engine.active
          ? activeCls
          : 'border-white/10 bg-white/5 text-neutral-400 hover:text-neutral-200 hover:border-white/20'
      }`}
    >
      {icon}
      {label}
      {engine.starting && <span className="w-1 h-1 rounded-full bg-neutral-300 animate-pulse" />}
    </button>
  )

  const anyTranscribing = mic.transcribing || sys.transcribing
  const anyoneSpeaking = mic.speaking || sys.speaking

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* controls */}
      <div className="px-4 pt-3 pb-2 flex items-center gap-1.5 shrink-0 flex-wrap">
        {listening ? (
          <button
            onClick={stopAndSave}
            className="flex items-center gap-1.5 h-7.5 px-3 rounded-lg text-[12px] font-semibold bg-red-500/15 border border-red-500/40 text-red-300 hover:bg-red-500/25 transition-colors"
          >
            <Square className="w-3 h-3 fill-current" /> Stop & save
          </button>
        ) : (
          <button
            onClick={() => {
              void mic.start()
            }}
            className="flex items-center gap-1.5 h-7.5 px-3 rounded-lg text-[12px] font-semibold bg-emerald-500 text-neutral-950 hover:bg-emerald-400 transition-colors"
          >
            <AudioLines className="w-3.5 h-3.5" /> Start listening
          </button>
        )}

        {sourceBtn(
          mic,
          'Mic — you',
          <Mic className="w-3 h-3" />,
          'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
        )}
        {sourceBtn(
          sys,
          'System — them',
          <MonitorSpeaker className="w-3 h-3" />,
          'bg-sky-500/10 border-sky-500/40 text-sky-300'
        )}

        {/* live level visualizer */}
        {(mic.active || sys.active) && (
          <span className="flex items-center gap-1.5 ml-0.5">
            {mic.active && <Visualizer analyserRef={mic.analyserRef} active={mic.active} />}
            {sys.active && <Visualizer analyserRef={sys.analyserRef} active={sys.active} />}
          </span>
        )}

        <span className="ml-auto flex items-center gap-2">
          {anyoneSpeaking && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> hearing
              speech…
            </span>
          )}
          {anyTranscribing && (
            <span className="flex items-center gap-1 text-[10px] text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" /> transcribing…
            </span>
          )}
          {generating && (
            <span className="flex items-center gap-1 text-[10px] text-emerald-300">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> generating
              response…
            </span>
          )}
          {listening && !anyoneSpeaking && !anyTranscribing && !generating && (
            <span className="flex items-center gap-1 text-[10px] text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" /> live
            </span>
          )}
          <select
            value={autoResponse}
            onChange={(e) => useNyaksaiStore.getState().setSetting('autoResponse', e.target.value as typeof autoResponse)}
            aria-label="Automatic responses"
            className="h-7.5 rounded-lg bg-white/5 border border-white/10 text-[11px] text-neutral-300 px-1.5 outline-none focus:border-emerald-500/40"
          >
            <option value="manual">Suggest: manual</option>
            <option value="question">Auto: on question</option>
            <option value="pause">Auto: after pause</option>
            <option value="off">Off</option>
          </select>
        </span>
      </div>

      {/* transcript */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2.5">
        {lines.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center select-none">
            <span className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <AudioLines className="w-5 h-5 text-emerald-400" />
            </span>
            <p className="mt-3 text-sm font-medium text-neutral-200">Listen mode</p>
            <p className="mt-1 text-[11px] text-neutral-500 max-w-[300px] leading-relaxed">
              Nyaksai transcribes your <span className="text-neutral-300">mic</span> and{' '}
              <span className="text-neutral-300">shared tab audio</span> live with real voice
              detection, then drafts exactly what to say.
            </p>
            <p className="mt-2 text-[10px] text-neutral-600 max-w-[280px]">
              For the other side of the call, enable <span className="text-neutral-400">System</span>{' '}
              and share the call tab with &quot;also share tab audio&quot;.
            </p>
          </div>
        )}
        {lines.map((l) => (
          <div key={l.id} className="flex gap-2">
            <span
              className={`mt-0.5 flex items-center gap-1 text-[10px] font-semibold shrink-0 w-12 ${
                l.speaker === 'You' ? 'text-emerald-400/80' : 'text-sky-400/80'
              }`}
            >
              <UserRound className="w-3 h-3" />
              {l.speaker}
            </span>
            <p className="text-[13px] leading-relaxed text-neutral-200">{l.text}</p>
          </div>
        ))}
        {anyoneSpeaking && (
          <div className="flex gap-2">
            <span className="mt-0.5 flex items-center gap-1 text-[10px] font-semibold text-neutral-600 shrink-0 w-12">
              <UserRound className="w-3 h-3" />
              …
            </span>
            <p className="text-[13px] leading-relaxed text-neutral-500 italic animate-pulse">
              hearing speech
            </p>
          </div>
        )}
      </div>

      {/* answer card */}
      <div className="px-3 pb-3 shrink-0">
        <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/[0.06] p-3">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Wand2 className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400/90">
              Suggested answer
            </span>
            {(answer || finalAnswer) && (
              <button
                onClick={copyAnswer}
                aria-label="Copy answer"
                className="ml-auto text-neutral-500 hover:text-emerald-300 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
          <div className="max-h-40 overflow-y-auto">
            {thinking && !answer ? (
              <p className="text-[12px] text-neutral-400 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                drafting what to say…
              </p>
            ) : answer ? (
              <Markdown text={answer} />
            ) : finalAnswer ? (
              <Markdown text={finalAnswer} />
            ) : (
              <p className="text-[12px] text-neutral-500">
                Your next line appears here — automatically, or tap Suggest.
              </p>
            )}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <button
              onClick={suggest}
              disabled={thinking || !lines.length}
              className="h-7 px-3 rounded-lg bg-emerald-500 text-neutral-950 text-[11px] font-bold hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Suggest
            </button>
            <span className="text-[10px] text-neutral-600">
              {autoResponse === 'question'
                ? 'Fires automatically when a question is asked'
                : autoResponse === 'pause'
                  ? `Fires after ${pauseDelaySec}s of silence`
                  : autoResponse === 'off'
                    ? 'Automatic responses off'
                    : 'Tap Suggest whenever you need it'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
