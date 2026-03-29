export interface StatusBannerProps {
  variant: 'loading' | 'error' | 'warning' | 'info'
  message: string
  onDismiss?: () => void
  onRetry?: () => void
}

let spinnerInjected = false
function ensureSpinnerStyle() {
  if (spinnerInjected) return
  const style = document.createElement('style')
  style.textContent =
    '@keyframes fireshire-spin { to { transform: rotate(360deg) } }'
  document.head.appendChild(style)
  spinnerInjected = true
}

const variantStyles: Record<
  StatusBannerProps['variant'],
  { background: string; border: string; color: string; role?: string; ariaLive?: 'polite' }
> = {
  loading: {
    background: 'rgba(0, 0, 0, 0.55)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#e2e8f0',
    role: 'status',
    ariaLive: 'polite',
  },
  error: {
    background: 'rgba(127, 29, 29, 0.7)',
    border: '1px solid rgba(252,165,165,0.3)',
    color: '#fca5a5',
    role: 'alert',
  },
  warning: {
    background: 'rgba(120, 53, 15, 0.7)',
    border: '1px solid rgba(252,211,77,0.3)',
    color: '#fcd34d',
    role: 'alert',
  },
  info: {
    background: 'rgba(0, 0, 0, 0.55)',
    border: '1px solid rgba(255,255,255,0.2)',
    color: '#e2e8f0',
  },
}

const buttonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px solid currentColor',
  borderRadius: 4,
  cursor: 'pointer',
  color: 'inherit',
  padding: '0.25rem 0.5rem',
  fontSize: '0.75rem',
}

export function StatusBanner({
  variant,
  message,
  onDismiss,
  onRetry,
}: StatusBannerProps) {
  if (variant === 'loading') {
    ensureSpinnerStyle()
  }

  const v = variantStyles[variant]

  return (
    <div
      role={v.role}
      aria-live={v.ariaLive}
      style={{
        background: v.background,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: v.border,
        borderRadius: 8,
        padding: '0.75rem',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '0.5rem',
        color: v.color,
      }}
    >
      {variant === 'loading' && (
        <span
          style={{
            width: 16,
            height: 16,
            border: '2px solid rgba(255,255,255,0.3)',
            borderTopColor: '#fff',
            borderRadius: '50%',
            display: 'inline-block',
            flexShrink: 0,
            animation: 'fireshire-spin 0.8s linear infinite',
          }}
        />
      )}

      <span style={{ fontSize: '0.85rem', flex: 1 }}>{message}</span>

      {onRetry && (
        <button type="button" onClick={onRetry} style={buttonStyle}>
          Retry
        </button>
      )}

      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          style={buttonStyle}
        >
          &times;
        </button>
      )}
    </div>
  )
}
