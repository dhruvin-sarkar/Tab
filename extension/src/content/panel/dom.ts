/**
 * Element construction for the panel, which has no UI framework (AGENTS.md).
 */

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes: Readonly<Record<string, string>> = {},
  ...children: readonly (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag)
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value)
  }
  element.append(...children)
  return element
}

export function button(
  label: string,
  onClick: () => void,
  attributes: Readonly<Record<string, string>> = {},
): HTMLButtonElement {
  const element = h('button', { type: 'button', ...attributes }, label)
  element.addEventListener('click', onClick)
  return element
}

export function checkbox(
  label: string,
  checked: boolean,
  onToggle: (checked: boolean) => void,
): HTMLLabelElement {
  const input = h('input', { type: 'checkbox' })
  input.checked = checked
  input.addEventListener('change', () => onToggle(input.checked))
  return h('label', { class: 'check' }, input, label)
}
