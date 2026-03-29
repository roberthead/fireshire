import { useEffect, useRef, useState } from 'react'
import type { Plant } from '../lib/api'
import type { ChatMessage } from '../lib/chatApi'
import { streamChat } from '../lib/chatApi'

export interface ChatPanelProps {
  address?: string
  zones: string[]
  plants: Plant[]
}

export function ChatPanel({ address, zones, plants }: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  const handleSend = () => {
    const trimmed = input.trim()
    if (!trimmed || isStreaming) return

    setError(null)
    const userMessage: ChatMessage = { role: 'user', content: trimmed }
    const updatedMessages = [...messages, userMessage]
    setMessages(updatedMessages)
    setInput('')
    setIsStreaming(true)

    const assistantMessage: ChatMessage = { role: 'assistant', content: '' }
    setMessages([...updatedMessages, assistantMessage])

    const controller = new AbortController()
    abortControllerRef.current = controller

    const context = {
      address,
      zones,
      plants: plants.map(
        (p) => p.commonName ?? p.genus ?? 'Unknown',
      ),
    }

    streamChat(
      trimmed,
      messages,
      context,
      (text) => {
        assistantMessage.content += text
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = { ...assistantMessage }
          return next
        })
      },
      controller.signal,
    )
      .then(() => {
        setIsStreaming(false)
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setError(err instanceof Error ? err.message : 'An unexpected error occurred.')
        setIsStreaming(false)
      })
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      {/* Message area */}
      <div
        data-testid="chat-messages"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.5rem 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              background:
                msg.role === 'user'
                  ? 'rgba(255,255,255,0.1)'
                  : 'transparent',
              borderRadius: 'var(--radius, 6px)',
              padding: '0.5rem 0.75rem',
              fontSize: '0.8rem',
              color: 'var(--color-text, #e2e8f0)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {msg.content}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div
          role="alert"
          style={{
            fontSize: '0.75rem',
            color: '#f87171',
            padding: '0.25rem 0.5rem',
            marginBottom: '0.25rem',
          }}
        >
          {error}
        </div>
      )}

      {/* Input row */}
      <div
        style={{
          display: 'flex',
          gap: '0.5rem',
          paddingTop: '0.5rem',
          borderTop: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about fire-resilient landscaping..."
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 44,
            padding: '0.4rem 0.6rem',
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: '#e2e8f0',
            fontSize: '0.8rem',
            outline: 'none',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isStreaming}
          aria-label="Send message"
          style={{
            minWidth: 44,
            minHeight: 44,
            padding: '0 0.75rem',
            background: !input.trim() || isStreaming
              ? 'rgba(232,101,43,0.4)'
              : 'var(--color-fire, #E8652B)',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            cursor: !input.trim() || isStreaming ? 'default' : 'pointer',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          Send
        </button>
      </div>
    </div>
  )
}
