import { describe, expect, it } from 'vitest'
import { isAllowedProperty, isValidDeclaration, isValidVariableValue } from './properties'

describe('isAllowedProperty', () => {
  it('accepts the properties the editor writes', () => {
    expect(isAllowedProperty('color')).toBe(true)
    expect(isAllowedProperty('margin-left')).toBe(true)
    expect(isAllowedProperty('order')).toBe(true)
  })

  it('rejects properties no editor control produces', () => {
    expect(isAllowedProperty('position')).toBe(false)
    expect(isAllowedProperty('z-index')).toBe(false)
    expect(isAllowedProperty('background-image')).toBe(false)
    expect(isAllowedProperty('content')).toBe(false)
    expect(isAllowedProperty('behavior')).toBe(false)
  })

  it('is not fooled by inherited object properties', () => {
    expect(isAllowedProperty('constructor')).toBe(false)
    expect(isAllowedProperty('__proto__')).toBe(false)
    expect(isAllowedProperty('toString')).toBe(false)
  })
})

describe('colour values', () => {
  it('accepts the forms a colour picker produces', () => {
    for (const value of [
      '#fff',
      '#ffff',
      '#a1b2c3',
      '#a1b2c3ff',
      'rgb(0, 128, 255)',
      'rgba(0 128 255 / 0.5)',
      'hsl(210deg 50% 40%)',
      'oklch(0.7 0.1 200)',
      'transparent',
    ]) {
      expect(isValidDeclaration('color', value), value).toBe(true)
    }
  })

  it('rejects url(), which is the exfiltration vector', () => {
    for (const value of [
      'url(https://evil.example/pixel.png)',
      'rgb(0,0,0) url(https://evil.example)',
      "url('https://evil.example')",
    ]) {
      expect(isValidDeclaration('background-color', value), value).toBe(false)
    }
  })

  it('rejects var(), whose fallback can smuggle arbitrary text', () => {
    expect(isValidDeclaration('color', 'var(--x)')).toBe(false)
    expect(isValidDeclaration('color', 'var(--x, url(https://evil.example))')).toBe(false)
    expect(isValidDeclaration('color', 'rgb(var(--r), 0, 0)')).toBe(false)
  })

  it('rejects values that try to close the declaration and start another', () => {
    for (const value of [
      '#fff; position: fixed',
      '#fff }',
      '#fff } body { display: none',
      'red; background: url(https://evil.example)',
    ]) {
      expect(isValidDeclaration('color', value), value).toBe(false)
    }
  })

  it('rejects named colours it was never taught, rather than guessing', () => {
    expect(isValidDeclaration('color', 'rebeccapurple')).toBe(false)
  })
})

describe('length values', () => {
  it('accepts the units the editor offers', () => {
    for (const value of ['0', '12px', '1.5rem', '100%', '2em', '50vh']) {
      expect(isValidDeclaration('width', value), value).toBe(true)
    }
  })

  it('allows negative margins but not negative padding or size', () => {
    expect(isValidDeclaration('margin-left', '-8px')).toBe(true)
    expect(isValidDeclaration('padding-left', '-8px')).toBe(false)
    expect(isValidDeclaration('width', '-8px')).toBe(false)
    expect(isValidDeclaration('font-size', '-8px')).toBe(false)
  })

  it('bounds magnitude so a theme cannot make a page unusable', () => {
    expect(isValidDeclaration('width', '10000px')).toBe(true)
    expect(isValidDeclaration('width', '10001px')).toBe(false)
    expect(isValidDeclaration('width', '999999px')).toBe(false)
  })

  it('rejects calc() and unitless numbers', () => {
    expect(isValidDeclaration('width', 'calc(100% - 10px)')).toBe(false)
    expect(isValidDeclaration('width', '12')).toBe(false)
    expect(isValidDeclaration('width', 'auto')).toBe(false)
  })
})

describe('display', () => {
  it('only permits hiding', () => {
    expect(isValidDeclaration('display', 'none')).toBe(true)
    expect(isValidDeclaration('display', 'block')).toBe(false)
    expect(isValidDeclaration('display', 'flex')).toBe(false)
  })
})

describe('font-family', () => {
  it('accepts a plain stack', () => {
    expect(isValidDeclaration('font-family', 'Helvetica Neue, Arial, sans-serif')).toBe(true)
    expect(isValidDeclaration('font-family', '"Segoe UI", sans-serif')).toBe(true)
  })

  it('rejects anything that could escape the declaration', () => {
    for (const value of [
      'Arial; background: url(https://evil.example)',
      'Arial} body {display:none',
      'local(Arial)',
      "Arial', sans-serif; x: '",
    ]) {
      expect(isValidDeclaration('font-family', value), value).toBe(false)
    }
  })

  it('bounds stack length', () => {
    expect(isValidDeclaration('font-family', Array(9).fill('Arial').join(', '))).toBe(false)
  })
})

describe('order', () => {
  it('accepts bounded integers', () => {
    expect(isValidDeclaration('order', '0')).toBe(true)
    expect(isValidDeclaration('order', '-3')).toBe(true)
    expect(isValidDeclaration('order', '999')).toBe(true)
    expect(isValidDeclaration('order', '1000')).toBe(false)
    expect(isValidDeclaration('order', '1.5')).toBe(false)
  })
})

describe('isValidVariableValue', () => {
  it('accepts the shapes the variable editor produces', () => {
    expect(isValidVariableValue('#101014')).toBe(true)
    expect(isValidVariableValue('16px')).toBe(true)
    expect(isValidVariableValue('sans-serif')).toBe(true)
  })

  it('holds the no-url/no-var invariant on the variable path too', () => {
    expect(isValidVariableValue('url(https://evil.example)')).toBe(false)
    expect(isValidVariableValue('var(--other)')).toBe(false)
    expect(isValidVariableValue('#fff; --x: url(https://evil.example)')).toBe(false)
  })
})
