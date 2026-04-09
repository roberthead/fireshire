import { useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { searchParcels, type AllClearParcel } from '../lib/allclearApi'

export const Route = createFileRoute('/prepare')({
  component: PreparePage,
})

type Mode = 'samaritan' | 'hoa'

function PreparePage() {
  const [mode, setMode] = useState<Mode>('samaritan')

  return (
    <div className="prepare-page">
      <div className="prepare-container">
        <h1 className="prepare-title">Get Fire Ready</h1>
        <p className="prepare-subtitle">
          Assess your property's fire preparedness in minutes.
        </p>

        <div className="prepare-toggle">
          <button
            type="button"
            className={`toggle-btn ${mode === 'samaritan' ? 'toggle-btn--active' : ''}`}
            onClick={() => setMode('samaritan')}
          >
            I'm a Resident
          </button>
          <button
            type="button"
            className={`toggle-btn ${mode === 'hoa' ? 'toggle-btn--active' : ''}`}
            onClick={() => setMode('hoa')}
          >
            I'm an HOA
          </button>
        </div>

        {mode === 'samaritan' ? <SamaritanFlow /> : <HOAFlow />}
      </div>
    </div>
  )
}

// ── Samaritan Flow ──────────────────────────────────────────────────────────

function SamaritanFlow() {
  const [address, setAddress] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const navigate = useNavigate()

  const { data: parcels, isFetching } = useQuery({
    queryKey: ['allclear-parcels', searchTerm],
    queryFn: () => searchParcels(searchTerm),
    enabled: searchTerm.length >= 2,
  })

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (address.trim().length < 2) return
    setSearchTerm(address.trim())
  }

  function handleSelect(parcel: AllClearParcel) {
    navigate({ to: '/survey/$hashCode', params: { hashCode: parcel.hash_code } })
  }

  return (
    <div className="samaritan-flow">
      <p className="flow-description">
        Enter your street address to find your property and start your fire preparedness survey.
      </p>
      <form onSubmit={handleSubmit} className="search-form prepare-search">
        <input
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="e.g. 455 Siskiyou Blvd"
          aria-label="Your Ashland property address"
          className="search-input prepare-input"
        />
        <button
          type="submit"
          disabled={isFetching || address.trim().length < 2}
          className="search-button"
        >
          {isFetching ? 'Searching...' : 'Find My Property'}
        </button>
      </form>

      {parcels && parcels.length === 0 && searchTerm && (
        <div className="prepare-message prepare-message--warning">
          No properties found for that address. This tool currently covers Ashland, OR.
        </div>
      )}

      {parcels && parcels.length > 0 && (
        <ul className="prepare-results">
          {parcels.map((p) => (
            <li key={p.hash_code}>
              <button
                type="button"
                className="prepare-result-item"
                onClick={() => handleSelect(p)}
              >
                <span className="result-address">{p.situs_address}</span>
                <span className="result-meta">
                  {p.owner_name}
                  {p.acreage ? ` · ${p.acreage} ac` : ''}
                  {p.role === 'owner' ? ' · Owner' : ' · Occupant'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── HOA Flow ────────────────────────────────────────────────────────────────

function HOAFlow() {
  const [copied, setCopied] = useState(false)

  const siteUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const emailBody = `Subject: Assess Your Property's Fire Readiness

Hi neighbor,

Our HOA is encouraging all residents to complete a quick fire preparedness assessment. It takes about 5 minutes and helps our community understand how fire-ready we are.

You can get started here:
${siteUrl}/prepare

You'll enter your address, fill out a short fire safety survey, and see a satellite view of your property with defensible space zones.

Together we can build a more fire-resilient neighborhood.

Thank you`

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(emailBody)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = emailBody
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="hoa-flow">
      <p className="flow-description">
        Copy this pre-written email and send it to your HOA members, inviting them
        to assess their property's fire readiness.
      </p>

      <div className="hoa-email-preview">
        <pre className="hoa-email-text">{emailBody}</pre>
      </div>

      <button
        type="button"
        className={`copy-btn hoa-copy-btn ${copied ? 'copy-btn--copied' : ''}`}
        onClick={handleCopy}
      >
        {copied ? 'Copied!' : 'Copy Email to Clipboard'}
      </button>
    </div>
  )
}
