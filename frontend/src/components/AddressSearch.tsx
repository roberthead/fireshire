import { useState, type FormEvent } from 'react'

export function AddressSearch() {
  const [address, setAddress] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // TODO: query backend with address
    console.log('Search:', address)
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
      <input
        type="text"
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="Enter Ashland address..."
        style={{ padding: '0.5rem', width: '300px' }}
      />
      <button type="submit" style={{ padding: '0.5rem 1rem' }}>
        Search
      </button>
    </form>
  )
}
