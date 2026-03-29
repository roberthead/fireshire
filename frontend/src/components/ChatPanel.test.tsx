import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from './ChatPanel'

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

const defaultProps = {
  address: '123 Main St',
  zones: ['0-5', '10-30'],
  plants: [
    {
      id: 'p1',
      genus: 'Acer',
      species: 'palmatum',
      commonName: 'Japanese maple',
      primaryImage: null,
      values: [],
    },
  ],
}

describe('ChatPanel', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('renders input field and send button', () => {
    render(<ChatPanel {...defaultProps} />)
    expect(screen.getByPlaceholderText('Ask about fire-resilient landscaping...')).toBeTruthy()
    expect(screen.getByLabelText('Send message')).toBeTruthy()
  })

  it('send button is disabled when input is empty', () => {
    render(<ChatPanel {...defaultProps} />)
    const button = screen.getByLabelText('Send message') as HTMLButtonElement
    expect(button.disabled).toBe(true)
  })

  it('sending a message displays the user message in the chat area', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream(['data: [DONE]\n\n']),
    })

    render(<ChatPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('Ask about fire-resilient landscaping...')
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() => {
      expect(screen.getByText('Hello')).toBeTruthy()
    })
  })

  it('streamed response text appears', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: makeSSEStream([
        'data: Hello\n\n',
        'data:  world\n\n',
        'data: [DONE]\n\n',
      ]),
    })

    render(<ChatPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('Ask about fire-resilient landscaping...')
    fireEvent.change(input, { target: { value: 'Hi' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() => {
      expect(screen.getByText('Hello world')).toBeTruthy()
    })
  })

  it('error state displays error message', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ detail: 'Internal server error' }),
    })

    render(<ChatPanel {...defaultProps} />)
    const input = screen.getByPlaceholderText('Ask about fire-resilient landscaping...')
    fireEvent.change(input, { target: { value: 'Hi' } })
    fireEvent.click(screen.getByLabelText('Send message'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toBe('Internal server error')
    })
  })
})
