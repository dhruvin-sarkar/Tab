import { describe, expect, it } from 'vitest'
import { canRedo, canUndo, createHistory, record, redo, undo } from './history'

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    const history = createHistory('a')

    expect(history.present).toBe('a')
    expect(canUndo(history)).toBe(false)
    expect(canRedo(history)).toBe(false)
  })

  it('walks backwards and forwards through recorded states', () => {
    const history = record(record(createHistory('a'), 'b'), 'c')

    const back = undo(undo(history))
    expect(back.present).toBe('a')

    const forward = redo(redo(back))
    expect(forward.present).toBe('c')
  })

  it('discards the redo branch once a new state is recorded', () => {
    const history = record(record(createHistory('a'), 'b'), 'c')
    const branched = record(undo(history), 'd')

    expect(branched.present).toBe('d')
    expect(canRedo(branched)).toBe(false)
    expect(undo(branched).present).toBe('b')
  })

  it('is a no-op at either end rather than throwing', () => {
    const history = createHistory('a')

    expect(undo(history)).toBe(history)
    expect(redo(history)).toBe(history)
  })

  it('bounds depth so a long session cannot grow without limit', () => {
    let history = createHistory(0)
    for (let step = 1; step <= 60; step += 1) {
      history = record(history, step)
    }

    expect(history.past.length).toBe(50)
    expect(history.present).toBe(60)
  })
})
