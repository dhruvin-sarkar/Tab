/**
 * Undo/redo for an editing session.
 *
 * A plain snapshot stack. Rule sets for one site are small enough that
 * snapshotting is cheaper to hold correct than a command/inverse-command
 * scheme, and it cannot drift out of sync with the state it describes.
 *
 * History is session-scoped and deliberately not persisted -- reopening the
 * panel starts a fresh timeline.
 */

export interface History<T> {
  readonly past: readonly T[]
  readonly present: T
  readonly future: readonly T[]
}

const MAX_DEPTH = 50

export function createHistory<T>(present: T): History<T> {
  return { past: [], present, future: [] }
}

/**
 * Records a new state. Redo history is discarded, since the timeline has
 * branched.
 */
export function record<T>(history: History<T>, present: T): History<T> {
  const past = [...history.past, history.present].slice(-MAX_DEPTH)
  return { past, present, future: [] }
}

export function canUndo<T>(history: History<T>): boolean {
  return history.past.length > 0
}

export function canRedo<T>(history: History<T>): boolean {
  return history.future.length > 0
}

export function undo<T>(history: History<T>): History<T> {
  const previous = history.past.at(-1)
  if (previous === undefined) return history

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  }
}

export function redo<T>(history: History<T>): History<T> {
  const [next, ...rest] = history.future
  if (next === undefined) return history

  return {
    past: [...history.past, history.present],
    present: next,
    future: rest,
  }
}
