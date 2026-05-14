import { useEffect, useId, useState } from 'react'
import type { PlantEntry } from '../lib/api'

export interface PlantLightboxCustomProps {
  entry: PlantEntry
  onSave: (notes: string) => Promise<void> | void
}

export function PlantLightboxCustom({ entry, onSave }: PlantLightboxCustomProps) {
  const labelId = useId()
  const helpId = useId()
  const seed = entry.notes ?? ''
  const [draft, setDraft] = useState(seed)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  // Reset draft when the underlying entry changes (different item opened).
  useEffect(() => {
    setDraft(entry.notes ?? '')
    setSavedAt(null)
  }, [entry.id, entry.notes])

  const dirty = draft !== seed

  async function handleSave() {
    if (!dirty || saving) return
    setSaving(true)
    try {
      await onSave(draft)
      setSavedAt(Date.now())
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(seed)
  }

  return (
    <>
      <label htmlFor={labelId} className="plant-lightbox__field-label">
        Description
      </label>
      <p id={helpId} className="plant-lightbox__field-help">
        Add details about this item (e.g., "Compost pile, ~3 ft tall, kept moist").
      </p>
      <textarea
        id={labelId}
        aria-describedby={helpId}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={5}
        className="plant-lightbox__textarea"
      />
      <div className="plant-lightbox__save-row">
        <button
          type="button"
          onClick={handleCancel}
          disabled={!dirty || saving}
          className="plant-lightbox__cancel"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="plant-lightbox__save"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      {savedAt && !dirty && (
        <p role="status" aria-live="polite" className="plant-lightbox__saved-flag">
          Description saved.
        </p>
      )}
    </>
  )
}
