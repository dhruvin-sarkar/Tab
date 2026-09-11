/**
 * Rejecting build-generated class names when generating a selector.
 *
 * Hashed class names (React/CSS-Modules/styled-components output) change on
 * every deploy, so a selector built from one silently stops matching after a
 * redesign. Structural fallbacks are preferred over them.
 *
 * NOTE ON A DIVERGENCE FROM docs/ARCHITECTURE.md
 * That document offers /^[a-z0-9]{5,8}$/ as an example filter. Applied
 * literally it rejects "button", "header", "navbar", "footer" and most other
 * authored semantic names, which would push selector generation onto
 * nth-child paths -- and those break under ordinary DOM change far more
 * readily than a semantic class does. The filter below therefore keys on what
 * actually distinguishes generated names: known library shapes, and tokens
 * that mix letters with digits or contain no vowel at all.
 */

const LIBRARY_HASH_PATTERNS: readonly RegExp[] = [
  /^sc-[A-Za-z0-9]{4,}$/, // styled-components
  /^css-[a-z0-9]{4,}$/, // emotion
  /^jsx-\d{4,}$/, // styled-jsx
  /^_ng(?:content|host)-/, // Angular view encapsulation
  /__[A-Za-z0-9]{5,}$/, // CSS Modules: Block_element__1a2b3
]

const VOWEL = /[aeiou]/i

/**
 * A token with no separator that either mixes letters with digits or contains
 * no vowel is far more likely to have been generated than authored.
 */
function looksGenerated(className: string): boolean {
  if (className.length < 5) return false
  if (/[-_]/.test(className)) return false

  const hasLetter = /[a-z]/i.test(className)
  if (!hasLetter) return false

  return /\d/.test(className) || !VOWEL.test(className)
}

export function isHashLikeClass(className: string): boolean {
  return LIBRARY_HASH_PATTERNS.some((pattern) => pattern.test(className)) || looksGenerated(className)
}

export function stableClassNames(classNames: Iterable<string>): string[] {
  return [...classNames].filter((className) => !isHashLikeClass(className))
}

/**
 * Whether an element id was written by a person, and so is safe to anchor a
 * saved selector on.
 *
 * Frameworks mint ids per render -- React's useId gives ":r1:" or "«r1»",
 * Radix "radix-:r3:", Ember "ember123", MUI "mui-42" -- and a selector built on
 * one matches nothing on the next page load. Rejecting an authored id costs
 * little (finder falls back to attributes, classes or structure); accepting a
 * generated one produces a rule that breaks on reload.
 *
 * TODO: decide the policy. Returning false never anchors on an id, which is
 * safe but discards the most stable handle a hand-written page has.
 */
export function isStableId(id: string): boolean {
  return false
}
