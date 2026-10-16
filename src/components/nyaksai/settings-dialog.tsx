'use client'

import { RotateCcw } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { useNyaksaiStore } from '@/lib/nyaksai/store'
import { markDialogClose } from '@/hooks/use-shortcuts'
import { LANGUAGES, RESPONSE_STYLES } from '@/lib/nyaksai/prompts'
import { Kbd } from './ask-pane'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="py-3.5 border-b border-white/6 last:border-0">
    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2.5">
      {title}
    </h3>
    {children}
  </section>
)

const LabeledField = ({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
}) => (
  <label className="block">
    <span className="block text-[10px] text-neutral-500 mb-1">{label}</span>
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      spellCheck={false}
      autoComplete="off"
      className="w-full h-8 rounded-lg bg-black/40 border border-white/10 text-[12px] text-neutral-200 px-2 outline-none focus:border-emerald-500/40 placeholder:text-neutral-600"
    />
  </label>
)

const SHORTCUTS: [string, string][] = [
  ['⌘ / Ctrl + X', 'Capture screenshot of your screen'],
  ['⌘ / Ctrl + Enter', 'Send the question (Ask mode)'],
  ['⌘ / Ctrl + B', 'Collapse / restore the mini overlay'],
  ['Esc', 'Panic hide — shrinks Nyaksai to an invisible dot'],
  ['⌘ / Ctrl + ,', 'Open settings'],
  ['Enter', 'Send · Shift+Enter newline (in the input)'],
]

