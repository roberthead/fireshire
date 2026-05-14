import { useEffect, useId, useMemo, useRef } from 'react'
import type { PlantEntry, ZoneKey } from '../lib/api'
import { PlantLightboxKnown } from './PlantLightboxKnown'
import { PlantLightboxCustom } from './PlantLightboxCustom'

export interface PlantLightboxProps {
  entry: PlantEntry
  onClose: () => void
  onMove: (entry: PlantEntry, nextZone: ZoneKey) => void
  onAskRascal: (entry: PlantEntry) => void
  onDelete: (entry: PlantEntry) => void
  onUpdateNotes: (entry: PlantEntry, notes: string) => Promise<void> | void
}

const ALL_ZONES: ZoneKey[] = ['0-5', '5-10', '10-30', '30-100']
const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled])'

export function PlantLightbox({
  entry,
  onClose,
  onMove,
  onAskRascal,
  onDelete,
  onUpdateNotes,
}: PlantLightboxProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const isCustom = entry.plant_id === null

  // Capture the element that opened us so we can return focus on close.
  useEffect(() => {
    triggerRef.current = document.activeElement as HTMLElement | null
    return () => {
      requestAnimationFrame(() => {
        triggerRef.current?.focus?.()
      })
    }
  }, [])

  // Initial focus: first non-disabled move chip (or any focusable element).
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const focusables = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    const firstChip = dialog.querySelector<HTMLElement>('[data-move-chip]:not([disabled])')
    ;(firstChip ?? focusables[0])?.focus()
  }, [entry.id])

  // ESC closes; Tab/Shift+Tab traps focus within the dialog.
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const dialog = dialogRef.current
      if (!dialog) return
      const focusables = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  function handleBackdropMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    // Only close if the press started on the backdrop, not on inner content.
    if (e.target === e.currentTarget) onClose()
  }

  function handleDelete() {
    onClose()
    onDelete(entry)
  }

  function handleAskRascal() {
    onClose()
    onAskRascal(entry)
  }

  const body = useMemo(() => {
    if (isCustom) {
      return (
        <PlantLightboxCustom
          entry={entry}
          onSave={(notes) => onUpdateNotes(entry, notes)}
        />
      )
    }
    return <PlantLightboxKnown entry={entry} />
  }, [entry, isCustom, onUpdateNotes])

  return (
    <div
      className="plant-lightbox-backdrop"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="plant-lightbox"
      >
        <header className="plant-lightbox__header">
          <h2 id={titleId} className="plant-lightbox__title">
            {entry.plant_name}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="plant-lightbox__close"
          >
            &times;
          </button>
        </header>

        <div className="plant-lightbox__body">{body}</div>

        <footer className="plant-lightbox__actions">
          <div
            role="group"
            aria-label={`Move ${entry.plant_name} to another zone`}
            className="plant-lightbox__moves"
          >
            {ALL_ZONES.map((z) => {
              const isCurrent = z === entry.zone
              return (
                <button
                  key={z}
                  type="button"
                  data-move-chip
                  disabled={isCurrent}
                  onClick={() => onMove(entry, z)}
                  aria-label={`Move to Zone ${z}`}
                  aria-current={isCurrent ? 'true' : undefined}
                  className="plant-lightbox__chip"
                >
                  {z}
                </button>
              )
            })}
          </div>
          <div className="plant-lightbox__action-buttons">
            <button
              type="button"
              onClick={handleAskRascal}
              className="plant-lightbox__ask"
            >
              Ask Rascal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              aria-label={`Delete ${entry.plant_name}`}
              className="plant-lightbox__delete"
            >
              Delete
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
