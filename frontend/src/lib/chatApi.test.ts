import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { streamChat } from './chatApi'
import { ApiError } from './api'

const encoder = new TextEncoder()

function makeSSEStream(chunks: string[]) {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk))
      }
      controller.close()
    },
  })
}

const defaultContext = { zones: ['0-5'], plants: ['Japanese maple'] }

describe('streamChat', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('calls onChunk for each SSE data line', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: Hello\n\n',
        'data:  world\n\n',
        'data: [DONE]\n\n',
      ]),
    })

    const onChunk = vi.fn()
    await streamChat('Hi', [], defaultContext, onChunk)

    expect(onChunk).toHaveBeenCalledWith('Hello')
    expect(onChunk).toHaveBeenCalledWith(' world')
    expect(onChunk).toHaveBeenCalledTimes(2)
  })

  it('stops on [DONE] sentinel without calling onChunk', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: first\n\n',
        'data: [DONE]\n\n',
        'data: should-not-appear\n\n',
      ]),
    })

    const onChunk = vi.fn()
    await streamChat('Hi', [], defaultContext, onChunk)

    expect(onChunk).toHaveBeenCalledTimes(1)
    expect(onChunk).toHaveBeenCalledWith('first')
  })

  it('throws ApiError on non-200 response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'server_error', detail: 'Something broke' }),
    })

    const onChunk = vi.fn()
    await expect(
      streamChat('Hi', [], defaultContext, onChunk),
    ).rejects.toThrow(ApiError)

    await expect(
      streamChat('Hi', [], defaultContext, onChunk),
    ).rejects.toThrow('Something broke')

    expect(onChunk).not.toHaveBeenCalled()
  })

  it('respects AbortSignal', async () => {
    const controller = new AbortController()
    controller.abort()

    globalThis.fetch = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const onChunk = vi.fn()
    await expect(
      streamChat('Hi', [], defaultContext, onChunk, controller.signal),
    ).rejects.toThrow('Aborted')

    expect(onChunk).not.toHaveBeenCalled()
  })
})
