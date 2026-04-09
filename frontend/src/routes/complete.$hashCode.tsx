import { useQuery } from '@tanstack/react-query'
import { createFileRoute } from '@tanstack/react-router'
import { getParcel, getProgress } from '../lib/allclearApi'

export const Route = createFileRoute('/complete/$hashCode')({
  component: CompletePage,
})

function CompletePage() {
  const { hashCode } = Route.useParams()

  const { data: parcel } = useQuery({
    queryKey: ['allclear-parcel', hashCode],
    queryFn: () => getParcel(hashCode),
  })

  const { data: progress } = useQuery({
    queryKey: ['allclear-progress', hashCode],
    queryFn: () => getProgress(hashCode),
  })

  return (
    <div className="survey-page">
      <div className="survey-container" style={{ textAlign: 'center' }}>
        <h1 className="prepare-title">You're AllClear!</h1>
        <p className="prepare-subtitle">
          Thank you for assessing your property's fire preparedness.
        </p>

        {parcel && (
          <div className="survey-property-card" style={{ textAlign: 'left' }}>
            <h3>{parcel.situs_address}</h3>
            <div className="survey-detail">
              <span className="survey-label">Survey</span>
              <span>{progress?.survey_complete ? 'Complete' : 'Not started'}</span>
            </div>
            <div className="survey-detail">
              <span className="survey-label">Fire Zone Map</span>
              <span>{progress?.map_complete ? 'Complete' : 'Not started'}</span>
            </div>
          </div>
        )}

        <div className="complete-actions">
          {progress && !progress.map_complete && parcel?.situs_address && (
            <a
              href={`/?address=${encodeURIComponent(parcel.situs_address)}`}
              className="search-button"
              style={{ textDecoration: 'none', display: 'inline-block', marginTop: 'var(--space-4)' }}
            >
              View Fire Zones on Map
            </a>
          )}
          {progress && !progress.survey_complete && (
            <a
              href={`/survey/${hashCode}`}
              className="search-button"
              style={{ textDecoration: 'none', display: 'inline-block', marginTop: 'var(--space-4)' }}
            >
              Complete Survey
            </a>
          )}
        </div>

        <p className="flow-description" style={{ marginTop: 'var(--space-8)' }}>
          Together we're building a more fire-resilient Ashland.
        </p>
      </div>
    </div>
  )
}
