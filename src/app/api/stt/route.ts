import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 120

const MAX_BYTES = 25 * 1024 * 1024 // 25 MB of audio is plenty for utterances

/**
 * POST /api/stt — speech-to-text through your own OpenAI-compatible provider
 * (e.g. Groq: POST {baseUrl}/audio/transcriptions with whisper-large-v3).
 * Accepts either multipart/form-data with an `audio` file (Blob) or
 * JSON { audio_base64 } / { audio: dataURL }. Returns { success, text }.
 */
export async function POST(request: Request) {
  try {
    let base64: string | null = null
    let provider: { baseUrl: string; apiKey: string; model: string } | null = null

    const contentType = request.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('audio')
      // Provider fields appended by the client when a custom provider is enabled.
      const pBase = form.get('providerBaseUrl')
      const pKey = form.get('providerApiKey')
      const pModel = form.get('providerModel')
      if (typeof pBase === 'string' && typeof pKey === 'string' && pBase && pKey) {
        provider = {
          baseUrl: pBase.trim().replace(/\/+$/, ''),
          apiKey: pKey.trim(),
          model: (typeof pModel === 'string' && pModel.trim()) || 'whisper-large-v3',
        }
      }
      if (!(file instanceof Blob)) {
        return NextResponse.json(
          { success: false, error: 'No audio file received.' },
          { status: 400 }
        )
      }
      if (file.size === 0) {
        return NextResponse.json({ success: false, error: 'Empty audio.' }, { status: 400 })
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { success: false, error: 'Audio clip too large (max 25 MB).' },
          { status: 413 }
        )
      }
      const buf = Buffer.from(await file.arrayBuffer())
      base64 = buf.toString('base64')
    } else {
      const body = (await request.json()) as {
        audio_base64?: string
        audio?: string
        provider?: { baseUrl?: string; apiKey?: string; model?: string }
      }
      if (body.provider?.baseUrl && body.provider?.apiKey) {
        provider = {
          baseUrl: body.provider.baseUrl.trim().replace(/\/+$/, ''),
          apiKey: body.provider.apiKey.trim(),
          model: body.provider.model?.trim() || 'whisper-large-v3',
        }
      }
      const raw = body.audio_base64 ?? body.audio ?? ''
      if (!raw) {
        return NextResponse.json(
          { success: false, error: 'No audio payload received.' },
          { status: 400 }
        )
      }
      base64 = raw.includes(',') && raw.startsWith('data:') ? raw.split(',')[1] : raw
    }

    if (!base64) {
      return NextResponse.json({ success: false, error: 'No audio payload.' }, { status: 400 })
    }

    if (!provider) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No AI provider configured. Open Settings → Model, turn on "connect your own provider" and enter your Base URL, API key and STT model (for Groq: https://api.groq.com/openai/v1 and whisper-large-v3).',
        },
        { status: 400 }
      )
    }

    // Forward to the provider's OpenAI-compatible /audio/transcriptions endpoint.
    const upstream = new FormData()
    upstream.append(
      'file',
      new Blob([Buffer.from(base64, 'base64')], { type: 'audio/wav' }),
      'audio.wav'
    )
    upstream.append('model', provider.model)
    upstream.append('response_format', 'json')

    let r: Response
    try {
      r = await fetch(`${provider.baseUrl}/audio/transcriptions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${provider.apiKey}` },
        body: upstream,
      })
    } catch {
      return NextResponse.json(
        {
          success: false,
          error: `Could not reach ${provider.baseUrl} — check the Base URL and your connection.`,
        },
        { status: 502 }
      )
    }

    if (!r.ok) {
      const detail = await r.text().catch(() => '')
      let error: string
      if (r.status === 401) {
        error =
          "Your API key was rejected (401). Create a new key in your provider's console, copy it with no spaces or quotes, and check the Base URL."
      } else if (r.status === 404) {
        error = `The transcription model "${provider.model}" was not found or your account has no access to it (404). Use a current STT model ID, e.g. whisper-large-v3 on Groq.`
      } else if (r.status === 429) {
        error = 'The provider rate limit or quota was reached (429). Wait a moment and try again.'
      } else {
        error = `Provider transcription error ${r.status}: ${detail.slice(0, 200)}`
      }
      return NextResponse.json({ success: false, error }, { status: 502 })
    }

    const j = (await r.json()) as { text?: string }
    return NextResponse.json({ success: true, text: (j.text ?? '').trim() })
  } catch (error) {
    console.error('[POST /api/stt]', error)
    return NextResponse.json(
      { success: false, error: 'Transcription failed. Please try again.' },
      { status: 500 }
    )
  }
}