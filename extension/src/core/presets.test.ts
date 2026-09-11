import { describe, expect, it } from 'vitest'
import { PRESETS } from './presets'
import { createFilterTheme } from './rules'

describe('PRESETS', () => {
  it('holds only filters that pass the same validation as a user theme', () => {
    for (const preset of PRESETS) {
      expect(() => createFilterTheme(preset.filter), preset.id).not.toThrow()
    }
  })

  it('has unique ids', () => {
    const ids = PRESETS.map((preset) => preset.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
