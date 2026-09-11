/**
 * Keeps one adopted stylesheet in step with the saved rules.
 *
 * The whole sheet is replaced on every change rather than edited rule by
 * rule, so the page never sees a partly applied state (docs/ARCHITECTURE.md).
 *
 * Verified in Chromium: a sheet adopted from the content script's isolated
 * world at document_start styles the page, and its layered !important
 * declarations win over the page's own unlayered rules.
 */

import type { SiteRules } from '../core/rules'
import { buildStylesheet } from '../core/serialize'

export function createApplier(): (site: SiteRules, pathname: string) => void {
  const sheet = new CSSStyleSheet()
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

  return (site, pathname) => {
    sheet.replaceSync(buildStylesheet(site, pathname))
  }
}
