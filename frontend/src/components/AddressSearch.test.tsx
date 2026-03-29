import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { AddressSearch } from './AddressSearch'

describe('AddressSearch', () => {
  it('renders the search input and button', () => {
    render(<AddressSearch />)
    expect(screen.getByPlaceholderText('Enter Ashland address...')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument()
  })
})
