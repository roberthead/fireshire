/**
 * Type augmentation for vitest-axe matchers under vitest 4.
 *
 * vitest-axe ships an `extend-expect` module that augments `Vi.Assertion`,
 * but vitest 4 hosts `Assertion` in `@vitest/expect` (no `Vi` namespace).
 * We augment that interface directly so `expect(result).toHaveNoViolations()`
 * type-checks.
 */

import type { AxeMatchers } from 'vitest-axe/matchers'

declare module '@vitest/expect' {
  // Matchers is vitest's documented user-extension point: Assertion<T>
  // extends Matchers<T>, so adding our methods here propagates everywhere.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type, @typescript-eslint/no-unused-vars
  interface Matchers<T = unknown> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}

export type { AxeMatchers }
