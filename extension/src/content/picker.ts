/**
 * Hover-highlight and click-to-select over the host page.
 *
 * Listeners sit on the window in the capture phase, so the page's own
 * handlers never see the presses that make up a pick. Events from inside the
 * panel pass through untouched, so the panel stays usable while picking.
 */

export interface PickerOptions {
  /** The panel's shadow host; events from inside it are not picks. */
  readonly panelHost: Element
  /** A fixed-position box laid over the element under the pointer. */
  readonly highlight: HTMLElement
  readonly onPick: (element: Element) => void
  readonly onCancel: () => void
}

/** Starts picking, and returns the function that stops it. */
export function startPicker(options: PickerOptions): () => void {
  const { panelHost, highlight } = options
  const capture = { capture: true } as const

  function pageTarget(event: Event): Element | null {
    if (event.composedPath().includes(panelHost)) return null
    return event.target instanceof Element ? event.target : null
  }

  function onPointerMove(event: PointerEvent): void {
    const target = pageTarget(event)
    if (target === null) {
      highlight.style.display = 'none'
      return
    }

    const box = target.getBoundingClientRect()
    Object.assign(highlight.style, {
      display: 'block',
      top: `${box.top}px`,
      left: `${box.left}px`,
      width: `${box.width}px`,
      height: `${box.height}px`,
    })
  }

  function swallow(event: Event): void {
    if (pageTarget(event) === null) return
    event.preventDefault()
    event.stopImmediatePropagation()
  }

  function onClick(event: MouseEvent): void {
    const target = pageTarget(event)
    if (target === null) return

    swallow(event)
    stop()
    options.onPick(target)
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return

    event.preventDefault()
    stop()
    options.onCancel()
  }

  function stop(): void {
    window.removeEventListener('pointermove', onPointerMove, capture)
    window.removeEventListener('pointerdown', swallow, capture)
    window.removeEventListener('pointerup', swallow, capture)
    window.removeEventListener('mousedown', swallow, capture)
    window.removeEventListener('mouseup', swallow, capture)
    window.removeEventListener('click', onClick, capture)
    window.removeEventListener('keydown', onKeyDown, capture)
    highlight.style.display = 'none'
  }

  window.addEventListener('pointermove', onPointerMove, capture)
  window.addEventListener('pointerdown', swallow, capture)
  window.addEventListener('pointerup', swallow, capture)
  window.addEventListener('mousedown', swallow, capture)
  window.addEventListener('mouseup', swallow, capture)
  window.addEventListener('click', onClick, capture)
  window.addEventListener('keydown', onKeyDown, capture)

  return stop
}
