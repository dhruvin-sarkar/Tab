/**
 * The CSS properties the editor is allowed to write, and what counts as a
 * valid value for each.
 *
 * This table is the security boundary for shared themes. Because rules are
 * stored as structured JSON rather than CSS text (docs/DECISIONS.md),
 * validating a theme authored by a stranger reduces to checking every
 * declaration against this table, instead of parsing arbitrary CSS.
 *
 * Two properties of the table as a whole matter more than any single entry:
 *
 *   - No value kind accepts url(). CSS can exfiltrate page contents through
 *     url() in attribute selectors, so no property here may express one.
 *   - No value kind accepts var(). A var() fallback smuggles arbitrary text
 *     past a naive pattern check -- var(--x, url(evil)) -- and no editor
 *     feature needs it.
 *
 * Both hold by construction: every pattern below rejects parentheses it did
 * not itself open, and the functional-colour pattern permits no nesting.
 */

export type PropertyKind =
  | 'color'
  | 'length'
  | 'font-family'
  | 'font-weight'
  | 'border-style'
  | 'display'
  | 'order'

export interface PropertySpec {
  readonly kind: PropertyKind
  readonly isValidValue: (value: string) => boolean
}

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

/**
 * Permits the modern colour functions with a deliberately narrow inner
 * character set: no parentheses (so nothing can nest a url() or var()), no
 * quotes, no backslash, no semicolon, no braces.
 */
const FUNCTIONAL_COLOR = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[0-9a-zA-Z.,%\/\s+-]+\s*\)$/

function isValidColor(value: string): boolean {
  return value === 'transparent' || HEX_COLOR.test(value) || FUNCTIONAL_COLOR.test(value)
}

const LENGTH_PATTERN = /^(-?)(\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%|vh|vw|ch)$/

/**
 * Bounds the magnitude of any length. A theme cannot phish with a large
 * width, but it can make a page unusable, and no editor control produces
 * anything near this.
 */
const MAX_LENGTH_MAGNITUDE = 10_000

function isValidLength(value: string, allowNegative: boolean): boolean {
  if (value === '0') return true

  const match = LENGTH_PATTERN.exec(value)
  if (!match) return false

  const [, sign, magnitude] = match
  if (sign === '-' && !allowNegative) return false

  return Number(magnitude) <= MAX_LENGTH_MAGNITUDE
}

const FONT_NAME = /^[A-Za-z][A-Za-z0-9 _-]*$/
const QUOTED_FONT_NAME = /^"[A-Za-z][A-Za-z0-9 _-]*"$/
const MAX_FONT_STACK_LENGTH = 8

function isValidFontFamily(value: string): boolean {
  const names = value.split(',').map((name) => name.trim())
  if (names.length > MAX_FONT_STACK_LENGTH) return false

  return names.every((name) => FONT_NAME.test(name) || QUOTED_FONT_NAME.test(name))
}

export const FONT_WEIGHTS: ReadonlySet<string> = new Set([
  'normal',
  'bold',
  'lighter',
  'bolder',
  '100',
  '200',
  '300',
  '400',
  '500',
  '600',
  '700',
  '800',
  '900',
])

export const BORDER_STYLES: ReadonlySet<string> = new Set(['none', 'solid', 'dashed', 'dotted', 'double'])

const MAX_ORDER = 999

function isValidOrder(value: string): boolean {
  if (!/^-?\d+$/.test(value)) return false
  return Math.abs(Number(value)) <= MAX_ORDER
}

const color: PropertySpec = { kind: 'color', isValidValue: isValidColor }

function length(allowNegative: boolean): PropertySpec {
  return { kind: 'length', isValidValue: (value) => isValidLength(value, allowNegative) }
}

/**
 * Only display:none is allowed. The element-hide control is the single
 * feature that writes this property, and permitting arbitrary display values
 * would let a theme silently restructure a page's layout.
 */
const display: PropertySpec = { kind: 'display', isValidValue: (value) => value === 'none' }

export const ALLOWED_PROPERTIES = {
  'color': color,
  'background-color': color,
  'border-color': color,
  'border-style': { kind: 'border-style', isValidValue: (value) => BORDER_STYLES.has(value) },
  'border-width': length(false),
  'border-radius': length(false),
  'font-family': { kind: 'font-family', isValidValue: isValidFontFamily },
  'font-size': length(false),
  'font-weight': { kind: 'font-weight', isValidValue: (value) => FONT_WEIGHTS.has(value) },
  'margin-top': length(true),
  'margin-right': length(true),
  'margin-bottom': length(true),
  'margin-left': length(true),
  'padding-top': length(false),
  'padding-right': length(false),
  'padding-bottom': length(false),
  'padding-left': length(false),
  'width': length(false),
  'height': length(false),
  'display': display,
  'order': { kind: 'order', isValidValue: isValidOrder },
} as const satisfies Record<string, PropertySpec>

export type AllowedProperty = keyof typeof ALLOWED_PROPERTIES

export function isAllowedProperty(name: string): name is AllowedProperty {
  return Object.hasOwn(ALLOWED_PROPERTIES, name)
}

/**
 * The single check every declaration must pass, whoever authored it.
 */
export function isValidDeclaration(name: string, value: string): boolean {
  return isAllowedProperty(name) && ALLOWED_PROPERTIES[name].isValidValue(value)
}

/**
 * Bare colour channels, as used by the shadcn/Tailwind token pattern where a
 * site writes hsl(var(--x)) or rgb(var(--x) / 0.5). Overriding such a token
 * with a hex colour would produce an invalid colour at every use site, so the
 * editor writes back in the token's own shape.
 */
const HSL_CHANNELS = /^\d+(?:\.\d+)?(?:deg)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/
const RGB_CHANNELS = /^\d{1,3}\s+\d{1,3}\s+\d{1,3}$/

const VARIABLE_NAME = /^--[A-Za-z0-9_-]+$/

export function isValidVariableName(name: string): boolean {
  return VARIABLE_NAME.test(name)
}

/**
 * A CSS custom property can hold any token sequence, including one the site
 * later interpolates into a property this table would never allow. Overrides
 * are therefore restricted to the value shapes the editor itself produces,
 * which keeps the no-url()/no-var() invariant intact across the variable path
 * as well as the per-element one.
 */
export function isValidVariableValue(value: string): boolean {
  return (
    isValidColor(value) ||
    HSL_CHANNELS.test(value) ||
    RGB_CHANNELS.test(value) ||
    isValidLength(value, true) ||
    isValidFontFamily(value)
  )
}
