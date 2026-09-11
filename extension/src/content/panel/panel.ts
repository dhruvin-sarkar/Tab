/**
 * The editor panel.
 *
 * Mounted in a closed shadow root, so page CSS cannot reach it and its CSS
 * cannot reach the page (docs/DECISIONS.md). The shadow host is a manual
 * popover, which puts it in the top layer above any z-index the page uses,
 * and is a custom tag, so page rules written against div and friends miss it.
 *
 * There is no UI framework. Every change re-renders the panel body from
 * state, which at this size is simpler than diffing and quick enough.
 */

import {
  mergeSites,
  withElementRule,
  withElementRuleEnabled,
  withFilter,
  withSiteEnabled,
  withVariableOverrideEnabled,
  withoutElementRule,
  withoutVariableOverride,
} from '../../core/edit'
import { canRedo, canUndo, createHistory, record, redo, undo, type History } from '../../core/history'
import { PRESETS } from '../../core/presets'
import {
  ALLOWED_PROPERTIES,
  BORDER_STYLES,
  FONT_WEIGHTS,
  type AllowedProperty,
} from '../../core/properties'
import {
  InvalidRuleError,
  createElementRule,
  type ElementRule,
  type FilterTheme,
  type SiteRules,
} from '../../core/rules'
import { buildStylesheet } from '../../core/serialize'
import { exportSites, importSites } from '../../core/transfer'
import { brokenRuleIds, matchCount } from '../broken'
import { startPicker } from '../picker'
import { selectorFor } from '../selector'
import { loadAllSites, loadSite, saveSite } from '../storage'
import { button, checkbox, h } from './dom'
import { PANEL_CSS } from './styles'

export interface PanelOptions {
  readonly site: SiteRules
  /** Receives every state the panel produces, to apply and save it. */
  readonly onChange: (site: SiteRules) => void
  readonly onClose: () => void
}

export interface PanelHandle {
  /** Adopts a change made outside the panel. The undo timeline restarts. */
  replaceSite(site: SiteRules): void
  /** Re-renders against the current page, after a route change. */
  refresh(): void
  destroy(): void
}

interface Selection {
  readonly selector: string
  /** Absent until the selection has a saved rule. */
  readonly ruleId?: string
}

interface Notice {
  readonly kind: 'error' | 'info'
  readonly text: string
}

type RuleDraft = Parameters<typeof createElementRule>[0]

