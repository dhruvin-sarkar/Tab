/**
 * The rule model.
 *
 * Rules are structured JSON and never raw CSS text -- see docs/DECISIONS.md.
 * Everything in this file exists to keep that guarantee: a value that reaches
 * the stylesheet builder has already been proven to be a known property with
 * a value of a known shape.
 */

import {
  ALLOWED_PROPERTIES,
  isAllowedProperty,
  isValidDeclaration,
  isValidVariableName,
  isValidVariableValue,
  type AllowedProperty,
} from './properties'

export type StyleDeclarations = Partial<Record<AllowedProperty, string>>

/**
 * A free-drag offset, expressed as a displacement rather than a set of CSS
 * properties.
 *
 * Keeping this out of `styles` is what makes the shared-theme security check
 * tractable. A theme can move an element; it cannot construct the
 * position:fixed / inset:0 / z-index:99999 overlay that a general
 * position-property escape hatch would permit, because that construction is
 * not expressible in this type.
 */
export interface PositionOffset {
  readonly dx: number
  readonly dy: number
}

export interface ElementRule {
  readonly id: string
  readonly selector: string
  /**
   * Restricts the rule to a path prefix on the host. Absent means the rule
   * applies across the whole hostname, which is the default.
   */
  readonly pathPrefix?: string
  readonly enabled: boolean
  readonly styles: StyleDeclarations
  readonly position?: PositionOffset
}

export interface VariableOverride {
  readonly id: string
  readonly name: string
  readonly value: string
  readonly enabled: boolean
}

/**
 * A whole-page colour treatment: the theming mechanism for sites that expose
 * no usable custom properties, and what the bundled presets are made of.
 * Stored as bounded numbers rather than a filter string, so it is validated
 * the same way as everything else.
 */
export interface FilterTheme {
  readonly invert: boolean
  /** Percentages, where 100 is unchanged. */
  readonly brightness: number
  readonly contrast: number
  readonly saturate: number
  /** Percentage, where 0 is unchanged. */
  readonly sepia: number
}

export interface SiteRules {
  readonly hostname: string
  readonly enabled: boolean
  readonly elementRules: readonly ElementRule[]
  readonly variableOverrides: readonly VariableOverride[]
  readonly filter?: FilterTheme
}

export const NEUTRAL_FILTER: FilterTheme = {
  invert: false,
  brightness: 100,
  contrast: 100,
  saturate: 100,
  sepia: 0,
}

/** Brightness has a floor so that no theme can black a page out entirely. */
export const FILTER_RANGES = {
  brightness: [30, 150],
  contrast: [50, 200],
  saturate: [0, 200],
  sepia: [0, 100],
} as const

const MAX_POSITION_OFFSET = 5_000
const MAX_SELECTOR_LENGTH = 500

/**
 * A selector is written into the stylesheet verbatim, so it must not be able
 * to end its own rule block and open another -- which takes a brace -- start
 * an at-rule, or comment out the text after it. Parentheses are allowed: they
 * cannot escape a block, and :nth-child() and :not() need them.
 */
const FORBIDDEN_IN_SELECTOR = /[{};@\x00-\x1f]|\/\*|\*\//

export class InvalidRuleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidRuleError'
  }
}

function assertValidSelector(selector: string): void {
  if (selector.trim().length === 0) {
    throw new InvalidRuleError('Selector is empty')
  }
  if (selector.length > MAX_SELECTOR_LENGTH) {
    throw new InvalidRuleError(`Selector exceeds ${MAX_SELECTOR_LENGTH} characters`)
  }
  if (FORBIDDEN_IN_SELECTOR.test(selector)) {
    throw new InvalidRuleError(`Selector contains a forbidden character: ${selector}`)
  }
}

function assertValidStyles(styles: StyleDeclarations): void {
  for (const [name, value] of Object.entries(styles)) {
    if (value === undefined) continue
    if (!isAllowedProperty(name)) {
      throw new InvalidRuleError(`Property is not allowed: ${name}`)
    }
    if (!isValidDeclaration(name, value)) {
      throw new InvalidRuleError(
        `Value is not valid for ${name} (expected ${ALLOWED_PROPERTIES[name].kind}): ${value}`,
      )
    }
  }
}

function assertValidPosition(position: PositionOffset): void {
  for (const axis of [position.dx, position.dy]) {
    if (!Number.isFinite(axis) || Math.abs(axis) > MAX_POSITION_OFFSET) {
      throw new InvalidRuleError(`Position offset is out of range: ${position.dx},${position.dy}`)
    }
  }
}

/**
 * Builds a rule, throwing if any part of it is invalid. Every path that
 * creates a rule -- the editor, a JSON import, a copied theme -- goes through
 * here, so an ElementRule value can be trusted once it exists.
 */
export function createElementRule(draft: {
  selector: string
  styles: StyleDeclarations
  pathPrefix?: string
  position?: PositionOffset
  enabled?: boolean
  id?: string
}): ElementRule {
  assertValidSelector(draft.selector)
  assertValidStyles(draft.styles)
  if (draft.position) assertValidPosition(draft.position)

  return {
    id: draft.id ?? crypto.randomUUID(),
    selector: draft.selector,
    ...(draft.pathPrefix === undefined ? {} : { pathPrefix: draft.pathPrefix }),
    enabled: draft.enabled ?? true,
    styles: { ...draft.styles },
    ...(draft.position === undefined ? {} : { position: { ...draft.position } }),
  }
}

export function createVariableOverride(draft: {
  name: string
  value: string
  enabled?: boolean
  id?: string
}): VariableOverride {
  if (!isValidVariableName(draft.name)) {
    throw new InvalidRuleError(`Custom property name is not valid: ${draft.name}`)
  }
  if (!isValidVariableValue(draft.value)) {
    throw new InvalidRuleError(`Custom property value is not valid: ${draft.value}`)
  }

  return {
    id: draft.id ?? crypto.randomUUID(),
    name: draft.name,
    value: draft.value,
    enabled: draft.enabled ?? true,
  }
}

export function createFilterTheme(draft: FilterTheme): FilterTheme {
  if (typeof draft.invert !== 'boolean') {
    throw new InvalidRuleError('Filter invert must be true or false')
  }
  for (const [level, [min, max]] of Object.entries(FILTER_RANGES)) {
    const value = draft[level as keyof typeof FILTER_RANGES]
    if (!Number.isFinite(value) || value < min || value > max) {
      throw new InvalidRuleError(`Filter ${level} is out of range: ${value}`)
    }
  }

  return {
    invert: draft.invert,
    brightness: draft.brightness,
    contrast: draft.contrast,
    saturate: draft.saturate,
    sepia: draft.sepia,
  }
}

export function emptySiteRules(hostname: string): SiteRules {
  return { hostname, enabled: true, elementRules: [], variableOverrides: [] }
}
