/**
 * Browser APIs the content script uses that TypeScript's DOM library does not
 * declare. Both were verified present in the content script's isolated world
 * in Chromium, navigatesuccess included.
 */

interface ColorSelectionResult {
  readonly sRGBHex: string
}

interface EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<ColorSelectionResult>
}

declare var EyeDropper: {
  prototype: EyeDropper
  new (): EyeDropper
}

interface Navigation extends EventTarget {}

declare var navigation: Navigation
