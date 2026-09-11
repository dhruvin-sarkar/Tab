import { describe, expect, it } from 'vitest'
import { appliesToPath, normalizeHostname } from './scope'

describe('normalizeHostname', () => {
  it('lowercases', () => {
    expect(normalizeHostname('Example.COM')).toBe('example.com')
  })

  it('keeps www distinct, rather than guessing they are the same site', () => {
    expect(normalizeHostname('www.example.com')).not.toBe(normalizeHostname('example.com'))
  })
})

describe('appliesToPath', () => {
  it('applies across the whole hostname when no prefix is set', () => {
    expect(appliesToPath({}, '/anything')).toBe(true)
  })

  it('matches on prefix', () => {
    expect(appliesToPath({ pathPrefix: '/docs' }, '/docs')).toBe(true)
    expect(appliesToPath({ pathPrefix: '/docs' }, '/docs/getting-started')).toBe(true)
    expect(appliesToPath({ pathPrefix: '/docs' }, '/blog')).toBe(false)
    expect(appliesToPath({ pathPrefix: '/docs' }, '/')).toBe(false)
  })
})
