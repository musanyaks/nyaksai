'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { DEFAULT_ASK_PROMPT, DEFAULT_LISTEN_PROMPT } from '@/lib/nyaksai/prompts'

export type Mode = 'ask' | 'listen'
export type AutoResponseMode = 'off' | 'question' | 'pause' | 'manual'

/** BYOK — any OpenAI-compatible endpoint. Used instead of the built-in backend (for local/desktop runs). */
export interface CustomProvider {
  enabled: boolean
  baseUrl: string
  apiKey: string
  model: string
  sttModel: string
}

export const DEFAULT_CUSTOM_PROVIDER: CustomProvider = {
  enabled: false,
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
  sttModel: 'whisper-1',
}

export interface NyaksaiSettings {
  systemPromptAsk: string
  systemPromptListen: string
  language: string
  responseStyle: 'balanced' | 'detailed' | 'concise'
  useImage: boolean
  autoResponse: AutoResponseMode
  pauseDelaySec: number
  opacity: number
  vadSensitivity: 'low' | 'normal' | 'high'
  customProvider: CustomProvider
}

interface NyaksaiState extends NyaksaiSettings {
  /* UI state (not persisted) */
  mode: Mode
  visible: 'full' | 'mini' | 'hidden'
  settingsOpen: boolean
  historyOpen: boolean
  screenshots: string[]
  streamActive: boolean
  lastQuestion: string
  lastAnswer: string

  /* setters */
  setMode: (m: Mode) => void
  setUIMode: (v: NyaksaiState['visible']) => void
  cycleUIMode: () => void
  setSettingsOpen: (v: boolean) => void
  setHistoryOpen: (v: boolean) => void
  addScreenshots: (imgs: string[]) => void
  removeScreenshot: (i: number) => void
  clearScreenshots: () => void
  setStreamActive: (v: boolean) => void
  setLastExchange: (q: string, a: string) => void

  /* settings setters */
  setSetting: <K extends keyof NyaksaiSettings>(key: K, value: NyaksaiSettings[K]) => void
  resetPrompts: () => void
}

export const useNyaksaiStore = create<NyaksaiState>()(
  persist(
    (set, get) => ({
      mode: 'ask',
      visible: 'full',
      settingsOpen: false,
      historyOpen: false,
      screenshots: [],
      streamActive: false,
      lastQuestion: '',
      lastAnswer: '',

      systemPromptAsk: DEFAULT_ASK_PROMPT,
      systemPromptListen: DEFAULT_LISTEN_PROMPT,
      language: 'en-US',
      responseStyle: 'balanced',
      useImage: true,
      autoResponse: 'manual',
      pauseDelaySec: 8,
      opacity: 0.97,
      vadSensitivity: 'normal',
      customProvider: DEFAULT_CUSTOM_PROVIDER,

      setMode: (mode) => set({ mode }),
      setUIMode: (visible) => set({ visible }),
      cycleUIMode: () => {
        const cur = get().visible
        set({ visible: cur === 'full' ? 'mini' : cur === 'mini' ? 'hidden' : 'full' })
      },
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setHistoryOpen: (historyOpen) => set({ historyOpen }),
      addScreenshots: (imgs) =>
        set((s) => ({ screenshots: [...s.screenshots, ...imgs].slice(-4) })),
      removeScreenshot: (i) => set((s) => ({ screenshots: s.screenshots.filter((_, x) => x !== i) })),
      clearScreenshots: () => set({ screenshots: [] }),
      setStreamActive: (streamActive) => set({ streamActive }),
      setLastExchange: (lastQuestion, lastAnswer) => set({ lastQuestion, lastAnswer }),

      setSetting: (key, value) => set({ [key]: value } as Partial<NyaksaiState>),
      resetPrompts: () =>
        set({ systemPromptAsk: DEFAULT_ASK_PROMPT, systemPromptListen: DEFAULT_LISTEN_PROMPT }),
    }),
    {
      name: 'nyaksai-settings',
      partialize: (s) => ({
        systemPromptAsk: s.systemPromptAsk,
        systemPromptListen: s.systemPromptListen,
        language: s.language,
        responseStyle: s.responseStyle,
        useImage: s.useImage,
        autoResponse: s.autoResponse,
        pauseDelaySec: s.pauseDelaySec,
        opacity: s.opacity,
        vadSensitivity: s.vadSensitivity,
        customProvider: s.customProvider,
      }),
    }
  )
)
