/**
 * Saved rules, one chrome.storage.local entry per hostname.
 *
 * Only this extension writes these entries, and it writes nothing that has not
 * already passed the constructors in core/rules.ts, so stored values are read
 * back as they are. Rules from anywhere else enter through core/transfer.ts.
 */

import { emptySiteRules, type SiteRules } from '../core/rules'
import { normalizeHostname } from '../core/scope'

const KEY_PREFIX = 'site:'

function keyFor(hostname: string): string {
  return `${KEY_PREFIX}${normalizeHostname(hostname)}`
}

export async function loadSite(hostname: string): Promise<SiteRules> {
  const key = keyFor(hostname)
  const stored: Record<string, unknown> = await chrome.storage.local.get(key)
  const site = stored[key] as SiteRules | undefined
  return site ?? emptySiteRules(normalizeHostname(hostname))
}

export async function loadAllSites(): Promise<SiteRules[]> {
  const stored: Record<string, unknown> = await chrome.storage.local.get(null)
  return Object.entries(stored)
    .filter(([key]) => key.startsWith(KEY_PREFIX))
    .map(([, site]) => site as SiteRules)
}

/**
 * Whether two rule sets hold the same rules. chrome.storage hands values back
 * with their object keys sorted, so a site read from storage and the same
 * site as built in memory differ in key order; JSON text compared as-is would
 * report every one of this tab's own saves as a change from elsewhere.
 */
export function isSameSite(a: SiteRules, b: SiteRules): boolean {
  return canonicalJson(a) === canonicalJson(b)
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_key, nested: unknown) =>
    nested !== null && typeof nested === 'object' && !Array.isArray(nested)
      ? Object.fromEntries(Object.entries(nested).sort(([a], [b]) => a.localeCompare(b)))
      : nested,
  )
}

export async function saveSite(site: SiteRules): Promise<void> {
  await chrome.storage.local.set({ [keyFor(site.hostname)]: site })
}

/** Reports every write to this hostname's entry, from any tab -- this one's own saves included. */
export function onSiteStored(hostname: string, listener: (site: SiteRules) => void): void {
  const key = keyFor(hostname)
  chrome.storage.onChanged.addListener((changes, area) => {
    const change = changes[key]
    if (area !== 'local' || change === undefined) return

    const site = change.newValue as SiteRules | undefined
    listener(site ?? emptySiteRules(normalizeHostname(hostname)))
  })
}
