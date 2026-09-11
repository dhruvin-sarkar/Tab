import { describe, expect, it } from 'vitest'
import { createElementRule, emptySiteRules, type SiteRules } from '../core/rules'
import { isSameSite } from './storage'

function siteWithColor(color: string): SiteRules {
  return {
    ...emptySiteRules('example.com'),
    elementRules: [createElementRule({ id: 'r1', selector: '.a', styles: { color } })],
  }
}

/** The same site with every object's keys sorted, as chrome.storage returns it. */
const storedForm = {
  elementRules: [{ enabled: true, id: 'r1', selector: '.a', styles: { color: '#fff' } }],
  enabled: true,
  hostname: 'example.com',
  variableOverrides: [],
} as SiteRules

describe('isSameSite', () => {
  it('ignores key order', () => {
    expect(isSameSite(siteWithColor('#fff'), storedForm)).toBe(true)
  })

  it('tells different values apart', () => {
    expect(isSameSite(siteWithColor('#000'), storedForm)).toBe(false)
  })

  it('keeps rule order significant', () => {
    const a = createElementRule({ id: 'a', selector: '.a', styles: {} })
    const b = createElementRule({ id: 'b', selector: '.b', styles: {} })
    const site = emptySiteRules('example.com')

    expect(isSameSite({ ...site, elementRules: [a, b] }, { ...site, elementRules: [b, a] })).toBe(false)
  })
})
