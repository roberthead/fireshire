import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createEntry,
  deleteEntry,
  fetchEntries,
  updateEntry,
  type PlantEntry,
  type ZoneKey,
} from '../lib/api'
import { AddPlantCombobox } from './AddPlantCombobox'
import { PlantEntryRow } from './PlantEntryRow'
import { StatusBanner } from './StatusBanner'
import { ChatPanel } from './ChatPanel'

export interface ZonePlantListsProps {
  taxlotId: string | null
  address?: string
  hasBuildings: boolean
  onClose: () => void
}

const ZONES: { key: ZoneKey; label: string; band: string }[] = [
  { key: '0-5', label: 'Zone 1', band: '0–5 ft' },
  { key: '5-10', label: 'Zone 2', band: '5–10 ft' },
  { key: '10-30', label: 'Zone 3', band: '10–30 ft' },
  { key: '30-100', label: 'Zone 4', band: '30–100 ft' },
]

const UNDO_WINDOW_MS = 5000

interface PendingDelete {
  entry: PlantEntry
  timer: ReturnType<typeof setTimeout>
}

function entriesQueryKey(taxlotId: string) {
  return ['plant-entries', taxlotId] as const
}

export function ZonePlantLists({
  taxlotId,
  address,
  hasBuildings,
  onClose,
}: ZonePlantListsProps) {
  const queryClient = useQueryClient()
  const [openZone, setOpenZone] = useState<ZoneKey | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [showExplainer, setShowExplainer] = useState(false)
  const [chatOpen, setChatOpen] = useState(false)

  const undoButtonRef = useRef<HTMLButtonElement>(null)
  const addButtonRefs = useRef<Record<ZoneKey, HTMLButtonElement | null>>({
    '0-5': null,
    '5-10': null,
    '10-30': null,
    '30-100': null,
  })

  // Alt+Z keyboard shortcut for undo
  useEffect(() => {
    if (!pendingDelete) return
    function onKey(e: KeyboardEvent) {
      if (e.altKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        undoButtonRef.current?.click()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingDelete])

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: taxlotId ? entriesQueryKey(taxlotId) : ['plant-entries', 'none'],
    queryFn: () => fetchEntries(taxlotId!),
    enabled: taxlotId !== null && hasBuildings,
  })

  const entries = useMemo(() => data?.entries ?? [], [data])
  const grouped = useMemo(() => {
    const m: Record<ZoneKey, PlantEntry[]> = {
      '0-5': [],
      '5-10': [],
      '10-30': [],
      '30-100': [],
    }
    for (const e of entries) {
      const z = e.zone as ZoneKey
      if (m[z]) m[z].push(e)
    }
    return m
  }, [entries])

  function setEntriesCache(updater: (prev: PlantEntry[]) => PlantEntry[]) {
    if (!taxlotId) return
    queryClient.setQueryData(entriesQueryKey(taxlotId), (old: { entries: PlantEntry[] } | undefined) => ({
      entries: updater(old?.entries ?? []),
    }))
  }

  const createMutation = useMutation({
    mutationFn: createEntry,
    onMutate: async (vars) => {
      if (!taxlotId) return
      await queryClient.cancelQueries({ queryKey: entriesQueryKey(taxlotId) })
      const previous = queryClient.getQueryData(entriesQueryKey(taxlotId))
      const optimistic: PlantEntry = {
        id: `tmp-${Date.now()}-${Math.random()}`,
        taxlot_id: vars.taxlot_id,
        zone: vars.zone,
        plant_id: vars.plant_id ?? null,
        plant_name: vars.plant_name,
        source: 'manual',
        image_url: null,
        notes: vars.notes ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setEntriesCache((prev) => [...prev, optimistic])
      return { previous, tempId: optimistic.id }
    },
    onError: (_err, _vars, ctx) => {
      if (taxlotId && ctx?.previous) {
        queryClient.setQueryData(entriesQueryKey(taxlotId), ctx.previous)
      }
      setAnnouncement('Could not add plant. Please try again.')
    },
    onSuccess: (created, _vars, ctx) => {
      setEntriesCache((prev) =>
        prev.map((e) => (e.id === ctx?.tempId ? created : e)),
      )
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateEntry>[1] }) =>
      updateEntry(id, data),
    onMutate: async ({ id, data }) => {
      if (!taxlotId) return
      await queryClient.cancelQueries({ queryKey: entriesQueryKey(taxlotId) })
      const previous = queryClient.getQueryData(entriesQueryKey(taxlotId))
      setEntriesCache((prev) =>
        prev.map((e) => (e.id === id ? { ...e, ...data } : e)),
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (taxlotId && ctx?.previous) {
        queryClient.setQueryData(entriesQueryKey(taxlotId), ctx.previous)
      }
      setAnnouncement('Could not move plant. Please try again.')
    },
    onSuccess: (updated) => {
      setEntriesCache((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
    },
  })

  function handleAdd(zone: ZoneKey, sel: { plant: { id: string; commonName: string | null; genus: string | null; species: string | null } | null; label: string }) {
    if (!taxlotId) return
    if (grouped[zone].length >= 100) {
      setAnnouncement(`Zone ${zone} has reached the 100-plant limit.`)
      return
    }
    createMutation.mutate({
      taxlot_id: taxlotId,
      zone,
      plant_id: sel.plant?.id ?? null,
      plant_name: sel.label,
    })
    setAnnouncement(
      `${sel.label} added to ${zoneLabelFor(zone)}; ${grouped[zone].length + 1} plants in zone`,
    )
    setOpenZone(null)
    // Return focus to the add button for this zone
    queueMicrotask(() => addButtonRefs.current[zone]?.focus())
  }

  function handleMove(entry: PlantEntry, nextZone: ZoneKey) {
    if (grouped[nextZone].length >= 100) {
      setAnnouncement(`Zone ${nextZone} has reached the 100-plant limit.`)
      return
    }
    updateMutation.mutate({ id: entry.id, data: { zone: nextZone } })
    setAnnouncement(
      `${entry.plant_name} moved to ${zoneLabelFor(nextZone)}`,
    )
  }

  // Delete flow: DEFER the network call for 5 seconds. If user clicks Undo,
  // we cancel the pending timer and restore the row without ever hitting the
  // backend. This sidesteps the fact that the backend PATCH cannot undelete
  // a soft-deleted entry (update_entry rejects rows where deleted_at is set).
  function handleDelete(entry: PlantEntry) {
    if (!taxlotId) return
    // If another undo is pending, commit it immediately
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer)
      deleteEntry(pendingDelete.entry.id).catch(() => {})
    }
    // Optimistically remove from visible list
    setEntriesCache((prev) => prev.filter((e) => e.id !== entry.id))

    const timer = setTimeout(() => {
      deleteEntry(entry.id)
        .catch(() => {
          // Failed to delete on server — restore in cache
          setEntriesCache((prev) => [...prev, entry])
          setAnnouncement('Could not delete. Restored.')
        })
      setPendingDelete(null)
    }, UNDO_WINDOW_MS)

    setPendingDelete({ entry, timer })
    setAnnouncement(`${entry.plant_name} removed. Undo available.`)
  }

  function handleUndo() {
    if (!pendingDelete) return
    clearTimeout(pendingDelete.timer)
    setEntriesCache((prev) => {
      if (prev.some((e) => e.id === pendingDelete.entry.id)) return prev
      return [...prev, pendingDelete.entry]
    })
    setAnnouncement(`${pendingDelete.entry.plant_name} restored.`)
    setPendingDelete(null)
  }

  function handleAskRascal(_entry: PlantEntry) {
    void _entry
    // V1: just open the chat and focus the input. No context pre-fill.
    setChatOpen(true)
  }

  // Focus the chat input when it becomes visible
  useEffect(() => {
    if (chatOpen) {
      const input = document.querySelector<HTMLInputElement>(
        'input[placeholder="Ask about fire-resilient landscaping..."]',
      )
      input?.focus()
    }
  }, [chatOpen])

  if (!hasBuildings) {
    return (
      <section
        aria-labelledby="zone-plants-heading"
        style={panelStyle}
      >
        <Header onClose={onClose} />
        <StatusBanner
          variant="info"
          message="No buildings detected — zones unavailable"
        />
        <button
          type="button"
          onClick={() => setShowExplainer((v) => !v)}
          aria-expanded={showExplainer}
          style={{
            ...linkButtonStyle,
            marginTop: '0.5rem',
          }}
        >
          Why am I seeing this?
        </button>
        {showExplainer && (
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.25rem' }}>
            Fire zones are drawn as buffers around detected building footprints.
            When no buildings are found on a parcel, we can't compute zones, so
            plant lists are unavailable for this property.
          </p>
        )}
      </section>
    )
  }

  return (
    <section aria-labelledby="zone-plants-heading" style={panelStyle}>
      <Header onClose={onClose} onToggleChat={() => setChatOpen((v) => !v)} chatOpen={chatOpen} />

      {/* aria-live announcer */}
      <div
        role="status"
        aria-live="polite"
        style={srOnlyStyle}
      >
        {announcement}
      </div>

      {isFetching && !data && (
        <StatusBanner variant="loading" message="Loading plants..." />
      )}

      {error && (
        <StatusBanner
          variant="error"
          message={error instanceof Error ? error.message : 'Failed to load entries.'}
          onRetry={() => refetch()}
        />
      )}

      {!chatOpen && data && (
        <div style={{ maxHeight: '55vh', overflowY: 'auto', margin: '0 -0.25rem', padding: '0 0.25rem' }}>
          {ZONES.map((z) => {
            const zoneEntries = grouped[z.key]
            const isOpen = openZone === z.key
            return (
              <div key={z.key} style={{ marginBottom: '0.75rem' }}>
                <h3
                  style={{
                    fontSize: '0.8rem',
                    color: '#fff',
                    margin: '0 0 0.25rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                  }}
                >
                  <span>{z.label}</span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>
                    {z.band}
                  </span>
                  <span
                    aria-label={`${zoneEntries.length} plants`}
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 600,
                      background: 'rgba(255,255,255,0.15)',
                      color: '#e2e8f0',
                      padding: '1px 6px',
                      borderRadius: 3,
                    }}
                  >
                    {zoneEntries.length}
                  </span>
                </h3>

                {zoneEntries.length === 0 && !isOpen && (
                  <p style={{ fontSize: '0.75rem', color: '#94a3b8', margin: '0 0 0.25rem' }}>
                    Add the first plant in {z.label}
                  </p>
                )}

                {zoneEntries.length > 0 && (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                    {zoneEntries.map((entry) => (
                      <PlantEntryRow
                        key={entry.id}
                        entry={entry}
                        onMove={handleMove}
                        onDelete={handleDelete}
                        onAskRascal={handleAskRascal}
                      />
                    ))}
                  </ul>
                )}

                {isOpen ? (
                  <div style={{ marginTop: '0.25rem' }}>
                    <AddPlantCombobox
                      zone={z.key}
                      onCommit={(sel) => handleAdd(z.key, sel)}
                      onCancel={() => {
                        setOpenZone(null)
                        queueMicrotask(() => addButtonRefs.current[z.key]?.focus())
                      }}
                    />
                  </div>
                ) : (
                  <button
                    ref={(el) => {
                      addButtonRefs.current[z.key] = el
                    }}
                    type="button"
                    onClick={() => setOpenZone(z.key)}
                    aria-expanded={false}
                    style={addButtonStyle}
                  >
                    + Add plant
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {chatOpen && (
        <div style={{ height: '55vh', minHeight: 320 }}>
          <ChatPanel address={address} zones={ZONES.map((z) => z.key)} plants={[]} />
        </div>
      )}

      {pendingDelete && (
        <UndoToast
          buttonRef={undoButtonRef}
          entryName={pendingDelete.entry.plant_name}
          onUndo={handleUndo}
        />
      )}
    </section>
  )
}

function zoneLabelFor(zone: ZoneKey) {
  const z = ZONES.find((x) => x.key === zone)
  return z ? z.label : `Zone ${zone}`
}

function Header({
  onClose,
  onToggleChat,
  chatOpen,
}: {
  onClose: () => void
  onToggleChat?: () => void
  chatOpen?: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '0.5rem',
      }}
    >
      <h2
        id="zone-plants-heading"
        style={{
          margin: 0,
          fontSize: 'var(--font-size-lg)',
          fontWeight: 600,
          color: '#fff',
        }}
      >
        Plants by Zone
      </h2>
      <div style={{ display: 'flex', gap: '0.25rem' }}>
        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            aria-pressed={chatOpen}
            aria-label={chatOpen ? 'Back to plants' : 'Open Rascal chat'}
            style={{
              background: 'none',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: 4,
              color: '#e2e8f0',
              cursor: 'pointer',
              fontSize: '0.75rem',
              padding: '0 0.5rem',
              minWidth: 44,
              minHeight: 44,
            }}
          >
            {chatOpen ? '← Plants' : 'Chat'}
          </button>
        )}
        <button
          onClick={onClose}
          aria-label="Close plant panel"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: 0,
            minWidth: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          &times;
        </button>
      </div>
    </div>
  )
}

function UndoToast({
  buttonRef,
  entryName,
  onUndo,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>
  entryName: string
  onUndo: () => void
}) {
  return (
    <div
      role="status"
      aria-keyshortcuts="Alt+Z"
      style={{
        position: 'fixed',
        bottom: 'var(--space-4)',
        left: '50%',
        transform: 'translateX(-50%)',
        background: 'rgba(0, 0, 0, 0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: 8,
        padding: '0.5rem 0.75rem',
        color: '#e2e8f0',
        fontSize: '0.8rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        zIndex: 10,
      }}
    >
      <span>{entryName} removed.</span>
      <button
        ref={buttonRef}
        type="button"
        onClick={onUndo}
        style={{
          background: 'none',
          border: '1px solid currentColor',
          borderRadius: 4,
          color: 'var(--color-fire)',
          cursor: 'pointer',
          padding: '0.25rem 0.75rem',
          fontSize: '0.8rem',
          fontWeight: 600,
          minHeight: 44,
        }}
      >
        Undo
      </button>
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  background: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8,
  padding: '0.75rem',
  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
}

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  overflow: 'hidden',
  clip: 'rect(0,0,0,0)',
  whiteSpace: 'nowrap',
}

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--color-fire)',
  cursor: 'pointer',
  fontSize: '0.75rem',
  textDecoration: 'underline',
  padding: 0,
  minHeight: 44,
}

const addButtonStyle: React.CSSProperties = {
  background: 'none',
  border: '1px dashed rgba(255,255,255,0.25)',
  borderRadius: 4,
  color: '#e2e8f0',
  cursor: 'pointer',
  padding: '0.35rem 0.5rem',
  fontSize: '0.75rem',
  minHeight: 44,
  width: '100%',
  textAlign: 'left',
}
