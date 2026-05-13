import { useState } from 'react'
import { useNavigate, createFileRoute } from '@tanstack/react-router'
import { AddressSearch } from '../components/AddressSearch'
import { fetchParcels, type Parcel } from '../lib/api'
import { resolveParcel } from '../lib/allclearApi'

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

        <div className="prepare-toggle" role="group" aria-label="Choose your role">
          <button
            type="button"
            aria-pressed={mode === 'samaritan'}
            className={`toggle-btn ${mode === 'samaritan' ? 'toggle-btn--active' : ''}`}
            onClick={() => setMode('samaritan')}
          >
            I'm a Resident
          </button>
          <button
            type="button"
            aria-pressed={mode === 'hoa'}
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

function SamaritanFlow() {
  const navigate = useNavigate()
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState<string | null>(null)

  async function handleSelect(result: { raw: Parcel; address: string }) {
    const taxlot = result.raw.taxlot_id
    if (!taxlot) {
      setResolveError("That property has no taxlot identifier — we can't start a survey for it.")
      return
    }
    setResolving(true)
    setResolveError(null)
    try {
      const { hash_code } = await resolveParcel({
        map_taxlot: taxlot,
        situs_address: result.address,
        owner_name: result.raw.owner,
        acreage: result.raw.acreage,
      })
      navigate({ to: '/survey/$hashCode', params: { hashCode: hash_code } })
    } catch (err) {
      setResolveError(err instanceof Error ? err.message : 'Failed to start your survey.')
      setResolving(false)
    }
  }

  return (
    <div className="samaritan-flow">
      <p className="flow-description">
        Enter your street address to find your property and start your fire preparedness survey.
      </p>
      <AddressSearch<Parcel>
        searchFn={fetchParcels}
        queryKey="parcels"
        inputAriaLabel="Your Ashland property address"
        placeholder="e.g. 455 Siskiyou Blvd"
        submitLabel="Find My Property"
        emptyHint="We cover properties inside Ashland city limits."
        autoSelectSingle={false}
        autoResubmitSuggestions={false}
        onSelect={handleSelect}
      />
      {resolving && (
        <p className="prepare-message" role="status" aria-live="polite">
          Starting your survey…
        </p>
      )}
      {resolveError && (
        <p className="prepare-message prepare-message--warning" role="alert">
          {resolveError}
        </p>
      )}
    </div>
  )
}

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
