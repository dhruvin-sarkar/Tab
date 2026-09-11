import { describe, expect, it } from 'vitest'
import { PRESETS } from './presets'
import {
  NEUTRAL_FILTER,
  createElementRule,
  createVariableOverride,
  emptySiteRules,
  type SiteRules,
} from './rules'
import { buildStylesheet } from './serialize'

function siteWith(overrides: Partial<SiteRules>): SiteRules {
  return { ...emptySiteRules('example.com'), ...overrides }
}

/** Wraps expected blocks the way every non-empty stylesheet is wrapped. */
function layered(...lines: string[]): string {
  return `@layer tab-overrides {\n${lines.join('\n')}\n}\n`
}

describe('buildStylesheet', () => {
  it('declares custom property overrides on every element', () => {
    const site = siteWith({
      variableOverrides: [createVariableOverride({ name: '--bg', value: '#101014' })],
    })

    expect(buildStylesheet(site, '/')).toBe(
      layered('  * {', '    --bg: #101014 !important;', '  }'),
    )
  })

  it('emits element declarations sorted, so output is stable', () => {
    const site = siteWith({
      elementRules: [
        createElementRule({
          selector: '.title',
          styles: { 'font-size': '18px', color: '#ffffff' },
        }),
      ],
    })

    expect(buildStylesheet(site, '/')).toBe(
      layered(
        '  .title {',
        '    color: #ffffff !important;',
        '    font-size: 18px !important;',
        '  }',
      ),
    )
  })

  it('renders a drag offset as a transform', () => {
    const site = siteWith({
      elementRules: [
        createElementRule({ selector: '.badge', styles: {}, position: { dx: 10, dy: -5 } }),
      ],
    })

    expect(buildStylesheet(site, '/')).toContain('transform: translate(10px, -5px) !important;')
  })

  it('keeps structural selectors intact', () => {
    const site = siteWith({
      elementRules: [
        createElementRule({ selector: 'ul.menu > li:nth-child(3)', styles: { color: '#fff' } }),
      ],
    })

    expect(buildStylesheet(site, '/')).toContain('  ul.menu > li:nth-child(3) {')
  })

  it('returns nothing when the site is switched off', () => {
    const site = siteWith({
      enabled: false,
      elementRules: [createElementRule({ selector: '.a', styles: { color: '#fff' } })],
    })

    expect(buildStylesheet(site, '/')).toBe('')
  })

  it('skips individually disabled rules but keeps the rest', () => {
    const site = siteWith({
      elementRules: [
        createElementRule({ selector: '.a', styles: { color: '#fff' }, enabled: false }),
        createElementRule({ selector: '.b', styles: { color: '#000' } }),
      ],
    })

    expect(buildStylesheet(site, '/')).toBe(
      layered('  .b {', '    color: #000 !important;', '  }'),
    )
  })

  it('applies a path-scoped rule only under that path', () => {
    const site = siteWith({
      elementRules: [
        createElementRule({ selector: '.a', styles: { color: '#fff' }, pathPrefix: '/docs' }),
      ],
    })

    expect(buildStylesheet(site, '/docs/intro')).toContain('.a {')
    expect(buildStylesheet(site, '/blog')).toBe('')
  })

  it('omits a rule that declares nothing', () => {
    const site = siteWith({ elementRules: [createElementRule({ selector: '.a', styles: {} })] })

    expect(buildStylesheet(site, '/')).toBe('')
  })

  it('renders an inverting filter and turns media back', () => {
    const dark = PRESETS.find((preset) => preset.id === 'dark')
    const site = siteWith({ ...(dark ? { filter: dark.filter } : {}) })

    expect(buildStylesheet(site, '/')).toBe(
      layered(
        '  html {',
        '    filter: invert(1) hue-rotate(180deg) contrast(95%) !important;',
        '  }',
        '',
        '  img, video, canvas, iframe {',
        '    filter: invert(1) hue-rotate(180deg) !important;',
        '  }',
      ),
    )
  })

  it('renders a non-inverting filter without touching media', () => {
    const site = siteWith({ filter: { ...NEUTRAL_FILTER, sepia: 30 } })

    expect(buildStylesheet(site, '/')).toBe(
      layered('  html {', '    filter: sepia(30%) !important;', '  }'),
    )
  })

  it('emits nothing for a neutral filter', () => {
    expect(buildStylesheet(siteWith({ filter: NEUTRAL_FILTER }), '/')).toBe('')
  })

  it('orders filter, then tokens, then element rules, a blank line apart', () => {
    const site = siteWith({
      filter: { ...NEUTRAL_FILTER, brightness: 90 },
      variableOverrides: [createVariableOverride({ name: '--bg', value: '#000' })],
      elementRules: [createElementRule({ selector: '.a', styles: { color: '#fff' } })],
    })

    expect(buildStylesheet(site, '/')).toBe(
      layered(
        '  html {',
        '    filter: brightness(90%) !important;',
        '  }',
        '',
        '  * {',
        '    --bg: #000 !important;',
        '  }',
        '',
        '  .a {',
        '    color: #fff !important;',
        '  }',
      ),
    )
  })
})
