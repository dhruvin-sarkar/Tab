/**
 * The edits the editor makes to a site's rules, as pure functions.
 *
 * Each returns a new SiteRules value and leaves its input untouched, which is
 * what lets history.ts hold plain snapshots.
 */

import type { ElementRule, FilterTheme, SiteRules, VariableOverride } from './rules'

export function withElementRule(site: SiteRules, rule: ElementRule): SiteRules {
  const exists = site.elementRules.some((existing) => existing.id === rule.id)
  return {
    ...site,
    elementRules: exists
      ? site.elementRules.map((existing) => (existing.id === rule.id ? rule : existing))
      : [...site.elementRules, rule],
  }
}

export function withoutElementRule(site: SiteRules, id: string): SiteRules {
  return { ...site, elementRules: site.elementRules.filter((rule) => rule.id !== id) }
}

export function withElementRuleEnabled(site: SiteRules, id: string, enabled: boolean): SiteRules {
  return {
    ...site,
    elementRules: site.elementRules.map((rule) => (rule.id === id ? { ...rule, enabled } : rule)),
  }
}

/** Overrides are keyed by custom property name: a site has one value per token. */
export function withVariableOverride(site: SiteRules, override: VariableOverride): SiteRules {
  const exists = site.variableOverrides.some((existing) => existing.name === override.name)
  return {
    ...site,
    variableOverrides: exists
      ? site.variableOverrides.map((existing) =>
          existing.name === override.name ? override : existing,
        )
      : [...site.variableOverrides, override],
  }
}

export function withoutVariableOverride(site: SiteRules, name: string): SiteRules {
  return {
    ...site,
    variableOverrides: site.variableOverrides.filter((override) => override.name !== name),
  }
}

export function withVariableOverrideEnabled(
  site: SiteRules,
  name: string,
  enabled: boolean,
): SiteRules {
  return {
    ...site,
    variableOverrides: site.variableOverrides.map((override) =>
      override.name === name ? { ...override, enabled } : override,
    ),
  }
}

export function withSiteEnabled(site: SiteRules, enabled: boolean): SiteRules {
  return { ...site, enabled }
}

export function withFilter(site: SiteRules, filter: FilterTheme | undefined): SiteRules {
  const { filter: _previous, ...rest } = site
  return filter === undefined ? rest : { ...rest, filter }
}

/**
 * Folds an imported site into an existing one. Imported element rules are
 * added alongside the existing ones (their identifiers were regenerated on
 * import, so they cannot collide); an imported token override replaces an
 * existing override of the same token; an imported filter replaces the
 * existing filter.
 */
export function mergeSites(existing: SiteRules, incoming: SiteRules): SiteRules {
  let merged: SiteRules = {
    ...existing,
    elementRules: [...existing.elementRules, ...incoming.elementRules],
  }
  for (const override of incoming.variableOverrides) {
    merged = withVariableOverride(merged, override)
  }
  return incoming.filter === undefined ? merged : withFilter(merged, incoming.filter)
}
