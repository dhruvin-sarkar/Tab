/**
 * Export and import of saved rules as a JSON file.
 *
 * This is a trust boundary. A theme file can come from a stranger -- it is
 * the fallback path for copying someone else's theme when the dashboard's
 * one-click install is unavailable -- so nothing in a file is believed.
 * Import rebuilds every rule through the same constructors the editor uses,
 * which means an imported rule has passed exactly the checks a locally
 * authored one did.
 *
 * Identifiers are regenerated rather than carried across, so importing a
 * theme alongside existing rules cannot collide with them.
 */

import {
  InvalidRuleError,
  createElementRule,
  createFilterTheme,
  createVariableOverride,
  type ElementRule,
  type FilterTheme,
  type PositionOffset,
  type SiteRules,
  type StyleDeclarations,
  type VariableOverride,
} from './rules'
import { normalizeHostname } from './scope'

const FORMAT = 'tab-theme'
const VERSION = 1

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function requireString(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  if (typeof value !== 'string') {
    throw new InvalidRuleError(`Expected "${key}" to be a string`)
  }
  return value
}

function parseStyles(value: unknown): StyleDeclarations {
  if (!isRecord(value)) {
    throw new InvalidRuleError('Expected "styles" to be an object')
  }

  // A null-prototype accumulator so that a "__proto__" key becomes an ordinary
  // own property and is rejected by the allowlist, rather than hitting the
  // prototype setter and being silently discarded.
  const styles: Record<string, string> = Object.create(null)
  for (const [property, declared] of Object.entries(value)) {
    if (typeof declared !== 'string') {
      throw new InvalidRuleError(`Expected a string value for ${property}`)
    }
    styles[property] = declared
  }

  // createElementRule rejects any property not on the allowlist, so the cast
  // narrows a shape that is about to be checked rather than asserting one.
  return styles as StyleDeclarations
}

function parsePosition(value: unknown): PositionOffset | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    throw new InvalidRuleError('Expected "position" to be an object')
  }

  const { dx, dy } = value
  if (typeof dx !== 'number' || typeof dy !== 'number') {
    throw new InvalidRuleError('Expected "position" to hold numeric dx and dy')
  }

  return { dx, dy }
}

function parseElementRule(value: unknown): ElementRule {
  if (!isRecord(value)) {
    throw new InvalidRuleError('Expected a rule object')
  }

  const pathPrefix = value['pathPrefix']
  if (pathPrefix !== undefined && typeof pathPrefix !== 'string') {
    throw new InvalidRuleError('Expected "pathPrefix" to be a string')
  }

  const position = parsePosition(value['position'])

  return createElementRule({
    selector: requireString(value, 'selector'),
    styles: parseStyles(value['styles']),
    enabled: value['enabled'] !== false,
    ...(pathPrefix === undefined ? {} : { pathPrefix }),
    ...(position === undefined ? {} : { position }),
  })
}

function parseVariableOverride(value: unknown): VariableOverride {
  if (!isRecord(value)) {
    throw new InvalidRuleError('Expected a custom property override object')
  }

  return createVariableOverride({
    name: requireString(value, 'name'),
    value: requireString(value, 'value'),
    enabled: value['enabled'] !== false,
  })
}

function parseFilter(value: unknown): FilterTheme | undefined {
  if (value === undefined) return undefined
  if (!isRecord(value)) {
    throw new InvalidRuleError('Expected "filter" to be an object')
  }

  const { invert, brightness, contrast, saturate, sepia } = value
  if (
    typeof invert !== 'boolean' ||
    typeof brightness !== 'number' ||
    typeof contrast !== 'number' ||
    typeof saturate !== 'number' ||
    typeof sepia !== 'number'
  ) {
    throw new InvalidRuleError('Expected "filter" to hold an invert flag and numeric levels')
  }

  return createFilterTheme({ invert, brightness, contrast, saturate, sepia })
}

function parseArray(value: unknown, key: string): unknown[] {
  if (value === undefined) return []
  if (!Array.isArray(value)) {
    throw new InvalidRuleError(`Expected "${key}" to be an array`)
  }
  return value
}

function parseSite(value: unknown): SiteRules {
  if (!isRecord(value)) {
    throw new InvalidRuleError('Expected a site object')
  }

  const hostname = normalizeHostname(requireString(value, 'hostname'))
  if (hostname.length === 0) {
    throw new InvalidRuleError('Site hostname is empty')
  }

  const filter = parseFilter(value['filter'])

  return {
    hostname,
    enabled: value['enabled'] !== false,
    elementRules: parseArray(value['elementRules'], 'elementRules').map(parseElementRule),
    variableOverrides: parseArray(value['variableOverrides'], 'variableOverrides').map(
      parseVariableOverride,
    ),
    ...(filter === undefined ? {} : { filter }),
  }
}

export function exportSites(sites: readonly SiteRules[]): string {
  return `${JSON.stringify({ format: FORMAT, version: VERSION, sites }, null, 2)}\n`
}

export function importSites(json: string): SiteRules[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    throw new InvalidRuleError('File is not valid JSON')
  }

  if (!isRecord(parsed)) {
    throw new InvalidRuleError('File does not contain a theme object')
  }
  if (parsed['format'] !== FORMAT) {
    throw new InvalidRuleError('File is not a Tab theme')
  }
  if (parsed['version'] !== VERSION) {
    throw new InvalidRuleError(`Unsupported theme version: ${String(parsed['version'])}`)
  }

  return parseArray(parsed['sites'], 'sites').map(parseSite)
}
