/**
 * The selector a new rule targets, generated with @medv/finder
 * (docs/DECISIONS.md: a maintained library, not a hand-rolled path walker).
 *
 * finder builds the shortest unique selector from ids, classes, word-like
 * attributes (role, aria-label, data-*) and structural positions. Its default
 * attribute choice already matches docs/ARCHITECTURE.md; ids and classes are
 * narrowed here so that nothing a build or a render generated is used.
 */

import { finder, className as isWordLikeClass, idName as isWordLikeId } from '@medv/finder'
import { isHashLikeClass, isStableId } from '../core/selector-safety'

export function selectorFor(element: Element): string {
  return finder(element, {
    idName: (name) => isWordLikeId(name) && isStableId(name),
    className: (name) => isWordLikeClass(name) && !isHashLikeClass(name),
  })
}
