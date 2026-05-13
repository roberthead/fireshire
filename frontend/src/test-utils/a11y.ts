import { axe, type AxeCore } from 'vitest-axe'

// Matcher type augmentation lives in ./vitest-axe.d.ts (picked up via the
// `include: ["src"]` glob in tsconfig); no runtime import needed.

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

export async function axeCheck(container: Element): Promise<AxeCore.AxeResults> {
  return axe(container, {
    runOnly: { type: 'tag', values: WCAG_TAGS },
  })
}
