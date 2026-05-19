import { ApiError } from './api'

export interface ChatContext {
  address?: string
  zones: string[]
  plants: string[]
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export async function streamChat(
  message: string,
  history: ChatMessage[],
  context: ChatContext,
  onChunk: (text: string) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/api/chat/stream', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, history, context }),
    signal,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(
      res.status,
      body?.error ?? null,
      body?.detail ?? 'Server error',
    )
  }

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const handleLine = (line: string): 'done' | 'continue' => {
    if (!line.startsWith('data: ')) return 'continue'
    const raw = line.slice(6)
    let evt: { text?: string; done?: boolean; error?: string }
    try {
      evt = JSON.parse(raw)
    } catch {
      return 'continue'
    }
    if (evt.done) return 'done'
    if (evt.error) throw new ApiError(500, 'chat_error', evt.error)
    if (typeof evt.text === 'string') onChunk(evt.text)
    return 'continue'
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    // JSON envelopes contain no raw newlines, so splitting on \n cleanly
    // delimits SSE lines.
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (handleLine(line) === 'done') return
    }
  }

  if (buffer) handleLine(buffer)
}
