const zones = [
  { label: 'Zone 1 (0–5 ft)', color: '#e53e3e', description: 'Non-combustible hardscape' },
  { label: 'Zone 2 (5–10 ft)', color: '#ed8936', description: 'Ember catch zone' },
  { label: 'Zone 3 (10–30 ft)', color: '#ecc94b', description: 'Lean, clean, green' },
  { label: 'Zone 4 (30–100 ft)', color: '#48bb78', description: 'Reduce fuel continuity' },
]

export function ZoneLegend() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.9)', padding: '0.75rem', borderRadius: '4px' }}>
      <strong style={{ fontSize: '0.85rem' }}>Fire Zones</strong>
      {zones.map((z) => (
        <div key={z.label} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.25rem', fontSize: '0.8rem' }}>
          <span style={{ width: 14, height: 14, background: z.color, borderRadius: 2, display: 'inline-block' }} />
          <span>{z.label}</span>
        </div>
      ))}
    </div>
  )
}
