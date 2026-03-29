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

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    // Keep the last (possibly incomplete) line in the buffer
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') return
      if (payload.startsWith('[ERROR]')) {
        throw new ApiError(500, 'chat_error', payload.slice(8))
      }
      onChunk(payload)
    }
  }

  // Process any remaining buffer
  if (buffer.startsWith('data: ')) {
    const payload = buffer.slice(6)
    if (payload !== '[DONE]') {
      onChunk(payload)
    }
  }
}
