import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ApiError,
  type SearchEnvelope,
  type SearchResult,
  type SearchSuggestion,
} from '../lib/api'
import { StatusBanner } from './StatusBanner'

export interface AddressSearchProps<TRaw> {
  searchFn: (address: string) => Promise<SearchEnvelope<TRaw>>
  queryKey: string
  onSelect: (result: SearchResult<TRaw>) => void | Promise<void>
  inputAriaLabel: string
  initialAddress?: string
  placeholder?: string
  submitLabel?: string
  emptyHint?: string
  notFoundMessage?: string
  autoSelectSingle?: boolean
  autoResubmitSuggestions?: boolean
}

const DEFAULT_NOT_FOUND =
  "We couldn't find that address in Ashland. This tool only covers properties within Ashland city limits."

export function AddressSearch<TRaw>({
  searchFn,
  queryKey,
  onSelect,
  inputAriaLabel,
  initialAddress = '',
  placeholder = 'e.g. 455 Siskiyou Blvd',
  submitLabel = 'Search',
  emptyHint,
  notFoundMessage = DEFAULT_NOT_FOUND,
  autoSelectSingle = true,
  autoResubmitSuggestions = true,
}: AddressSearchProps<TRaw>) {
  const [address, setAddress] = useState(initialAddress)
  const [searchAddress, setSearchAddress] = useState(initialAddress)
  const [listDismissed, setListDismissed] = useState(false)
  const autoSelectedRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)

  const ids = useId()
  const inputId = `${ids}-input`
  const errorId = `${ids}-error`
  const suggestionsHeadingId = `${ids}-suggestions-heading`
  const announcerId = `${ids}-announcer`

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: [queryKey, searchAddress],
    queryFn: () => searchFn(searchAddress),
    enabled: searchAddress.length > 0,
  })

  const parcels = useMemo(() => data?.parcels ?? [], [data])
  const suggestions = useMemo(() => data?.suggestions ?? [], [data])

  // Build a polite summary announcement for the live region.
  const summary = useMemo(() => {
    if (isFetching || searchAddress.length === 0) return ''
    if (error) return ''
    if (parcels.length === 0 && suggestions.length === 0) return 'No matches found.'
    if (parcels.length === 0 && suggestions.length > 0) {
      return `No exact match. ${suggestions.length} similar address${suggestions.length === 1 ? '' : 'es'} suggested.`
    }
    if (parcels.length === 1) return '1 property found.'
    return `${parcels.length} properties found.`
  }, [isFetching, error, searchAddress, parcels, suggestions])

  // Auto-select single result (opt-in).
  useEffect(() => {
    if (!autoSelectSingle) return
    if (parcels.length !== 1 || isFetching) return
    const result = parcels[0]
    const key = `${searchAddress}:${result.id}`
    if (autoSelectedRef.current === key) return
    autoSelectedRef.current = key
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing input with fetched data
    setAddress(result.address)
    void onSelect(result)
  }, [autoSelectSingle, parcels, isFetching, searchAddress, onSelect])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (address.trim().length < 2) return
    autoSelectedRef.current = ''
    setListDismissed(false)
    setSearchAddress(address.trim())
  }

  function handleSelect(result: SearchResult<TRaw>) {
    setAddress(result.address)
    setListDismissed(true)
    void onSelect(result)
  }

  function handleSuggestionClick(suggestion: SearchSuggestion) {
    autoSelectedRef.current = ''
    setListDismissed(false)
    setAddress(suggestion.address)
    if (autoResubmitSuggestions) {
      setSearchAddress(suggestion.address)
    } else {
      inputRef.current?.focus()
    }
  }

  const showResults =
    searchAddress.length > 0 && !isFetching && parcels.length > 1 && !listDismissed
  const showSingleAsList =
    !autoSelectSingle && searchAddress.length > 0 && !isFetching && parcels.length === 1 && !listDismissed

  const inputError =
    error instanceof ApiError && error.errorCode === 'network_error'
      ? error.detail
      : error instanceof ApiError && error.errorCode === 'gis_unavailable'
        ? "Ashland's property data source is temporarily unavailable. Please try again shortly."
        : error?.message

  return (
    <div aria-busy={isFetching}>
      <form onSubmit={handleSubmit} className="search-form">
        <label htmlFor={inputId} className="sr-only">
          {inputAriaLabel}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder={placeholder}
          aria-label={inputAriaLabel}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoComplete="street-address"
          className="search-input"
        />
        <button
          type="submit"
          disabled={isFetching || address.trim().length < 2}
          className="search-button"
        >
          {isFetching ? 'Searching...' : submitLabel}
        </button>
      </form>

      {emptyHint && searchAddress.length === 0 && (
        <p className="search-empty-hint">{emptyHint}</p>
      )}

      {/* Visually-hidden polite announcer — receives a short summary string
          only, not the full result list. */}
      <span
        id={announcerId}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {summary}
      </span>

      {error && (
        <div id={errorId} style={{ marginTop: '0.5rem' }}>
          <StatusBanner
            variant="error"
            message={inputError ?? 'Something went wrong.'}
            onRetry={() => refetch()}
          />
        </div>
      )}

      {!isFetching && !error && searchAddress.length > 0 && parcels.length === 0 && suggestions.length === 0 && (
        <div style={{ marginTop: '0.5rem' }}>
          <StatusBanner variant="warning" message={notFoundMessage} />
        </div>
      )}

      {!isFetching && !error && searchAddress.length > 0 && parcels.length === 0 && suggestions.length > 0 && (
        <div role="region" aria-labelledby={suggestionsHeadingId} style={{ marginTop: '0.5rem' }}>
          <p id={suggestionsHeadingId} className="search-results__hint">
            Did you mean…?
          </p>
          <ul className="search-results" aria-label="Suggested addresses">
            {suggestions.slice(0, 5).map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => handleSuggestionClick(s)}
                  className="search-results__item"
                >
                  {s.address}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {(showResults || showSingleAsList) && (
        <ul className="search-results" aria-label="Matching properties">
          {parcels.slice(0, 5).map((result) => (
            <li key={result.id}>
              <button
                type="button"
                onClick={() => handleSelect(result)}
                className="search-results__item"
              >
                <span>{result.address}</span>
                {result.meta && <span className="search-results__meta">{result.meta}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
