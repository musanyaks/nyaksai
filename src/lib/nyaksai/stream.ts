import { useNyaksaiStore } from '@/lib/nyaksai/store'

/**
 * Client helper for the real SSE answer stream from POST /api/ask.
 * Frame protocol: {"t": "..."} text chunks, {"suggestions": [...]}, {"done": true}, {"error": "..."}.
 * If a custom (BYOK) provider is enabled in Settings, it is attached to every request.
 */
export interface AskStreamBody {
  messages: Array<{ role: 'user' | 'assistant'; text: string }>
  images?: string[]
  systemPrompt?: string
  context?: string
}

export interface AskStreamResult {
  content: string
  suggestions: string[]
}

export async function streamAsk(
  body: AskStreamBody,
  onChunk: (text: string) => void,
  signal?: AbortSignal
): Promise<AskStreamResult> {
  // Attach the user's custom (BYOK) provider when enabled in Settings.
  const cp = useNyaksaiStore.getState().customProvider
  const provider =
    cp?.enabled && cp.apiKey && cp.baseUrl
      ? {
          baseUrl: cp.baseUrl.trim().replace(/\/+$/, ''),
          apiKey: cp.apiKey,
          model: cp.model.trim() || 'gpt-4o-mini',
        }
      : undefined

  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, provider }),
    signal,
  })

  if (!res.ok || !res.body) {
    let msg = 'Request failed'
    try {
      const j = (await res.json()) as { error?: string }
      msg = j.error ?? msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }

  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let content = ''
  let suggestions: string[] = []
  let failure: string | null = null

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n\n')) !== -1) {
      const raw = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      for (const line of raw.split('\n')) {
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue
        try {
          const frame = JSON.parse(payload) as {
            t?: string
            suggestions?: string[]
            done?: boolean
            error?: string
          }
          if (frame.t) {
            content += frame.t
            onChunk(frame.t)
          }
          if (frame.suggestions) suggestions = frame.suggestions
          if (frame.error) failure = frame.error
        } catch {
          /* ignore malformed frame */
        }
      }
    }
  }

  if (failure && !content) throw new Error(failure)
  return { content, suggestions }
}
