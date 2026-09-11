/**
 * Which saved rules apply to the page currently being viewed.
 *
 * Rules are stored per hostname. A rule may additionally narrow itself to a
 * path prefix, for sites where one area wants different treatment from
 * another. Absence of a prefix means the whole hostname, which is the default
 * the editor produces.
 */

/**
 * Hostnames are compared exactly. Treating www.example.com and example.com as
 * the same site would be a guess about the site's structure that is wrong
 * often enough to be worse than predictable behaviour.
 */
export function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase()
}

export function appliesToPath(rule: { readonly pathPrefix?: string }, pathname: string): boolean {
  if (rule.pathPrefix === undefined) return true
  return pathname.startsWith(rule.pathPrefix)
}
