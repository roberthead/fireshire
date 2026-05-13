import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { pressKey, pressTab, typeInto } from './keyboard'

describe('keyboard helpers', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('pressTab', () => {
    it('cycles focus forward across focusable elements in document order', () => {
      render(
        <>
          <button>One</button>
          <button>Two</button>
          <button>Three</button>
        </>,
      )
      const [one, two, three] = ['One', 'Two', 'Three'].map((t) =>
        screen.getByText(t),
      )

      one.focus()
      expect(document.activeElement).toBe(one)

      pressTab()
      expect(document.activeElement).toBe(two)

      pressTab()
      expect(document.activeElement).toBe(three)

      // Wraps to the start
      pressTab()
      expect(document.activeElement).toBe(one)
    })

    it('cycles focus backward when shift=true', () => {
      render(
        <>
          <button>One</button>
          <button>Two</button>
          <button>Three</button>
        </>,
      )
      const [one, , three] = ['One', 'Two', 'Three'].map((t) =>
        screen.getByText(t),
      )
      one.focus()

      pressTab({ shift: true })
      expect(document.activeElement).toBe(three)
    })

    it('skips elements with tabindex="-1"', () => {
      render(
        <>
          <button>One</button>
          <button tabIndex={-1}>Skip</button>
          <button>Two</button>
        </>,
      )
      const one = screen.getByText('One')
      const two = screen.getByText('Two')
      one.focus()

      pressTab()
      expect(document.activeElement).toBe(two)
    })

    it('skips disabled elements', () => {
      render(
        <>
          <button>One</button>
          <button disabled>Disabled</button>
          <button>Two</button>
        </>,
      )
      const one = screen.getByText('One')
      const two = screen.getByText('Two')
      one.focus()

      pressTab()
      expect(document.activeElement).toBe(two)
    })

    it('fires a Tab keydown on the current element so handlers can intercept', () => {
      const handler = vi.fn()
      render(
        <>
          <button onKeyDown={handler}>One</button>
          <button>Two</button>
        </>,
      )
      const one = screen.getByText('One')
      one.focus()

      pressTab()
      expect(handler).toHaveBeenCalled()
      expect(handler.mock.calls[0][0].key).toBe('Tab')
    })
  })

  describe('pressKey', () => {
    it('fires keyDown and keyUp on the active element', () => {
      const onKeyDown = vi.fn()
      const onKeyUp = vi.fn()
      render(<button onKeyDown={onKeyDown} onKeyUp={onKeyUp}>Btn</button>)
      screen.getByText('Btn').focus()

      pressKey('Enter')
      expect(onKeyDown).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
      expect(onKeyUp).toHaveBeenCalledWith(expect.objectContaining({ key: 'Enter' }))
    })

    it('forwards modifier keys', () => {
      const onKeyDown = vi.fn()
      render(<button onKeyDown={onKeyDown}>Btn</button>)
      screen.getByText('Btn').focus()

      pressKey('z', { alt: true })
      expect(onKeyDown.mock.calls[0][0].altKey).toBe(true)
    })
  })

  describe('typeInto', () => {
    it('dispatches a change event with the new value', () => {
      const onChange = vi.fn()
      render(<input aria-label="search" onChange={onChange} />)
      const input = screen.getByLabelText('search') as HTMLInputElement

      typeInto(input, 'rosem')
      expect(onChange).toHaveBeenCalled()
      expect(input.value).toBe('rosem')
    })
  })
})
