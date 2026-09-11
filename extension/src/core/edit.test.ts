import { describe, expect, it } from 'vitest'
import {
  mergeSites,
  withElementRule,
  withElementRuleEnabled,
  withFilter,
  withSiteEnabled,
  withVariableOverride,
  withVariableOverrideEnabled,
  withoutElementRule,
  withoutVariableOverride,
} from './edit'
import {
  NEUTRAL_FILTER,
  createElementRule,
  createVariableOverride,
  emptySiteRules,
  type SiteRules,
} from './rules'

const ruleA = createElementRule({ selector: '.a', styles: { color: '#fff' } })
const ruleB = createElementRule({ selector: '.b', styles: { color: '#000' } })

function site(overrides: Partial<SiteRules> = {}): SiteRules {
  return { ...emptySiteRules('example.com'), ...overrides }
}

describe('element rules', () => {
  it('appends a new rule and replaces an existing one by id', () => {
    const one = withElementRule(site(), ruleA)
    expect(one.elementRules).toEqual([ruleA])

    const edited = createElementRule({ id: ruleA.id, selector: '.a', styles: { color: '#111' } })
    const replaced = withElementRule(withElementRule(one, ruleB), edited)
    expect(replaced.elementRules.map((rule) => rule.styles.color)).toEqual(['#111', '#000'])
  })

  it('removes and toggles by id', () => {
    const both = site({ elementRules: [ruleA, ruleB] })

    expect(withoutElementRule(both, ruleA.id).elementRules).toEqual([ruleB])
    expect(withElementRuleEnabled(both, ruleB.id, false).elementRules[1]?.enabled).toBe(false)
  })

  it('leaves its input untouched', () => {
    const original = site({ elementRules: [ruleA] })
    withElementRule(original, ruleB)
    withElementRuleEnabled(original, ruleA.id, false)

    expect(original.elementRules).toEqual([ruleA])
  })
})

describe('variable overrides', () => {
  it('keeps one override per token name', () => {
    const first = createVariableOverride({ name: '--bg', value: '#000' })
    const second = createVariableOverride({ name: '--bg', value: '#111' })

    const result = withVariableOverride(withVariableOverride(site(), first), second)

    expect(result.variableOverrides).toHaveLength(1)
    expect(result.variableOverrides[0]?.value).toBe('#111')
  })

  it('removes and toggles by name', () => {
    const override = createVariableOverride({ name: '--bg', value: '#000' })
    const withIt = site({ variableOverrides: [override] })

    expect(withoutVariableOverride(withIt, '--bg').variableOverrides).toEqual([])
    expect(withVariableOverrideEnabled(withIt, '--bg', false).variableOverrides[0]?.enabled).toBe(
      false,
    )
  })
})

describe('site-wide state', () => {
  it('toggles the whole site', () => {
    expect(withSiteEnabled(site(), false).enabled).toBe(false)
  })

  it('sets and clears the filter, leaving no undefined key behind', () => {
    const filtered = withFilter(site(), NEUTRAL_FILTER)
    expect(filtered.filter).toEqual(NEUTRAL_FILTER)

    const cleared = withFilter(filtered, undefined)
    expect('filter' in cleared).toBe(false)
  })
})

describe('mergeSites', () => {
  it('adds imported rules, replaces same-name tokens, and takes the imported filter', () => {
    const existing = site({
      elementRules: [ruleA],
      variableOverrides: [
        createVariableOverride({ name: '--bg', value: '#000' }),
        createVariableOverride({ name: '--fg', value: '#fff' }),
      ],
    })
    const incoming = site({
      elementRules: [ruleB],
      variableOverrides: [createVariableOverride({ name: '--bg', value: '#222' })],
      filter: { ...NEUTRAL_FILTER, sepia: 30 },
    })

    const merged = mergeSites(existing, incoming)

    expect(merged.elementRules).toEqual([ruleA, ruleB])
    expect(merged.variableOverrides.map((override) => override.value)).toEqual(['#222', '#fff'])
    expect(merged.filter?.sepia).toBe(30)
  })
})
