import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { StatusBanner } from './StatusBanner'

describe('StatusBanner', () => {
  it('renders message text for loading variant', () => {
    render(<StatusBanner variant="loading" message="Loading data…" />)
    expect(screen.getByText('Loading data…')).toBeInTheDocument()
  })

  it("loading variant has role='status' with aria-live='polite'", () => {
    render(<StatusBanner variant="loading" message="Please wait" />)
    const container = screen.getByRole('status')
    expect(container).toBeInTheDocument()
    expect(container).toHaveAttribute('aria-live', 'polite')
  })

  it("error variant has role='alert'", () => {
    render(<StatusBanner variant="error" message="Something went wrong" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it("warning variant has role='alert'", () => {
    render(<StatusBanner variant="warning" message="Check your input" />)
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })

  it('renders retry button only when onRetry provided', () => {
    const { unmount } = render(
      <StatusBanner variant="error" message="Failed" />,
    )
    expect(
      screen.queryByRole('button', { name: /retry/i }),
    ).not.toBeInTheDocument()
    unmount()

    render(
      <StatusBanner variant="error" message="Failed" onRetry={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /retry/i }),
    ).toBeInTheDocument()
  })

  it('retry button calls onRetry handler', () => {
    const onRetry = vi.fn()
    render(
      <StatusBanner variant="error" message="Failed" onRetry={onRetry} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renders dismiss button only when onDismiss provided', () => {
    const { unmount } = render(
      <StatusBanner variant="info" message="Note" />,
    )
    expect(
      screen.queryByRole('button', { name: /dismiss/i }),
    ).not.toBeInTheDocument()
    unmount()

    render(
      <StatusBanner variant="info" message="Note" onDismiss={vi.fn()} />,
    )
    expect(
      screen.getByRole('button', { name: /dismiss/i }),
    ).toBeInTheDocument()
  })

  it('dismiss button calls onDismiss handler', () => {
    const onDismiss = vi.fn()
    render(
      <StatusBanner variant="info" message="Note" onDismiss={onDismiss} />,
    )
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })
})
