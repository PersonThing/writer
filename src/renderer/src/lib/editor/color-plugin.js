/**
 * Milkdown plugin bundle for writer's color extensions.
 *
 * Pulls together:
 *   - remark-color (parses bracket tokens in the mdast phase)
 *   - colorSpan / bgColorSpan ProseMirror marks
 *   - remark-stringify handlers that emit `[color]…[/color]` syntax
 *   - toggle commands used by toolbar / keymap
 *
 * Export `colorPlugins` as a flat array that can be passed to Milkdown
 * via `editor.use(colorPlugins)`.
 */
import { config } from '@milkdown/core'
import { remarkStringifyOptionsCtx } from '@milkdown/core'
import { $remark } from '@milkdown/utils'
import { remarkColor } from './remark-color.js'
import {
  colorSpanSchema,
  bgColorSpanSchema,
  toggleColorCmd,
  toggleBgColorCmd,
} from './color-mark.js'

export const remarkColorPlugin = $remark('remarkColor', () => remarkColor)

// remark-stringify handlers for the two custom mdast node types.
// `state.containerPhrasing` serializes the inner children as inline
// markdown; we wrap the result in the bracket syntax.
//
// We don't pass `before` / `after` hints — they make the escape logic
// inject backslashes in front of characters that happen to look like
// markdown when adjacent to our brackets (e.g. "!" after "]") even
// though our bracket tokens aren't real markdown.
function makeHandler(buildBefore, buildAfter, markName) {
  return function handler(node, _parent, state) {
    const before = buildBefore(node)
    const after = buildAfter(node)
    const exit = state.enter(markName)
    const inner = state.containerPhrasing(node, { before: '', after: '' })
    exit()
    return before + inner + after
  }
}

const colorSpanHandler = makeHandler(
  (n) => `[${n.color}]`,
  (n) => `[/${n.color}]`,
  'colorSpan',
)
const bgColorSpanHandler = makeHandler(
  (n) => `[bg-${n.color}]`,
  (n) => `[/bg-${n.color}]`,
  'bgColorSpan',
)

const installColorHandlers = config((ctx) => {
  ctx.update(remarkStringifyOptionsCtx, (prev) => ({
    ...prev,
    handlers: {
      ...(prev?.handlers || {}),
      colorSpan: colorSpanHandler,
      bgColorSpan: bgColorSpanHandler,
    },
  }))
})

export const colorPlugins = [
  remarkColorPlugin,
  colorSpanSchema,
  bgColorSpanSchema,
  toggleColorCmd,
  toggleBgColorCmd,
  installColorHandlers,
].flat()

export {
  colorSpanSchema,
  bgColorSpanSchema,
  toggleColorCmd,
  toggleBgColorCmd,
}
