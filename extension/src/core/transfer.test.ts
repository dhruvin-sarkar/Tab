import { describe, expect, it } from 'vitest'
import { InvalidRuleError, createElementRule, createVariableOverride, emptySiteRules } from './rules'
import { exportSites, importSites } from './transfer'

const site = {
  ...emptySiteRules('example.com'),
  elementRules: [
    createElementRule({ selector: '.title', styles: { color: '#ffffff' }, pathPrefix: '/docs' }),
  ],
  variableOverrides: [createVariableOverride({ name: '--bg', value: '#101014' })],
}

describe('round trip', () => {
  it('preserves everything except identifiers', () => {
    const [imported] = importSites(exportSites([site]))

    expect(imported?.hostname).toBe('example.com')
    expect(imported?.elementRules[0]?.selector).toBe('.title')
    expect(imported?.elementRules[0]?.styles).toEqual({ color: '#ffffff' })
    expect(imported?.elementRules[0]?.pathPrefix).toBe('/docs')
    expect(imported?.variableOverrides[0]?.name).toBe('--bg')
  })

  it('regenerates identifiers so an import cannot collide with existing rules', () => {
    const [imported] = importSites(exportSites([site]))

    expect(imported?.elementRules[0]?.id).not.toBe(site.elementRules[0]?.id)
  })
})

describe('importSites rejects a hostile file', () => {
  function theme(sites: unknown): string {
    return JSON.stringify({ format: 'tab-theme', version: 1, sites })
  }

  it('rejects malformed input', () => {
    expect(() => importSites('not json')).toThrow(InvalidRuleError)
    expect(() => importSites('[]')).toThrow(InvalidRuleError)
    expect(() => importSites(JSON.stringify({ format: 'other', version: 1 }))).toThrow(
      InvalidRuleError,
    )
    expect(() => importSites(JSON.stringify({ format: 'tab-theme', version: 99 }))).toThrow(
      InvalidRuleError,
    )
  })

  it('rejects a property outside the allowlist', () => {
    const hostile = theme([
      { hostname: 'a.com', elementRules: [{ selector: '.a', styles: { 'z-index': '99999' } }] },
    ])

    expect(() => importSites(hostile)).toThrow(/not allowed/)
  })

  it('rejects a url() smuggled into an allowed property', () => {
    const hostile = theme([
      {
        hostname: 'a.com',
        elementRules: [{ selector: '.a', styles: { color: 'url(https://evil.example)' } }],
      },
    ])

    expect(() => importSites(hostile)).toThrow(InvalidRuleError)
  })

  it('rejects a selector that would break out of its rule block', () => {
    const hostile = theme([
      {
        hostname: 'a.com',
        elementRules: [{ selector: '.a { } html { display: none', styles: { color: '#fff' } }],
      },
    ])

    expect(() => importSites(hostile)).toThrow(InvalidRuleError)
  })

  it('rejects rather than silently drops a __proto__ declaration', () => {
    const hostile =
      '{"format":"tab-theme","version":1,"sites":[{"hostname":"a.com",' +
      '"elementRules":[{"selector":".a","styles":{"__proto__":"red"}}]}]}'

    expect(() => importSites(hostile)).toThrow(InvalidRuleError)
  })

  it('rejects a non-string declaration value', () => {
    const hostile = theme([
      { hostname: 'a.com', elementRules: [{ selector: '.a', styles: { color: 12 } }] },
    ])

    expect(() => importSites(hostile)).toThrow(InvalidRuleError)
  })

  it('rejects a site with no hostname', () => {
    expect(() => importSites(theme([{ elementRules: [] }]))).toThrow(InvalidRuleError)
    expect(() => importSites(theme([{ hostname: '' }]))).toThrow(InvalidRuleError)
  })
})
