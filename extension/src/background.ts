/**
 * The toolbar button opens the editor on the current tab.
 *
 * The content script already runs on every page to apply saved rules, so this
 * only has to tell it to show its panel. Where no content script can run --
 * chrome:// pages, the Web Store, or a tab that was open before the extension
 * was loaded -- sendMessage rejects and the error surfaces in this worker.
 */

import { TOGGLE_PANEL, type TogglePanelMessage } from './messages'

chrome.action.onClicked.addListener((tab) => {
  if (tab.id === undefined) {
    throw new Error('Toolbar click arrived without a tab id')
  }
  const message: TogglePanelMessage = { type: TOGGLE_PANEL }
  void chrome.tabs.sendMessage(tab.id, message)
})