const GROUPS: readonly { readonly legend: string; readonly properties: readonly AllowedProperty[] }[] = [
  { legend: 'Colour', properties: ['color', 'background-color'] },
  { legend: 'Border', properties: ['border-color', 'border-style', 'border-width', 'border-radius'] },
  { legend: 'Text', properties: ['font-family', 'font-size', 'font-weight'] },
  { legend: 'Margin', properties: ['margin-top', 'margin-right', 'margin-bottom', 'margin-left'] },
  { legend: 'Padding', properties: ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'] },
  { legend: 'Size', properties: ['width', 'height'] },
  { legend: 'Layout', properties: ['order', 'display'] },
]

const LABELS: Readonly<Record<AllowedProperty, string>> = {
  'color': 'Text',
  'background-color': 'Background',
  'border-color': 'Colour',
  'border-style': 'Style',
  'border-width': 'Width',
  'border-radius': 'Radius',
  'font-family': 'Font',
  'font-size': 'Size',
  'font-weight': 'Weight',
  'margin-top': 'Top',
  'margin-right': 'Right',
  'margin-bottom': 'Bottom',
  'margin-left': 'Left',
  'padding-top': 'Top',
  'padding-right': 'Right',
  'padding-bottom': 'Bottom',
  'padding-left': 'Left',
  'width': 'Width',
  'height': 'Height',
  'order': 'Order',
  'display': 'Visibility',
}

/** Inline and important, so no page rule can move, hide or restyle the host. */
const HOST_STYLE = ['all: initial', 'position: fixed', 'inset: 0', 'pointer-events: none']
  .map((declaration) => `${declaration} !important;`)
  .join(' ')

const SIX_DIGIT_HEX = /^#[0-9a-f]{6}$/i

function draftFrom(rule: ElementRule): RuleDraft {
  return {
    id: rule.id,
    selector: rule.selector,
    styles: rule.styles,
    enabled: rule.enabled,
    ...(rule.pathPrefix === undefined ? {} : { pathPrefix: rule.pathPrefix }),
    ...(rule.position === undefined ? {} : { position: rule.position }),
  }
}

function sameFilter(a: FilterTheme, b: FilterTheme): boolean {
  return (
    a.invert === b.invert &&
    a.brightness === b.brightness &&
    a.contrast === b.contrast &&
    a.saturate === b.saturate &&
    a.sepia === b.sepia
  )
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

export function mountPanel(options: PanelOptions): PanelHandle {
  const host = document.createElement('tab-panel')
  host.setAttribute('popover', 'manual')
  host.setAttribute('style', HOST_STYLE)

  const root = host.attachShadow({ mode: 'closed' })
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(PANEL_CSS)
  root.adoptedStyleSheets = [sheet]

  const highlight = h('div', { class: 'highlight' })
  const panel = h('div', { class: 'panel' })
  root.append(highlight, panel)

  // Keystrokes typed into the panel would otherwise reach the page's shortcut
  // handlers, retargeted to the host and so not recognisable as typing.
  for (const type of ['keydown', 'keyup', 'keypress'] as const) {
    root.addEventListener(type, (event) => event.stopPropagation())
  }

  document.documentElement.append(host)
  host.showPopover()

  let history: History<SiteRules> = createHistory(options.site)
  let selection: Selection | null = null
  let notice: Notice | null = null
  let stopPicking: (() => void) | null = null

  const site = (): SiteRules => history.present

  function commit(next: SiteRules): void {
    history = record(history, next)
    notice = null
    options.onChange(next)
    render()
  }

  function travel(next: History<SiteRules>): void {
    history = next
    notice = null
    options.onChange(next.present)
    render()
  }

  function report(kind: Notice['kind'], text: string): void {
    notice = { kind, text }
    render()
  }

  /** The rule constructors throw on invalid input; that is shown to the user, never swallowed. */
  function attempt(produce: () => SiteRules): void {
    let next: SiteRules
    try {
      next = produce()
    } catch (error) {
      if (!(error instanceof InvalidRuleError)) throw error
      report('error', error.message)
      return
    }
    commit(next)
  }

  function selectedRule(): ElementRule | undefined {
    const id = selection?.ruleId
    return id === undefined ? undefined : site().elementRules.find((rule) => rule.id === id)
  }

  function updateSelectedRule(change: (draft: RuleDraft) => RuleDraft): void {
    const current = selection
    if (current === null) throw new Error('No element is selected')

    attempt(() => {
      const existing = selectedRule()
      const draft = existing ? draftFrom(existing) : { selector: current.selector, styles: {} }
      const rule = createElementRule(change(draft))
      selection = { selector: rule.selector, ruleId: rule.id }
      return withElementRule(site(), rule)
    })
  }

  /** An empty value removes the declaration. */
  function setStyle(property: AllowedProperty, value: string): void {
    updateSelectedRule((draft) => {
      const { [property]: _previous, ...rest } = draft.styles
      return { ...draft, styles: value === '' ? rest : { ...rest, [property]: value } }
    })
  }

  function setPathScoped(scoped: boolean): void {
    updateSelectedRule((draft) => {
      const { pathPrefix: _previous, ...rest } = draft
      return scoped ? { ...rest, pathPrefix: location.pathname } : rest
    })
  }

  function togglePicking(): void {
    if (stopPicking) {
      stopPicking()
      stopPicking = null
      render()
      return
    }

    stopPicking = startPicker({
      panelHost: host,
      highlight,
      onPick: (element) => {
        stopPicking = null
        const selector = selectorFor(element)
        const existing = site().elementRules.find((rule) => rule.selector === selector)
        selection = existing ? { selector, ruleId: existing.id } : { selector }
        render()
      },
      onCancel: () => {
        stopPicking = null
        render()
      },
    })
    render()
  }

  async function sampleColor(property: AllowedProperty): Promise<void> {
    let picked: string
    try {
      picked = (await new EyeDropper().open()).sRGBHex
    } catch (error) {
      // Escape dismisses the eyedropper by rejecting with an AbortError.
      if (error instanceof DOMException && error.name === 'AbortError') return
      throw error
    }
    setStyle(property, picked)
  }

  async function exportAll(): Promise<void> {
    const json = exportSites(await loadAllSites())
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
    h('a', { href: url, download: 'tab-themes.json' }).click()
    URL.revokeObjectURL(url)
  }

  async function importFile(file: File): Promise<void> {
    let incoming: SiteRules[]
    try {
      incoming = importSites(await file.text())
    } catch (error) {
      if (!(error instanceof InvalidRuleError)) throw error
      report('error', `Import failed: ${error.message}`)
      return
    }

    let own = site()
    for (const imported of incoming) {
      if (imported.hostname === own.hostname) {
        own = mergeSites(own, imported)
      } else {
        await saveSite(mergeSites(await loadSite(imported.hostname), imported))
      }
    }
    if (own !== site()) commit(own)
    report('info', `Imported ${plural(incoming.length, 'site')}`)
  }

  async function copyCss(): Promise<void> {
    await navigator.clipboard.writeText(buildStylesheet(site(), location.pathname))
    report('info', 'Stylesheet copied')
  }

  function textInput(property: AllowedProperty, value: string | undefined, placeholder: string): HTMLInputElement {
    const input = h('input', { type: 'text', placeholder, spellcheck: 'false' })
    input.value = value ?? ''
    input.addEventListener('change', () => setStyle(property, input.value.trim()))
    return input
  }

  function choice(property: AllowedProperty, value: string | undefined, values: readonly string[]): HTMLSelectElement {
    const select = h(
      'select',
      {},
      h('option', { value: '' }, '—'),
      ...values.map((option) => h('option', { value: option }, option)),
    )
    select.value = value ?? ''
    select.addEventListener('change', () => setStyle(property, select.value))
    return select
  }

  function colorInputs(property: AllowedProperty, value: string | undefined): HTMLElement[] {
    const input = h('input', { type: 'color', title: 'Choose a colour' })
    input.value = value !== undefined && SIX_DIGIT_HEX.test(value) ? value : '#000000'
    input.addEventListener('change', () => setStyle(property, input.value))

    const parts: HTMLElement[] = [
      input,
      button('Sample', () => void sampleColor(property), { title: 'Pick a colour from the page' }),
    ]
    if (value !== undefined) {
      parts.push(
        h('code', {}, value),
        button('×', () => setStyle(property, ''), { class: 'icon', title: 'Remove' }),
      )
    }
    return parts
  }

  function inputsFor(property: AllowedProperty, value: string | undefined): HTMLElement[] {
    switch (ALLOWED_PROPERTIES[property].kind) {
      case 'color':
        return colorInputs(property, value)
      case 'length':
        return [textInput(property, value, 'e.g. 12px')]
      case 'font-family':
        return [textInput(property, value, 'e.g. Georgia, serif')]
      case 'order':
        return [textInput(property, value, 'e.g. -1')]
      case 'font-weight':
        return [choice(property, value, [...FONT_WEIGHTS])]
      case 'border-style':
        return [choice(property, value, [...BORDER_STYLES])]
      case 'display':
        return [checkbox('Hidden', value === 'none', (hidden) => setStyle(property, hidden ? 'none' : ''))]
    }
  }

  function control(property: AllowedProperty, value: string | undefined): HTMLElement {
    return h(
      'div',
      { class: 'row' },
      h('span', { class: 'label' }, LABELS[property]),
      h('div', { class: 'controls' }, ...inputsFor(property, value)),
    )
  }

  function header(current: SiteRules): HTMLElement {
    return h(
      'header',
      {},
      h('strong', {}, 'Tab'),
      h('span', { class: 'host' }, current.hostname),
      button('×', options.onClose, { class: 'icon', title: 'Close' }),
    )
  }

  function toolbar(): HTMLElement {
    return h(
      'section',
      { class: 'toolbar' },
      button(stopPicking ? 'Cancel picking' : 'Pick element', togglePicking, { class: 'primary' }),
      button('Undo', () => travel(undo(history)), canUndo(history) ? {} : { disabled: '' }),
      button('Redo', () => travel(redo(history)), canRedo(history) ? {} : { disabled: '' }),
    )
  }

  function editor(current: Selection): HTMLElement {
    const rule = selectedRule()
    const matches = matchCount(current.selector, document)

    return h(
      'section',
      {},
      h('h2', {}, 'Selected element'),
      h('code', {}, current.selector),
      h('p', { class: 'muted' }, matches === 0 ? 'Matches nothing on this page' : `Matches ${plural(matches, 'element')}`),
      checkbox(`Only under ${rule?.pathPrefix ?? location.pathname}`, rule?.pathPrefix !== undefined, setPathScoped),
      ...GROUPS.map((group) =>
        h(
          'fieldset',
          {},
          h('legend', {}, group.legend),
          ...group.properties.map((property) => control(property, rule?.styles[property])),
        ),
      ),
      h(
        'div',
        { class: 'actions' },
        button('Done', () => {
          selection = null
          render()
        }),
      ),
    )
  }

  function themeSection(current: SiteRules): HTMLElement {
    const filter = current.filter
    const active = filter === undefined ? undefined : PRESETS.find((preset) => sameFilter(preset.filter, filter))

    const select = h(
      'select',
      {},
      h('option', { value: '' }, 'None'),
      ...PRESETS.map((preset) => h('option', { value: preset.id }, preset.name)),
      ...(filter !== undefined && active === undefined ? [h('option', { value: 'custom' }, 'Custom')] : []),
    )
    select.value = filter === undefined ? '' : (active?.id ?? 'custom')
    select.addEventListener('change', () => {
      if (select.value === 'custom') return
      const preset = PRESETS.find((candidate) => candidate.id === select.value)
      commit(withFilter(site(), preset?.filter))
    })

    return h('section', {}, h('h2', {}, 'Whole-page theme'), select)
  }

  function rulesSection(current: SiteRules): HTMLElement {
    const broken = brokenRuleIds(current, location.pathname, document)

    const elementItems = current.elementRules.map((rule) =>
      h(
        'li',
        {},
        checkbox('', rule.enabled, (enabled) => commit(withElementRuleEnabled(site(), rule.id, enabled))),
        button(
          rule.selector,
          () => {
            selection = { selector: rule.selector, ruleId: rule.id }
            render()
          },
          { class: 'link', title: rule.selector },
        ),
        ...(rule.pathPrefix === undefined ? [] : [h('span', { class: 'muted' }, rule.pathPrefix)]),
        ...(broken.has(rule.id)
          ? [h('span', { class: 'badge', title: 'Matches nothing on this page. The site may have changed.' }, 'no match')]
          : []),
        button(
          '×',
          () => {
            if (selection?.ruleId === rule.id) selection = null
            commit(withoutElementRule(site(), rule.id))
          },
          { class: 'icon', title: 'Delete rule' },
        ),
      ),
    )

    const variableItems = current.variableOverrides.map((override) =>
      h(
        'li',
        {},
        checkbox('', override.enabled, (enabled) =>
          commit(withVariableOverrideEnabled(site(), override.name, enabled)),
        ),
        h('code', {}, `${override.name}: ${override.value}`),
        button('×', () => commit(withoutVariableOverride(site(), override.name)), {
          class: 'icon',
          title: 'Delete override',
        }),
      ),
    )

    const items = [...elementItems, ...variableItems]
    return h(
      'section',
      {},
      h('h2', {}, `Rules on this site (${items.length})`),
      checkbox(`Apply on ${current.hostname}`, current.enabled, (enabled) =>
        commit(withSiteEnabled(site(), enabled)),
      ),
      items.length === 0 ? h('p', { class: 'muted' }, 'No rules yet.') : h('ul', {}, ...items),
    )
  }

  function backupSection(): HTMLElement {
    const file = h('input', { type: 'file', accept: 'application/json,.json', hidden: '' })
    file.addEventListener('change', () => {
      const chosen = file.files?.[0]
      if (chosen) void importFile(chosen)
    })

    return h(
      'section',
      {},
      h('h2', {}, 'Backup'),
      h(
        'div',
        { class: 'actions' },
        button('Export all', () => void exportAll()),
        button('Import', () => file.click()),
        button('Copy CSS', () => void copyCss()),
        file,
      ),
    )
  }

  function render(): void {
    const current = site()
    panel.replaceChildren(
      header(current),
      ...(notice ? [h('p', { class: `notice ${notice.kind}` }, notice.text)] : []),
      toolbar(),
      ...(selection ? [editor(selection)] : []),
      themeSection(current),
      rulesSection(current),
      backupSection(),
    )
  }

  render()

  return {
    replaceSite(next) {
      history = createHistory(next)
      render()
    },
    refresh: render,
    destroy() {
      stopPicking?.()
      host.remove()
    },
  }
}
