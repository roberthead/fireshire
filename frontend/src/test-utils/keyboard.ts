import { fireEvent } from '@testing-library/react'

const FOCUSABLE_SELECTOR =
  'button:not([disabled]):not([tabindex="-1"]), input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), a[href]:not([tabindex="-1"]), [tabindex]:not([tabindex="-1"])'

export interface KeyOptions {
  shift?: boolean
  ctrl?: boolean
  alt?: boolean
  meta?: boolean
}

function modifiers(opts: KeyOptions = {}) {
  return {
    shiftKey: !!opts.shift,
    ctrlKey: !!opts.ctrl,
    altKey: !!opts.alt,
    metaKey: !!opts.meta,
  }
}

export function pressKey(key: string, opts: KeyOptions = {}) {
  const target = (document.activeElement ?? document.body) as Element
  fireEvent.keyDown(target, { key, ...modifiers(opts) })

  // Bridge jsdom: browsers map Enter/Space on a focused <button> (or
  // [role="button"]) to a click event natively, but jsdom does not. Mirror
  // that here so tests can drive button activation by keyboard.
  if ((key === 'Enter' || key === ' ' || key === 'Spacebar') && shouldClickOnEnter(target)) {
    fireEvent.click(target)
  }

  fireEvent.keyUp(target, { key, ...modifiers(opts) })
}

function shouldClickOnEnter(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el instanceof HTMLButtonElement) return !el.disabled
  if (el.getAttribute('role') === 'button' && el.getAttribute('aria-disabled') !== 'true') return true
  if (el instanceof HTMLInputElement) {
    const t = el.type.toLowerCase()
    return t === 'submit' || t === 'button'
  }
  return false
}

function focusableElements(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR))
}

export function pressTab(opts: { shift?: boolean } = {}) {
  const direction = opts.shift ? -1 : 1
  const focusables = focusableElements()
  if (focusables.length === 0) return

  const current = document.activeElement as HTMLElement | null
  const idx = current ? focusables.indexOf(current) : -1

  let nextIdx: number
  if (idx === -1) {
    nextIdx = direction === 1 ? 0 : focusables.length - 1
  } else {
    nextIdx = (idx + direction + focusables.length) % focusables.length
  }

  // Fire Tab on the currently focused element first so any onKeyDown handlers
  // that intercept Tab (e.g., combobox listboxes) get a chance to run.
  if (current) {
    fireEvent.keyDown(current, {
      key: 'Tab',
      shiftKey: !!opts.shift,
    })
  }
  focusables[nextIdx].focus()
}

export function typeInto(element: HTMLElement, text: string) {
  const input = element as HTMLInputElement | HTMLTextAreaElement
  fireEvent.change(input, { target: { value: text } })
}
