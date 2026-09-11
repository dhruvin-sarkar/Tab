/**
 * Turns saved rules into the stylesheet that gets applied to the page.
 *
 * Interpolating selectors and values straight into CSS text is safe here for
 * one specific reason: every value has already passed the allowlist in
 * properties.ts, and every selector has already been rejected if it contains
 * anything that could end a rule block. Nothing unvalidated reaches this file.
 * If that ever stops being true, this is the file that becomes a CSS
 * injection vector.
 *
 * The same output serves the "copy as raw CSS" export, which is why it is
 * formatted for a human to read.
 */

import type { ElementRule, FilterTheme, SiteRules, VariableOverride } from './rules'
import { appliesToPath } from './scope'

/**
 * Every declaration is !important, and every rule sits inside this layer.
 *
 * Importance beats specificity, which the page's own rules usually have more
 * of. The layer covers the case importance alone cannot: a site rule that is
 * itself !important. For important declarations the cascade reverses layer
 * order and ranks unlayered styles below every layer, so an important
 * declaration in any layer outranks an important unlayered one whatever its
 * specificity. Only inline !important styles, and a site's own layered
 * !important rules, stay out of reach.
 */
export const LAYER_NAME = 'tab-overrides'

/** Media is inverted back so photographs and video keep their real colours. */
const INVERT = 'invert(1) hue-rotate(180deg)'
const MEDIA_SELECTOR = 'img, video, canvas, iframe'

function declaration(property: string, value: string): string {
  return `  ${property}: ${value} !important;`
}

function block(selector: string, declarations: readonly string[]): string {
  return `${selector} {\n${declarations.join('\n')}\n}`
}

function filterValue(filter: FilterTheme): string {
  const parts: string[] = []
  if (filter.invert) parts.push(INVERT)
  if (filter.brightness !== 100) parts.push(`brightness(${filter.brightness}%)`)
  if (filter.contrast !== 100) parts.push(`contrast(${filter.contrast}%)`)
  if (filter.saturate !== 100) parts.push(`saturate(${filter.saturate}%)`)
  if (filter.sepia !== 0) parts.push(`sepia(${filter.sepia}%)`)
  return parts.join(' ')
}

function filterBlocks(filter: FilterTheme): string[] {
  const value = filterValue(filter)
  if (value === '') return []

  const blocks = [block('html', [declaration('filter', value)])]
  if (filter.invert) {
    blocks.push(block(MEDIA_SELECTOR, [declaration('filter', INVERT)]))
  }
  return blocks
}

/**
 * Custom property overrides are declared on every element, not only on :root.
 *
 * Sites commonly re-declare their tokens on a wrapper -- claude.ai does so on
 * .cds-root for most of them -- and a descendant inherits from its nearest
 * declaration, so no selector aimed at the root reaches past that wrapper.
 * The accepted cost is that a site's deliberate local re-declaration of the
 * same token is flattened as well; see docs/DECISIONS.md.
 */
function variableBlock(overrides: readonly VariableOverride[]): string {
  const declarations = [...overrides]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((override) => declaration(override.name, override.value))

  return block('*', declarations)
}

function elementDeclarations(rule: ElementRule): string[] {
  const declarations = Object.entries(rule.styles)
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([property, value]) => declaration(property, value))

  if (rule.position) {
    declarations.push(
      declaration('transform', `translate(${rule.position.dx}px, ${rule.position.dy}px)`),
    )
  }

  return declarations
}

function indent(text: string): string {
  return text
    .split('\n')
    .map((line) => (line === '' ? line : `  ${line}`))
    .join('\n')
}

/**
 * Builds the complete stylesheet for one site at one path, or an empty string
 * when nothing applies.
 */
export function buildStylesheet(site: SiteRules, pathname: string): string {
  if (!site.enabled) return ''

  const blocks: string[] = []

  if (site.filter) {
    blocks.push(...filterBlocks(site.filter))
  }

  const variables = site.variableOverrides.filter((override) => override.enabled)
  if (variables.length > 0) {
    blocks.push(variableBlock(variables))
  }

  for (const rule of site.elementRules) {
    if (!rule.enabled) continue
    if (!appliesToPath(rule, pathname)) continue

    const declarations = elementDeclarations(rule)
    if (declarations.length === 0) continue

    blocks.push(block(rule.selector, declarations))
  }

  if (blocks.length === 0) return ''

  return `@layer ${LAYER_NAME} {\n${indent(blocks.join('\n\n'))}\n}\n`
}
