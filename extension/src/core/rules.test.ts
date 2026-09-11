import { describe, expect, it } from 'vitest'
import { InvalidRuleError, createElementRule, createVariableOverride, emptySiteRules } from './rules'

describe('createElementRule', () => {
  it('builds a rule and defaults it to enabled', () => {
    const rule = createElementRule({ selector: '.title', styles: { color: '#fff' } })

    expect(rule.enabled).toBe(true)
    expect(rule.selector).toBe('.title')
    expect(rule.styles).toEqual({ color: '#fff' })
    expect(rule.id).toMatch(/[0-9a-f-]{36}/)
  })

  it('omits absent optional fields rather than storing undefined', () => {
    const rule = createElementRule({ selector: '.title', styles: {} })

    expect('pathPrefix' in rule).toBe(false)
    expect('position' in rule).toBe(false)
  })

  it('copies styles so later mutation of the draft cannot alter the rule', () => {
    const styles = { color: '#fff' }
    const rule = createElementRule({ selector: '.title', styles })

    styles.color = '#000'

    expect(rule.styles.color).toBe('#fff')
  })

  it('accepts the structural selectors the selector library generates', () => {
    for (const selector of [
      'ul.menu > li:nth-child(3)',
      'main > section:nth-of-type(2) > h2',
      'button:not(.disabled)',
      '[data-testid="send-button"]',
      '#\\31 23',
    ]) {
      expect(() => createElementRule({ selector, styles: {} }), selector).not.toThrow()
    }
  })

  it('rejects a selector that could terminate its own rule block', () => {
    for (const selector of [
      '.title { } body {',
      '.title } body {',
      '.title; x',
      '@import "https://evil.example"',
      '.a /* swallow the rest',
      '.a */ .b',
      '.a\n.b',
    ]) {
      expect(() => createElementRule({ selector, styles: {} }), selector).toThrow(InvalidRuleError)
    }
  })

  it('rejects an empty or oversized selector', () => {
    expect(() => createElementRule({ selector: '', styles: {} })).toThrow(InvalidRuleError)
    expect(() => createElementRule({ selector: 'a'.repeat(501), styles: {} })).toThrow(
      InvalidRuleError,
    )
  })

  it('rejects a property outside the allowlist', () => {
    expect(() =>
      createElementRule({ selector: '.a', styles: { 'z-index': '9999' } as never }),
    ).toThrow(InvalidRuleError)
  })

  it('rejects an allowed property carrying a hostile value', () => {
    expect(() =>
      createElementRule({ selector: '.a', styles: { color: 'url(https://evil.example)' } }),
    ).toThrow(InvalidRuleError)
  })

  it('bounds a drag offset', () => {
    expect(() =>
      createElementRule({ selector: '.a', styles: {}, position: { dx: 5001, dy: 0 } }),
    ).toThrow(InvalidRuleError)
    expect(() =>
      createElementRule({ selector: '.a', styles: {}, position: { dx: Number.NaN, dy: 0 } }),
    ).toThrow(InvalidRuleError)
  })
})

describe('createVariableOverride', () => {
  it('accepts a custom property name and value', () => {
    const override = createVariableOverride({ name: '--bg-primary', value: '#101014' })

    expect(override.name).toBe('--bg-primary')
    expect(override.enabled).toBe(true)
  })

  it('rejects a name that is not a custom property', () => {
    expect(() => createVariableOverride({ name: 'background', value: '#fff' })).toThrow(
      InvalidRuleError,
    )
    expect(() => createVariableOverride({ name: '--a; color: red', value: '#fff' })).toThrow(
      InvalidRuleError,
    )
  })
})

describe('emptySiteRules', () => {
  it('starts enabled with nothing in it', () => {
    expect(emptySiteRules('example.com')).toEqual({
      hostname: 'example.com',
      enabled: true,
      elementRules: [],
      variableOverrides: [],
    })
  })
})