export function SettingsDialog() {
  const {
    settingsOpen,
    setSettingsOpen,
    language,
    responseStyle,
    autoResponse,
    pauseDelaySec,
    opacity,
    useImage,
    vadSensitivity,
    customProvider,
    systemPromptAsk,
    systemPromptListen,
    setSetting,
    resetPrompts,
  } = useNyaksaiStore()

  return (
    <Dialog open={settingsOpen} onOpenChange={(open) => { setSettingsOpen(open); if (!open) markDialogClose() }}>
      <DialogContent className="bg-neutral-950/95 backdrop-blur-2xl border-white/12 text-neutral-200 max-h-[85vh] overflow-y-auto w-[min(560px,94vw)] rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-neutral-100">Settings</DialogTitle>
          <DialogDescription className="text-[11px] text-neutral-500">
            Everything is stored locally on this device — nothing leaves your machine except the
            question you send.
          </DialogDescription>
        </DialogHeader>

        <Section title="Model — connect your own provider">
          <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">
            The chat, vision and transcription model is any OpenAI-compatible endpoint you connect
            here — base URL + API key + model. Required when running the downloaded bundle on your
            machine. Works with OpenAI, Groq, OpenRouter, Together or local Ollama. Keys stay in
            this browser only.
          </p>
          <button
            onClick={() =>
              setSetting('customProvider', { ...customProvider, enabled: !customProvider.enabled })
            }
            className={`w-full rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
              customProvider.enabled
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/[0.03] text-neutral-300'
            }`}
          >
            Custom provider: {customProvider.enabled ? 'ON' : 'OFF'}
          </button>
          {customProvider.enabled && (
            <div className="mt-2.5 space-y-2">
              <LabeledField
                label="Base URL"
                value={customProvider.baseUrl}
                placeholder="https://api.openai.com/v1"
                onChange={(v) => setSetting('customProvider', { ...customProvider, baseUrl: v })}
              />
              <LabeledField
                label="API key"
                type="password"
                value={customProvider.apiKey}
                placeholder="sk-…"
                onChange={(v) => setSetting('customProvider', { ...customProvider, apiKey: v })}
              />
              <div className="grid grid-cols-2 gap-2">
                <LabeledField
                  label="Chat model"
                  value={customProvider.model}
                  placeholder="gpt-4o-mini"
                  onChange={(v) => setSetting('customProvider', { ...customProvider, model: v })}
                />
                <LabeledField
                  label="STT model"
                  value={customProvider.sttModel}
                  placeholder="whisper-1"
                  onChange={(v) =>
                    setSetting('customProvider', { ...customProvider, sttModel: v })
                  }
                />
              </div>
              <p className="text-[10px] text-neutral-600 leading-relaxed">
                Groq: https://api.groq.com/openai/v1 · whisper-large-v3 — Ollama:
                http://localhost:11434/v1 (use a vision-capable model to read screenshots).
              </p>
            </div>
          )}
        </Section>

        <Section title="Response style">
          <div className="grid grid-cols-3 gap-1.5">
            {RESPONSE_STYLES.map((s) => (
              <button
                key={s.id}
                onClick={() => setSetting('responseStyle', s.id)}
                className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                  responseStyle === s.id
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20'
                }`}
              >
                <span className="block text-[11px] font-semibold">{s.label}</span>
                <span className="block text-[9px] text-neutral-500 mt-0.5 leading-tight">
                  {s.hint}
                </span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Voice detection (real audio pipeline)">
          <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">
            Utterances are captured as PCM, split by a voice-activity detector and transcribed by
            the built-in speech model — the same capture → VAD → STT pipeline as the desktop app.
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                ['low', 'Low', 'Noisy rooms'],
                ['normal', 'Normal', 'Recommended'],
                ['high', 'High', 'Quiet rooms'],
              ] as const
            ).map(([id, label, hint]) => (
              <button
                key={id}
                onClick={() => setSetting('vadSensitivity', id)}
                className={`rounded-lg border px-2 py-2 text-center transition-colors ${
                  vadSensitivity === id
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20'
                }`}
              >
                <span className="block text-[11px] font-semibold">{label}</span>
                <span className="block text-[9px] text-neutral-500 mt-0.5">{hint}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] text-neutral-600">
            Listen mode sources: <span className="text-neutral-400">Mic</span> (your side) and{' '}
            <span className="text-neutral-400">System</span> — share the call tab with audio to
            transcribe the other side.
          </p>
        </Section>

        <Section title="Transcription language (Listen mode)">
          <select
            value={language}
            onChange={(e) => setSetting('language', e.target.value)}
            className="w-full h-8 rounded-lg bg-white/5 border border-white/10 text-[12px] text-neutral-200 px-2 outline-none focus:border-emerald-500/40"
          >
            {LANGUAGES.map((l) => (
              <option key={l.id} value={l.id} className="bg-neutral-900">
                {l.label}
              </option>
            ))}
          </select>
        </Section>

        <Section title="Automatic responses (Listen mode)">
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['manual', 'Manual — tap Suggest'],
                ['question', 'Auto — when a question is asked'],
                ['pause', `Auto — after ${pauseDelaySec}s pause`],
                ['off', 'Off'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setSetting('autoResponse', id)}
                className={`rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
                  autoResponse === id
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-neutral-300 hover:border-white/20'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {autoResponse === 'pause' && (
            <label className="mt-2.5 flex items-center gap-2 text-[11px] text-neutral-400">
              Pause length
              <input
                type="range"
                min={3}
                max={20}
                value={pauseDelaySec}
                onChange={(e) => setSetting('pauseDelaySec', Number(e.target.value))}
                className="flex-1 accent-emerald-500"
              />
              <span className="w-8 text-right font-semibold text-neutral-300">
                {pauseDelaySec}s
              </span>
            </label>
          )}
        </Section>

        <Section title="Overlay">
          <label className="flex items-center gap-2 text-[11px] text-neutral-400">
            Window opacity
            <input
              type="range"
              min={0.55}
              max={1}
              step={0.01}
              value={opacity}
              onChange={(e) => setSetting('opacity', Number(e.target.value))}
              className="flex-1 accent-emerald-500"
            />
            <span className="w-8 text-right font-semibold text-neutral-300">
              {Math.round(opacity * 100)}%
            </span>
          </label>
          <button
            onClick={() => setSetting('useImage', !useImage)}
            className={`mt-2.5 w-full rounded-lg border px-2 py-1.5 text-[11px] transition-colors ${
              useImage
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-white/10 bg-white/[0.03] text-neutral-300'
            }`}
          >
            Use image — attach a fresh screenshot to every message: {useImage ? 'ON' : 'OFF'}
          </button>
        </Section>

        <Section title="System prompts">
          <label className="block text-[10px] text-neutral-500 mb-1">Ask mode</label>
          <textarea
            value={systemPromptAsk}
            onChange={(e) => setSetting('systemPromptAsk', e.target.value)}
            rows={5}
            className="w-full rounded-lg bg-black/40 border border-white/10 text-[11px] text-neutral-300 p-2 font-mono outline-none focus:border-emerald-500/40 resize-y"
          />
          <label className="block text-[10px] text-neutral-500 mb-1 mt-2">Listen mode</label>
          <textarea
            value={systemPromptListen}
            onChange={(e) => setSetting('systemPromptListen', e.target.value)}
            rows={4}
            className="w-full rounded-lg bg-black/40 border border-white/10 text-[11px] text-neutral-300 p-2 font-mono outline-none focus:border-emerald-500/40 resize-y"
          />
          <button
            onClick={resetPrompts}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-neutral-400 hover:text-emerald-300 transition-colors"
          >
            <RotateCcw className="w-3 h-3" /> Reset to defaults
          </button>
        </Section>

        <Section title="Keyboard shortcuts">
          <ul className="space-y-1.5">
            {SHORTCUTS.map(([k, d]) => (
              <li key={k} className="flex items-center gap-2 text-[11px]">
                <span className="text-neutral-300 font-medium w-32 shrink-0">{k}</span>
                <span className="text-neutral-500">{d}</span>
              </li>
            ))}
          </ul>
        </Section>

        <p className="text-[10px] text-neutral-600 pb-1 text-center">
          Nyaksai — inspired by Pluely. Configure the model in the provider section above; your
          key never leaves this browser. Everything stays local.
        </p>
      </DialogContent>
    </Dialog>
  )
}
