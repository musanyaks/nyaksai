import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300

interface AskMessage {
  role: 'user' | 'assistant'
  text: string
}

interface AskRequestBody {
  messages?: AskMessage[]
  images?: string[] // data URLs (image/jpeg;base64,...)
  systemPrompt?: string
  context?: string
  provider?: { baseUrl?: string; apiKey?: string; model?: string }
}

interface ProviderConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/** Error carrying the provider's HTTP status so the caller can react to it. */
class ProviderError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

/** Valid provider config from the request body, or null when absent. */
function providerFrom(body: AskRequestBody): ProviderConfig | null {
  const p = body.provider
  if (!p?.apiKey || !p.baseUrl) return null
  return {
    baseUrl: p.baseUrl.trim().replace(/\/+$/, ''),
    apiKey: p.apiKey.trim(),
    model: p.model?.trim() || 'openai/gpt-oss-120b',
  }
}

/** SSE frames sent to the client: {"t": "..."} chunks, {"suggestions": []}, {"done": true}, {"error": "..."} */
function sse(controller: ReadableStreamDefaultController, payload: unknown) {
  controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`))
}

/** OpenAI-compatible message array (proper 'system' role + image parts on the last user turn). */
function providerMessages(systemContent: string, history: AskMessage[], images: string[]) {
  const msgs: Record<string, unknown>[] = [{ role: 'system', content: systemContent }]
  history.forEach((m, idx) => {
    const isLast = idx === history.length - 1
    if (isLast && images.length > 0) {
      msgs.push({
        role: 'user',
        content: [
          { type: 'text', text: m.text || 'Look at the attached screenshot(s) and answer.' },
          ...images.map((url) => ({ type: 'image_url', image_url: { url } })),
        ],
      })
    } else {
      msgs.push({ role: m.role, content: m.text })
    }
  })
  return msgs
}

/** Turn a provider HTTP error into a readable message. */
function describeProviderError(status: number, detail: string, provider: ProviderConfig): string {
  if (status === 401) {
    return `Your API key was rejected (401). Create a new key in your provider's console, copy it with no spaces or quotes, and check the Base URL (${provider.baseUrl}).`
  }
  if (status === 404) {
    return `The model "${provider.model}" was not found or your account has no access to it (404). Pick a current model ID from your provider's model list in Settings → Model.`
  }
  if (status === 429) {
    return 'The provider rate limit or quota was reached (429). Wait a moment, use a smaller model, or check your plan and balance.'
  }
  return `Provider error ${status}: ${detail.slice(0, 300) || 'no details returned'}`
}

/** Stream an answer from any OpenAI-compatible /chat/completions endpoint. */
async function streamFromProvider(
  provider: ProviderConfig,
  apiMessages: Record<string, unknown>[],
  onDelta: (text: string) => void
): Promise<string> {
  let res: Response
  try {
    res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({ model: provider.model, messages: apiMessages, stream: true }),
    })
  } catch (e) {
    throw new ProviderError(
      `Could not reach ${provider.baseUrl} — check the Base URL and your connection. (${e instanceof Error ? e.message : 'network error'})`,
      502
    )
  }
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => '')
    throw new ProviderError(describeProviderError(res.status, detail, provider), res.status)
  }
  return pipeUpstream(res.body, onDelta)
}

/** Follow-up chips generated from the actual answer via the provider. */
async function providerSuggestions(
  provider: ProviderConfig,
  lastQuestion: string,
  answer: string
): Promise<string[]> {
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'You generate short follow-up questions. Output exactly 3 follow-up questions, one per line, no numbering, no quotes, each under 8 words.',
          },
          {
            role: 'user',
            content: `Question asked:\n${lastQuestion.slice(0, 800)}\n\nAnswer given:\n${answer.slice(0, 1500)}\n\nOutput the 3 follow-up questions now.`,
          },
        ],
      }),
    })
    if (!res.ok) return []
    const j = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return (j.choices?.[0]?.message?.content ?? '')
      .split('\n')
      .map((l) => l.replace(/^[-*\d.)\s]+/, '').trim())
      .filter((l) => l.length > 3 && l.length < 90)
      .slice(0, 3)
  } catch {
    return []
  }
}

/** Pull text deltas out of the upstream SSE stream and forward them downstream. */
async function pipeUpstream(
  upstream: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<string> {
  const reader = upstream.getReader()
  const dec = new TextDecoder()
  let buf = ''
  let answer = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let idx: number
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const j = JSON.parse(payload) as {
          choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
        }
        const delta =
          j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.message?.content ?? ''
        if (delta) {
          answer += delta
          onDelta(delta)
        }
      } catch {
        /* partial json line — ignore */
      }
    }
  }
  return answer
}

export async function POST(request: Request) {
  let body: AskRequestBody
  try {
    body = (await request.json()) as AskRequestBody
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body.' }, { status: 400 })
  }

  const history = Array.isArray(body.messages) ? body.messages.slice(-12) : []
  const images = (body.images ?? []).filter((i) => i.startsWith('data:')).slice(0, 3)

  if (history.length === 0 && images.length === 0) {
    return NextResponse.json(
      { success: false, error: 'Nothing to answer — send a question or a screenshot.' },
      { status: 400 }
    )
  }

  const provider = providerFrom(body)

  const systemContent = [
    body.systemPrompt?.trim() ||
      'You are Nyaksai, a real-time assistant. Answer clearly, accurately and concisely.',
    body.context ? `Live conversation context:\n${body.context}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const lastUser = [...history].reverse().find((m) => m.role === 'user')?.text ?? 'Screenshot question'

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!provider) {
          sse(controller, {
            error:
              'No AI provider configured. Open Settings → Model, turn on "connect your own provider", and enter your Base URL, API key and chat model (for Groq: https://api.groq.com/openai/v1).',
          })
          return
        }

        let answer = ''
        try {
          answer = await streamFromProvider(
            provider,
            providerMessages(systemContent, history, images),
            (delta) => sse(controller, { t: delta })
          )
        } catch (e) {
          // Text-only models reject image parts with a 400. Retry once without the screenshots.
          if (e instanceof ProviderError && e.status === 400 && images.length > 0) {
            sse(controller, {
              t: '_Your chat model cannot read images, so this answer ignores the screenshot._\n\n',
            })
            answer = await streamFromProvider(
              provider,
              providerMessages(systemContent, history, []),
              (delta) => sse(controller, { t: delta })
            )
          } else {
            throw e
          }
        }

        if (!answer.trim()) {
          sse(controller, { error: 'Your provider returned an empty answer.' })
          return
        }
        sse(controller, { suggestions: await providerSuggestions(provider, lastUser, answer) })
        sse(controller, { done: true })
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'The assistant could not answer.'
        console.error('[POST /api/ask]', msg)
        sse(controller, { error: msg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}