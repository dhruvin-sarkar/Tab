/**
 * Content script entry. Runs at document_start on every page: applies the
 * saved rules for this hostname straight away, keeps them applied as they
 * change or the route changes, and mounts the editor panel on request.
 */

import { emptySiteRules, type SiteRules } from '../core/rules'
import { normalizeHostname } from '../core/scope'
import { isTogglePanelMessage } from '../messages'
import { createApplier } from './apply'
import { mountPanel, type PanelHandle } from './panel/panel'
import { isSameSite, loadSite, onSiteStored, saveSite } from './storage'

const hostname = normalizeHostname(location.hostname)
const applyRules = createApplier()

let site: SiteRules = emptySiteRules(hostname)
let panel: PanelHandle | null = null

/**
 * This tab's saves, oldest first, until chrome.storage reports each back.
 * Storage reports writes in the order they were made, so a reported value
 * that matches one of these is this tab's own echo, and anything queued
 * before it has been superseded. Comparing against the current state instead
 * would mistake the echo of an earlier save, arriving after a later edit, for
 * a change from elsewhere, and roll the page back.
 */
const unconfirmedSaves: SiteRules[] = []

function show(next: SiteRules): void {
  site = next
  applyRules(site, location.pathname)
}

/** Takes on rules that did not come from this tab's panel. */
function adopt(next: SiteRules): void {
  show(next)
  panel?.replaceSite(next)
}

function closePanel(): void {
  panel?.destroy()
  panel = null
}

function togglePanel(): void {
  if (panel) {
    closePanel()
    return
  }
  panel = mountPanel({
    site,
    onChange: (next) => {
      show(next)
      unconfirmedSaves.push(next)
      void saveSite(next)
    },
    onClose: closePanel,
  })
}

void loadSite(hostname).then(adopt)

onSiteStored(hostname, (stored) => {
  const echoed = unconfirmedSaves.findIndex((saved) => isSameSite(saved, stored))
  if (echoed !== -1) {
    unconfirmedSaves.splice(0, echoed + 1)
    return
  }
  unconfirmedSaves.length = 0
  adopt(stored)
})

// Rules are CSS, so nodes a single-page app renders later are matched by the
// browser without help. Only the path changes which rules apply. Verified in
// Chromium: navigatesuccess reaches the content script's isolated world for a
// history.pushState made by the page.
navigation.addEventListener('navigatesuccess', () => {
  applyRules(site, location.pathname)
  panel?.refresh()
})

chrome.runtime.onMessage.addListener((message: unknown) => {
  if (isTogglePanelMessage(message)) togglePanel()
})
