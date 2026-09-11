import { describe, expect, it } from 'vitest'
import { asCssColor, colorFormatOf, formatColor, hexToRgb, rgbToHex, rgbToHsl } from './color'

/** Stands in for CSS.supports, accepting the colour shapes these tests use. */
function supports(_property: string, value: string): boolean {
  return /^(?:#[0-9a-f]{3,8}|(?:rgba?|hsla?|oklch)\(.+\)|red|transparent)$/i.test(value)
}

describe('hex and rgb', () => {
  it('converts both ways', () => {
    expect(hexToRgb('#ff8000')).toEqual([255, 128, 0])
    expect(rgbToHex([255, 128, 0])).toBe('#ff8000')
  })

  it('refuses a hex form the picker never produces', () => {
    expect(() => hexToRgb('#fff')).toThrow()
    expect(() => hexToRgb('red')).toThrow()
  })
})

describe('rgbToHsl', () => {
  it('handles primaries and greys', () => {
    expect(rgbToHsl([255, 0, 0])).toEqual([0, 100, 50])
    expect(rgbToHsl([0, 0, 255])).toEqual([240, 100, 50])
    expect(rgbToHsl([255, 255, 255])).toEqual([0, 0, 100])
    expect(rgbToHsl([128, 128, 128])).toEqual([0, 0, 50.2])
  })
})

describe('formatColor', () => {
  it('writes back in the token shape', () => {
    expect(formatColor('#FF0000', 'color')).toBe('#ff0000')
    expect(formatColor('#ff0000', 'rgb-channels')).toBe('255 0 0')
    expect(formatColor('#ff0000', 'hsl-channels')).toBe('0 100% 50%')
  })
})

describe('colorFormatOf', () => {
  it('recognises ordinary colours', () => {
    expect(colorFormatOf('#101014', supports)).toBe('color')
    expect(colorFormatOf('oklch(0.7 0.1 200)', supports)).toBe('color')
  })

  it('recognises the shadcn hsl-channel pattern', () => {
    expect(colorFormatOf('248.182 52.381% 24.7059%', supports)).toBe('hsl-channels')
  })

  it('reads percent-free channels as rgb, not hsl', () => {
    expect(colorFormatOf('255 255 255', supports)).toBe('rgb-channels')
    expect(colorFormatOf('255, 128, 0', supports)).toBe('rgb-channels')
  })

  it('rejects things that are not colours', () => {
    for (const value of ['', '16px', '1.5', 'var(--x)', 'inherit', 'currentColor', 'Inter']) {
      expect(colorFormatOf(value, supports), value).toBe(null)
    }
  })
})

describe('asCssColor', () => {
  it('wraps channel tokens so a parser can read them', () => {
    expect(asCssColor('0 100% 50%', 'hsl-channels')).toBe('hsl(0 100% 50%)')
    expect(asCssColor('255 0 0', 'rgb-channels')).toBe('rgb(255 0 0)')
    expect(asCssColor('#fff', 'color')).toBe('#fff')
  })
})
