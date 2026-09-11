/**
 * Themes that ship with the extension.
 *
 * A preset is the same structure a user saves; it is simply authored in
 * advance. Presets use the filter mechanism rather than token overrides,
 * because token names are specific to each site and a bundled preset has to
 * work on any of them.
 */

import type { FilterTheme } from './rules'

export interface Preset {
  readonly id: string
  readonly name: string
  readonly filter: FilterTheme
}

export const PRESETS: readonly Preset[] = [
  {
    id: 'dark',
    name: 'Dark',
    filter: { invert: true, brightness: 100, contrast: 95, saturate: 100, sepia: 0 },
  },
  {
    id: 'dim',
    name: 'Dim',
    filter: { invert: false, brightness: 80, contrast: 100, saturate: 90, sepia: 0 },
  },
  {
    id: 'high-contrast',
    name: 'High contrast',
    filter: { invert: false, brightness: 100, contrast: 150, saturate: 110, sepia: 0 },
  },
  {
    id: 'warm',
    name: 'Warm',
    filter: { invert: false, brightness: 100, contrast: 100, saturate: 100, sepia: 30 },
  },
  {
    id: 'grayscale',
    name: 'Grayscale',
    filter: { invert: false, brightness: 100, contrast: 100, saturate: 0, sepia: 0 },
  },
]
