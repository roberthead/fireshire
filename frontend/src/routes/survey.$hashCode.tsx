import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  getParcel,
  getProgress,
  getLatestSurvey,
  submitSurvey,
  INITIAL_SURVEY,
  type SurveyData,
} from '../lib/allclearApi'

export const Route = createFileRoute('/survey/$hashCode')({
  component: SurveyPage,
})

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="survey-radio-group">
      {options.map((opt) => (
        <label key={opt} className="survey-radio-label">
          <input
            type="radio"
            name={name}
            value={opt}
            checked={value === opt}
            onChange={() => onChange(opt)}
          />
          {opt.charAt(0).toUpperCase() + opt.slice(1)}
        </label>
      ))}
    </div>
  )
}

function SurveyPage() {
  const { hashCode } = Route.useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState<SurveyData>(INITIAL_SURVEY)
  const [prefilled, setPrefilled] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { data: parcel, isLoading: parcelLoading, error: parcelError } = useQuery({
    queryKey: ['allclear-parcel', hashCode],
    queryFn: () => getParcel(hashCode),
  })

  const { data: progress } = useQuery({
    queryKey: ['allclear-progress', hashCode],
    queryFn: () => getProgress(hashCode),
  })

  // Pre-fill from latest survey response
  const { data: latestSurvey } = useQuery({
    queryKey: ['allclear-latest-survey', hashCode],
    queryFn: () => getLatestSurvey(hashCode),
  })

  // Apply latest survey data to form (once)
  if (latestSurvey && !prefilled) {
    setForm(latestSurvey)
    setPrefilled(true)
  }

  function update(field: keyof SurveyData, value: string | boolean) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const result = await submitSurvey(hashCode, form)
      if (!result.map_complete && result.situs_address) {
        // Survey done, map not done — go to map with address pre-filled
        navigate({
          to: '/',
          search: { address: result.situs_address },
        })
      } else {
        // Both done — show success
        navigate({
          to: '/complete/$hashCode',
          params: { hashCode },
        })
      }
    } catch {
      setError('Failed to submit survey. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (parcelLoading) {
    return (
      <div className="survey-page">
        <div className="survey-container">
          <div className="prepare-message">Loading survey...</div>
        </div>
      </div>
    )
  }

  if (parcelError || !parcel) {
    return (
      <div className="survey-page">
        <div className="survey-container">
          <div className="prepare-message prepare-message--warning">
            <h2>Property Not Found</h2>
            <p>This survey link is invalid. Please search for your property on the <a href="/prepare">Get Fire Ready</a> page.</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="survey-page">
      <div className="survey-container">
        <h1 className="survey-title">Fire Preparedness Survey</h1>
        <p className="survey-subtitle">Ashland, Oregon</p>

        {progress?.survey_complete && (
          <div className="prepare-message prepare-message--success" style={{ marginBottom: 'var(--space-4)' }}>
            You previously submitted a survey for this property. Your prior responses are pre-filled below — update anything and re-submit.
          </div>
        )}

        <div className="survey-property-card">
          <h3>Your Property</h3>
          <div className="survey-detail"><span className="survey-label">Address</span><span>{parcel.situs_address}</span></div>
          <div className="survey-detail"><span className="survey-label">Owner</span><span>{parcel.owner_name}</span></div>
          {parcel.year_built && <div className="survey-detail"><span className="survey-label">Year Built</span><span>{parcel.year_built}</span></div>}
          {parcel.acreage && <div className="survey-detail"><span className="survey-label">Acreage</span><span>{parcel.acreage}</span></div>}
          {parcel.evac_zone && <div className="survey-detail"><span className="survey-label">Evacuation Zone</span><span>{parcel.evac_zone}</span></div>}
        </div>

        <form onSubmit={handleSubmit}>
          <section className="survey-section">
            <h3>Contact Information</h3>
            <div className="survey-field">
              <label htmlFor="name">Name</label>
              <input id="name" type="text" value={form.respondent_name} onChange={(e) => update('respondent_name', e.target.value)} className="survey-input" />
            </div>
            <div className="survey-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.respondent_email} onChange={(e) => update('respondent_email', e.target.value)} className="survey-input" />
            </div>
            <div className="survey-field">
              <label htmlFor="phone">Phone</label>
              <input id="phone" type="tel" value={form.respondent_phone} onChange={(e) => update('respondent_phone', e.target.value)} className="survey-input" />
            </div>
          </section>

          <section className="survey-section">
            <h3>Property Fire Safety</h3>
            <div className="survey-field">
              <label>Do you maintain defensible space around your property?</label>
              <RadioGroup name="defensible_space" options={['yes', 'partial', 'no', 'unsure']} value={form.defensible_space} onChange={(v) => update('defensible_space', v)} />
            </div>
            <div className="survey-field">
              <label>Is your roof ember-resistant (Class A)?</label>
              <RadioGroup name="ember_resistant_roof" options={['yes', 'no', 'unsure']} value={form.ember_resistant_roof} onChange={(v) => update('ember_resistant_roof', v)} />
            </div>
            <div className="survey-field">
              <label>How far is vegetation cleared from your home?</label>
              <RadioGroup name="vegetation_clearance" options={['0-5ft', '5-30ft', '30-100ft', 'none', 'unsure']} value={form.vegetation_clearance} onChange={(v) => update('vegetation_clearance', v)} />
            </div>
          </section>

          <section className="survey-section">
            <h3>Emergency Preparedness</h3>
            <div className="survey-field">
              <label>Do you have a household fire evacuation plan?</label>
              <RadioGroup name="has_fire_plan" options={['yes', 'no']} value={form.has_fire_plan} onChange={(v) => update('has_fire_plan', v)} />
            </div>
            <div className="survey-field">
              <label>Do you have a go-bag ready for evacuation?</label>
              <RadioGroup name="has_go_bag" options={['yes', 'partial', 'no']} value={form.has_go_bag} onChange={(v) => update('has_go_bag', v)} />
            </div>
            <div className="survey-field">
              <label htmlFor="water_source">Water source for fire suppression (if any)</label>
              <input id="water_source" type="text" placeholder="e.g., garden hose, pond, hydrant, none" value={form.water_source} onChange={(e) => update('water_source', e.target.value)} className="survey-input" />
            </div>
            <div className="survey-field">
              <label htmlFor="evacuation_route">Primary evacuation route from your property</label>
              <input id="evacuation_route" type="text" placeholder="e.g., Siskiyou Blvd south to I-5" value={form.evacuation_route} onChange={(e) => update('evacuation_route', e.target.value)} className="survey-input" />
            </div>
          </section>

          <section className="survey-section">
            <h3>Community</h3>
            <div className="survey-field">
              <label htmlFor="hoa_name">HOA or neighborhood association (if any)</label>
              <input id="hoa_name" type="text" placeholder="e.g., Billings Ranch HOA" value={form.hoa_name} onChange={(e) => update('hoa_name', e.target.value)} className="survey-input" />
            </div>
            <div className="survey-field">
              <label>I'm interested in: (check all that apply)</label>
              <div className="survey-checkbox-group">
                <label className="survey-checkbox-label">
                  <input type="checkbox" checked={form.wants_assessment} onChange={(e) => update('wants_assessment', e.target.checked)} />
                  Free fire safety assessment for my property
                </label>
                <label className="survey-checkbox-label">
                  <input type="checkbox" checked={form.wants_firewise} onChange={(e) => update('wants_firewise', e.target.checked)} />
                  Firewise USA community certification program
                </label>
                <label className="survey-checkbox-label">
                  <input type="checkbox" checked={form.wants_newsletter} onChange={(e) => update('wants_newsletter', e.target.checked)} />
                  Fire preparedness newsletter and updates
                </label>
              </div>
            </div>
          </section>

          <section className="survey-section">
            <h3>Anything Else</h3>
            <div className="survey-field">
              <label htmlFor="concerns">What are your biggest fire safety concerns?</label>
              <textarea id="concerns" rows={3} value={form.concerns} onChange={(e) => update('concerns', e.target.value)} className="survey-textarea" />
            </div>
            <div className="survey-field">
              <label htmlFor="notes">Additional comments</label>
              <textarea id="notes" rows={2} value={form.notes} onChange={(e) => update('notes', e.target.value)} className="survey-textarea" />
            </div>
          </section>

          {error && <div className="prepare-message prepare-message--warning">{error}</div>}

          <button type="submit" className="survey-submit-btn" disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Survey'}
          </button>
        </form>
      </div>
    </div>
  )
}
