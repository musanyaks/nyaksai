'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  Image as ImageIcon,
  Mic,
  MicOff,
  SendHorizontal,
  Trash2,
  X,
  Sparkles,
  Copy,
  Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { useVoiceEngine } from '@/hooks/use-audio-capture'
import { useScreenshots } from '@/hooks/use-screenshots'
import { STYLE_HINTS } from '@/lib/nyaksai/prompts'
import { streamAsk } from '@/lib/nyaksai/stream'
import { Markdown } from './markdown'

interface AskMessage {
  role: 'user' | 'assistant'
  text: string
  images?: string[]
}

const EXAMPLES = [
  'Solve the two sum problem optimally',
  'Explain event loop in one sentence',
  'Design a URL shortener — key trade-offs?',
]

export function AskPane() {
  const {
    screenshots,
    removeScreenshot,
    clearScreenshots,
    useImage,
    setSetting,
    systemPromptAsk,
    responseStyle,
    language,
    vadSensitivity,
    setLastExchange,
  } = useNyaksaiStore()

  const { capture, streamActive } = useScreenshots()
  const [messages, setMessages] = useState<AskMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [streamText, setStreamText] = useState('') // live answer buffer (real SSE)
  const [chips, setChips] = useState<string[]>([])
  const [copied, setCopied] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const busyRef = useRef(false)
  const abortRef = useRef<AbortController | null>(null)

  /* REAL dictation: mic → VAD → WAV → /api/stt → input box */
  const dictation = useVoiceEngine({
    source: 'mic',
    sensitivity: vadSensitivity,
    singleUtterance: true,
    onTranscript: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text))
      setTimeout(() => textareaRef.current?.focus(), 30)
    },
    onError: (message, description) => toast.error(message, { description }),
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, streamText, busy])

  const autoGrow = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = '0px'
    el.style.height = `${Math.min(110, el.scrollHeight)}px`
  }, [])

  const ask = useCallback(async () => {
    if (busyRef.current) return
    let text = input.trim()
    const shots = [...screenshots]

    // "Use image" — every message carries a fresh screenshot
    if (useImage && streamActive && shots.length < 4) {
      const shot = await capture()
      if (shot) shots.push(shot)
    }

    if (!text && shots.length === 0) {
      toast.error('Type a question or capture your screen (⌘X)')
      return
    }
    if (!text && shots.length > 0) text = 'Look at the screenshot and answer the question on it.'

    setInput('')
    clearScreenshots()
    setChips([])
    const userMsg: AskMessage = { role: 'user', text, images: shots }
    setMessages((prev) => [...prev, userMsg])
    setStreamText('')
    setBusy(true)
    busyRef.current = true

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const history = [...messages, userMsg].map((m) => ({ role: m.role, text: m.text }))
      const result = await streamAsk(
        {
          messages: history,
          images: shots,
          systemPrompt: `${systemPromptAsk}\n\n${STYLE_HINTS[responseStyle] ?? ''}`,
        },
        (chunk) => setStreamText((prev) => prev + chunk),
        controller.signal
      )

      if (result.content.trim()) {
        setMessages((prev) => [...prev, { role: 'assistant', text: result.content }])
        setLastExchange(text, result.content)
      }
      setChips(result.suggestions ?? [])
      setStreamText('')

      // silently save the session locally (Nyaksai: "everything is saved locally")
      if (messages.length === 0 && result.content.trim()) {
        fetch('/api/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: text.slice(0, 60) || 'Screenshot question',
            mode: 'ask',
            messages: [...history, { role: 'assistant', text: result.content }],
          }),
        }).catch(() => undefined)
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        toast.error(e instanceof Error ? e.message : 'Something went wrong')
        setMessages((prev) => prev.slice(0, -1))
      }
      setStreamText('')
    } finally {
      setBusy(false)
      busyRef.current = false
      abortRef.current = null
    }
  }, [
    input,
    screenshots,
    useImage,
    streamActive,
    capture,
    clearScreenshots,
    messages,
    systemPromptAsk,
    responseStyle,
    setLastExchange,
  ])

  /* global send shortcut handled via window event (see use-shortcuts) */
  useEffect(() => {
    const handler = () => {
      if (!busyRef.current) ask()
    }
    window.addEventListener('nyaksai:send', handler)
    return () => window.removeEventListener('nyaksai:send', handler)
  }, [ask])

  useEffect(
    () => () => {
      abortRef.current?.abort()
    },
    []
  )

  const followUp = useCallback((q: string) => {
    setInput(q)
    setTimeout(() => window.dispatchEvent(new CustomEvent('nyaksai:send')), 60)
  }, [])

  const copyStream = useCallback(() => {
    const t = streamText || messages[messages.length - 1]?.text || ''
    if (!t) return
    navigator.clipboard?.writeText(t).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [streamText, messages])

  const empty = messages.length === 0
  const lastIsAssistant = messages.length > 0 && messages[messages.length - 1].role === 'assistant'

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-4">
        {empty && !streamText && (
          <div className="h-full flex flex-col items-center justify-center text-center px-6 select-none">
            <span className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-emerald-400" />
            </span>
            <p className="mt-3 text-sm font-medium text-neutral-200">
              What do you need? Ask anything on your screen.
            </p>
            <p className="mt-1 text-[11px] text-neutral-500">
              Capture your screen with <Kbd>⌘X</Kbd> and Nyaksai reads the question for you.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => setInput(e)}
                  className="text-[11px] px-2.5 py-1.5 rounded-full border border-white/10 bg-white/5 text-neutral-300 hover:border-emerald-500/40 hover:text-emerald-300 transition-colors"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="flex flex-col items-end gap-1.5">
              {m.images && m.images.length > 0 && (
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {m.images.map((src, j) => (
                    <img
                      key={j}
                      src={src}
                      alt="Screenshot"
                      className="h-16 rounded-lg border border-white/15 object-cover"
                    />
                  ))}
                </div>
              )}
              {m.text && (
                <div className="max-w-[85%] rounded-xl rounded-br-sm bg-emerald-500/15 border border-emerald-500/20 px-3 py-2 text-[13px] text-emerald-50 whitespace-pre-wrap">
                  {m.text}
                </div>
              )}
            </div>
          ) : (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400/90">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                nyaksai
              </div>
              <Markdown text={m.text} />
              {i === messages.length - 1 && chips.length > 0 && !busy && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {chips.map((c) => (
                    <button
                      key={c}
                      onClick={() => followUp(c)}
                      className="text-[11px] px-2.5 py-1 rounded-full border border-emerald-500/25 bg-emerald-500/5 text-emerald-300/90 hover:bg-emerald-500/15 transition-colors"
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )
        )}

        {/* LIVE answer streaming in real time from the model */}
        {streamText && <Markdown text={streamText} />}

        {busy && !streamText && (
          <div className="flex items-center gap-2 text-[12px] text-neutral-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            nyaksai is thinking…
          </div>
        )}

        {!busy && streamText === '' && lastIsAssistant && (
          <button
            onClick={copyStream}
            className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-emerald-300 transition-colors"
            aria-label="Copy last answer"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />} copy answer
          </button>
        )}
      </div>

      {/* pending screenshots */}
      {screenshots.length > 0 && (
        <div className="px-4 pb-2 flex items-center gap-2">
          <div className="flex gap-1.5 overflow-x-auto">
            {screenshots.map((src, i) => (
              <div key={i} className="relative group shrink-0">
                <img
                  src={src}
                  alt={`Screenshot ${i + 1}`}
                  className="h-14 rounded-lg border border-white/15 object-cover"
                />
                <button
                  onClick={() => removeScreenshot(i)}
                  aria-label={`Remove screenshot ${i + 1}`}
                  className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-neutral-900 border border-white/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5 text-neutral-300" />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={clearScreenshots}
            className="ml-auto text-neutral-500 hover:text-red-400 transition-colors"
            aria-label="Clear all screenshots"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* input row */}
      <div className="px-3 pb-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] focus-within:border-emerald-500/40 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value)
              autoGrow()
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                ask()
              }
            }}
            rows={1}
            placeholder="Ask about anything on your screen…"
            aria-label="Ask Nyaksai"
            className="w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none max-h-[110px]"
          />
          <div className="flex items-center gap-1 px-2 pb-2">
            <button
              onClick={() => capture()}
              title="Capture screenshot (⌘X)"
              aria-label="Capture screenshot"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-neutral-400 hover:text-emerald-300 hover:bg-white/5 transition-colors"
            >
              <Camera className="w-4 h-4" />
            </button>
            <button
              onClick={() => (dictation.active ? dictation.stop() : void dictation.start())}
              title={dictation.active ? 'Stop dictation' : 'Dictate — voice activity detects your phrase'}
              aria-label={dictation.active ? 'Stop dictation' : 'Start dictation'}
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                dictation.active
                  ? 'text-red-400 bg-red-500/10 animate-pulse'
                  : 'text-neutral-400 hover:text-emerald-300 hover:bg-white/5'
              }`}
            >
              {dictation.active ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>
            {dictation.transcribing && (
              <span className="flex items-center gap-1 text-[10px] text-emerald-300/90">
                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                transcribing…
              </span>
            )}
            {dictation.speaking && !dictation.transcribing && (
              <span className="text-[10px] text-neutral-500 italic">listening…</span>
            )}
            <button
              onClick={() => setSetting('useImage', !useImage)}
              title="Attach a fresh screenshot to every message"
              aria-pressed={useImage}
              className={`h-7 px-2 rounded-lg flex items-center gap-1.5 text-[11px] font-medium transition-colors ${
                useImage
                  ? 'text-emerald-300 bg-emerald-500/10 border border-emerald-500/30'
                  : 'text-neutral-400 hover:text-neutral-200 hover:bg-white/5 border border-transparent'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Use image
            </button>
            <span className="ml-auto text-[10px] text-neutral-600 hidden sm:block">
              <Kbd>⌘</Kbd>+<Kbd>↵</Kbd> send
            </span>
            <button
              onClick={ask}
              disabled={busy}
              aria-label="Send question"
              className="w-7 h-7 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center text-neutral-950 transition-colors"
            >
              <SendHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded border border-white/15 bg-white/10 text-[9px] font-sans font-semibold text-neutral-300">
      {children}
    </kbd>
  )
}
