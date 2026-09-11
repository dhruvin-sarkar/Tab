import { describe, expect, it } from 'vitest'
import { isHashLikeClass, stableClassNames } from './selector-safety'

describe('isHashLikeClass', () => {
  it('flags known build-tool output', () => {
    for (const className of [
      'sc-bdVaJa',
      'css-1x2y3z',
      'jsx-1234567',
      '_ngcontent-abc-c123',
      'Button_root__2xY3f',
      'a1b2c3',
      'x7f9k2',
    ]) {
      expect(isHashLikeClass(className), className).toBe(true)
    }
  })

  it('keeps authored semantic names, which the literal doc regex would have discarded', () => {
    for (const className of [
      'button',
      'header',
      'navbar',
      'footer',
      'title',
      'container',
      'sidebar',
      'text-sm',
      'btn-primary',
      'nav',
      'h1',
    ]) {
      expect(isHashLikeClass(className), className).toBe(false)
    }
  })
})

describe('stableClassNames', () => {
  it('keeps only the names worth building a selector from', () => {
    expect(stableClassNames(['header', 'css-1x2y3z', 'nav-item'])).toEqual(['header', 'nav-item'])
  })
})
