import { useEffect, useId, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { PlantEntry, ZoneKey } from '../lib/api'
import { PlantLightboxKnown } from './PlantLightboxKnown'
import { PlantLightboxCustom } from './PlantLightboxCustom'
import { ChatPanel } from './ChatPanel'

export interface PlantLightboxProps {
  entry: PlantEntry
  address?: string
  onClose: () => void
  onMove: (entry: PlantEntry, nextZone: ZoneKey) => void
  onDelete: (entry: PlantEntry) => void
  onUpdateNotes: (entry: PlantEntry, notes: string) => Promise<void> | void
}

const ALL_ZONES: ZoneKey[] = ['0-5', '5-10', '10-30', '30-100']
const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), [tabindex]:not([tabindex="-1"]), input:not([disabled]), textarea:not([disabled])'

function zoneLabel(zone: ZoneKey): string {
  switch (zone) {
    case '0-5':
      return 'Zone 1 (0–5 ft)'
    case '5-10':
      return 'Zone 2 (5–10 ft)'
    case '10-30':
      return 'Zone 3 (10–30 ft)'
    case '30-100':
      return 'Zone 4 (30–100 ft)'
  }
}

export function PlantLightbox({
  entry,
  address,
  onClose,
  onMove,
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

  const chatPrefill = `Tell me about ${entry.plant_name} in ${zoneLabel(entry.zone as ZoneKey)}.`

  return createPortal(
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

        <div className="plant-lightbox__columns">
          <div className="plant-lightbox__card-col">
            <div className="plant-lightbox__card">{body}</div>

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

            <button
              type="button"
              onClick={handleDelete}
              aria-label={`Delete ${entry.plant_name}`}
              className="plant-lightbox__delete"
            >
              Delete
            </button>
          </div>

          <div
            className="plant-lightbox__chat-col"
            aria-label={`Chat about ${entry.plant_name}`}
          >
            <ChatPanel
              address={address}
              zones={[entry.zone]}
              plants={[]}
              initialInput={chatPrefill}
            />
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
