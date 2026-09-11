import { describe, expect, it } from 'vitest'
import { createElementRule, emptySiteRules, type ElementRule, type SiteRules } from '../core/rules'
import { brokenRuleIds, matchCount } from './broken'

/** Stands in for a document holding the given number of matches per selector. */
function pageWith(matches: Record<string, number>) {
  return {
    querySelectorAll(selector: string) {
      if (selector.includes('!!')) {
        throw new DOMException(`'${selector}' is not a valid selector`, 'SyntaxError')
      }
      return { length: matches[selector] ?? 0 }
    },
  }
}

function siteWith(...elementRules: ElementRule[]): SiteRules {
  return { ...emptySiteRules('example.com'), elementRules }
}

describe('brokenRuleIds', () => {
  it('flags a rule whose selector matches nothing', () => {
    const gone = createElementRule({ selector: '.gone', styles: { color: '#fff' } })
    const present = createElementRule({ selector: '.present', styles: { color: '#fff' } })

    expect(brokenRuleIds(siteWith(gone, present), '/', pageWith({ '.present': 2 }))).toEqual(
      new Set([gone.id]),
    )
  })

  it('does not judge a rule scoped to another path', () => {
    const elsewhere = createElementRule({ selector: '.gone', styles: {}, pathPrefix: '/docs' })

    expect(brokenRuleIds(siteWith(elsewhere), '/blog', pageWith({}))).toEqual(new Set())
  })

  it('flags a disabled rule too', () => {
    const off = createElementRule({ selector: '.gone', styles: {}, enabled: false })

    expect(brokenRuleIds(siteWith(off), '/', pageWith({}))).toEqual(new Set([off.id]))
  })
})

describe('matchCount', () => {
  it('counts matches', () => {
    expect(matchCount('.a', pageWith({ '.a': 3 }))).toBe(3)
  })

  it('reports a selector the browser cannot parse as matching nothing', () => {
    expect(matchCount('.a!!', pageWith({}))).toBe(0)
  })

  it('lets any other failure through', () => {
    const failing = {
      querySelectorAll(): never {
        throw new TypeError('document is gone')
      },
    }

    expect(() => matchCount('.a', failing)).toThrow(TypeError)
  })
})
