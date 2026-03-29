import { createFileRoute } from '@tanstack/react-router'
import { AddressSearch } from '../components/AddressSearch'
import { ZoneLegend } from '../components/ZoneLegend'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <div style={{ position: 'absolute', top: '1rem', left: '1rem', zIndex: 1 }}>
        <AddressSearch />
      </div>
      <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', zIndex: 1 }}>
        <ZoneLegend />
      </div>
      <div style={{ width: '100%', height: '100%', background: '#e0e0e0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#666' }}>Map will render here</span>
      </div>
    </>
  )
}
