/** Messages from the service worker to the content script. */

export const TOGGLE_PANEL = 'toggle-panel'

export interface TogglePanelMessage {
  readonly type: typeof TOGGLE_PANEL
}

export function isTogglePanelMessage(message: unknown): message is TogglePanelMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    (message as { readonly type?: unknown }).type === TOGGLE_PANEL
  )
}
