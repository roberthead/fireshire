import { render } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import { axeCheck } from './a11y'

describe('axeCheck wiring smoke test', () => {
  it('passes on accessible markup', async () => {
    const { container } = render(<button>Click me</button>)
    expect(await axeCheck(container)).toHaveNoViolations()
  })

  it('fails on an image with no alt', async () => {
    const { container } = render(<img src="x.png" />)
    const results = await axeCheck(container)
    expect(results.violations.length).toBeGreaterThan(0)
  })
})
