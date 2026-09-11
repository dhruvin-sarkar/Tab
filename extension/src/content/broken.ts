/**
 * Which saved rules no longer match anything on the page.
 *
 * Sites rename and restructure their markup, and a selector that matched last
 * week can stop matching without any error. The panel flags such rules rather
 * than letting them fail invisibly (docs/ARCHITECTURE.md § Selector strategy).
 */

import type { SiteRules } from '../core/rules'
import { appliesToPath } from '../core/scope'

/** The one part of a document this module needs, so it can be tested without one. */
export interface Queryable {
  querySelectorAll(selector: string): { readonly length: number }
}

/**
 * An imported selector can pass the rule checks and still be one the browser
 * cannot parse. Such a selector matches nothing, which is what is reported.
 */
export function matchCount(selector: string, root: Queryable): number {
  try {
    return root.querySelectorAll(selector).length
  } catch (error) {
    if (error instanceof DOMException && error.name === 'SyntaxError') return 0
    throw error
  }
}

/**
 * Only rules that apply at the current path are judged: a rule scoped to
 * another path is expected to match nothing here. Disabled rules are judged
 * too, since re-enabling a broken one would do nothing.
 */
export function brokenRuleIds(site: SiteRules, pathname: string, root: Queryable): Set<string> {
  return new Set(
    site.elementRules
      .filter((rule) => appliesToPath(rule, pathname) && matchCount(rule.selector, root) === 0)
      .map((rule) => rule.id),
  )
}
