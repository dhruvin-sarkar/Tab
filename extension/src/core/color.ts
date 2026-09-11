/**
 * Conversions between the colour shapes the editor reads and writes.
 *
 * A colour picker yields #rrggbb. A site's token may instead hold bare
 * channels meant to be wrapped at the use site -- hsl(var(--x)) or
 * rgb(var(--x)) -- so a picked colour is written back in whichever shape the
 * token already uses.
 */

export type ColorFormat = 'color' | 'hsl-channels' | 'rgb-channels'

export type Rgb = readonly [number, number, number]

const HEX = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i

export function hexToRgb(hex: string): Rgb {
  const match = HEX.exec(hex)
  if (!match) {
    throw new Error(`Not a six-digit hex colour: ${hex}`)
  }
  const [, r = '', g = '', b = ''] = match
  return [Number.parseInt(r, 16), Number.parseInt(g, 16), Number.parseInt(b, 16)]
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`
}

function roundToTenth(value: number): number {
  return Math.round(value * 10) / 10
}

/** Hue in degrees; saturation and lightness as percentages. */
export function rgbToHsl([r, g, b]: Rgb): readonly [number, number, number] {
  const red = r / 255
  const green = g / 255
  const blue = b / 255
  const max = Math.max(red, green, blue)
  const min = Math.min(red, green, blue)
  const lightness = (max + min) / 2

  if (max === min) {
    return [0, 0, roundToTenth(lightness * 100)]
  }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)

  let hue: number
  if (max === red) {
    hue = (green - blue) / delta + (green < blue ? 6 : 0)
  } else if (max === green) {
    hue = (blue - red) / delta + 2
  } else {
    hue = (red - green) / delta + 4
  }

  return [roundToTenth(hue * 60), roundToTenth(saturation * 100), roundToTenth(lightness * 100)]
}

/** Writes a picked colour in the shape the target token already uses. */
export function formatColor(hex: string, format: ColorFormat): string {
  if (format === 'color') return hex.toLowerCase()

  const rgb = hexToRgb(hex)
  if (format === 'rgb-channels') return rgb.join(' ')

  const [hue, saturation, lightness] = rgbToHsl(rgb)
  return `${hue} ${saturation}% ${lightness}%`
}

const RGB_CHANNEL_VALUE = /^\d+(?:\.\d+)?(?:\s*,\s*|\s+)\d+(?:\.\d+)?(?:\s*,\s*|\s+)\d+(?:\.\d+)?$/

const NON_COLOR_KEYWORDS = /^(?:inherit|initial|unset|revert|revert-layer|currentcolor)$/i

/**
 * Identifies which colour shape a token's value is in, or null if it is not a
 * colour. `supports` is CSS.supports in the browser; it is a parameter so this
 * stays testable without one.
 *
 * Bare channels are split on the presence of a percent sign rather than on
 * what CSS.supports accepts, because modern syntax lets rgb() and hsl() each
 * accept either shape, and "255 255 255" would pass as a valid hsl().
 */
export function colorFormatOf(
  value: string,
  supports: (property: string, value: string) => boolean,
): ColorFormat | null {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed.includes('var(')) return null
  if (NON_COLOR_KEYWORDS.test(trimmed)) return null

  if (supports('color', trimmed)) return 'color'
  if (trimmed.includes('%')) {
    return supports('color', `hsl(${trimmed})`) ? 'hsl-channels' : null
  }
  if (RGB_CHANNEL_VALUE.test(trimmed)) {
    return supports('color', `rgb(${trimmed})`) ? 'rgb-channels' : null
  }
  return null
}

/** The value to hand a colour parser, for a token of the given shape. */
export function asCssColor(value: string, format: ColorFormat): string {
  if (format === 'hsl-channels') return `hsl(${value})`
  if (format === 'rgb-channels') return `rgb(${value})`
  return value
}
