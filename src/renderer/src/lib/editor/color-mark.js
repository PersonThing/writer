/**
 * ProseMirror marks for writer's [color]…[/color] and
 * [bg-color]…[/bg-color] inline syntax.
 *
 * parseMarkdown reads the custom mdast nodes produced by remark-color.
 * toMarkdown opens a mark-typed mdast node (`colorSpan` / `bgColorSpan`)
 * with a `color` prop; a companion remark-stringify handler (see
 * color-plugin.js) serializes the node back into `[color]…[/color]`
 * bracket syntax so files round-trip exactly.
 */
import { $markSchema, $command } from '@milkdown/utils'
import { toggleMark } from '@milkdown/prose/commands'
import { TextSelection } from '@milkdown/prose/state'
import { COLOR_NAMES } from './remark-color.js'

function validColor(c) {
  return COLOR_NAMES.includes(c) ? c : 'red'
}

export const colorSpanSchema = $markSchema('colorSpan', () => ({
  attrs: { color: { default: 'red', validate: 'string' } },
  parseDOM: [
    {
      tag: 'span.md-color',
      getAttrs: (dom) => {
        const m = /md-color-(red|green|blue|yellow)/.exec(dom.className)
        return { color: m ? m[1] : 'red' }
      },
    },
  ],
  toDOM: (mark) => [
    'span',
    { class: `md-color md-color-${validColor(mark.attrs.color)}` },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'colorSpan',
    runner: (state, node, markType) => {
      state.openMark(markType, { color: validColor(node.color) })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'colorSpan',
    runner: (state, mark) => {
      state.withMark(mark, 'colorSpan', undefined, {
        color: validColor(mark.attrs.color),
      })
    },
  },
}))

export const bgColorSpanSchema = $markSchema('bgColorSpan', () => ({
  attrs: { color: { default: 'red', validate: 'string' } },
  parseDOM: [
    {
      tag: 'span.md-bg',
      getAttrs: (dom) => {
        const m = /md-bg-(red|green|blue|yellow)/.exec(dom.className)
        return { color: m ? m[1] : 'red' }
      },
    },
  ],
  toDOM: (mark) => [
    'span',
    { class: `md-bg md-bg-${validColor(mark.attrs.color)}` },
    0,
  ],
  parseMarkdown: {
    match: (node) => node.type === 'bgColorSpan',
    runner: (state, node, markType) => {
      state.openMark(markType, { color: validColor(node.color) })
      state.next(node.children)
      state.closeMark(markType)
    },
  },
  toMarkdown: {
    match: (mark) => mark.type.name === 'bgColorSpan',
    runner: (state, mark) => {
      state.withMark(mark, 'bgColorSpan', undefined, {
        color: validColor(mark.attrs.color),
      })
    },
  },
}))

/**
 * Build a command that toggles `schema` with a color attribute. When
 * the selection is empty, expand to the enclosing textblock first —
 * mirrors the "wrap the whole line when nothing is selected" behavior
 * the old textarea editor had for poetry formatting.
 */
function makeToggleColorCmd(schemaRef) {
  return (ctx) => (payload) => (state, dispatch, view) => {
    const markType = schemaRef.type(ctx)
    const color = validColor(payload?.color)

    let workState = state
    if (workState.selection.empty && dispatch) {
      const $from = workState.selection.$from
      const start = $from.start($from.depth)
      const end = $from.end($from.depth)
      if (end > start) {
        const tr = workState.tr.setSelection(
          TextSelection.create(workState.doc, start, end),
        )
        dispatch(tr)
        workState = workState.apply(tr)
      }
    }
    return toggleMark(markType, { color })(workState, dispatch, view)
  }
}

export const toggleColorCmd = $command('ToggleColor', makeToggleColorCmd(colorSpanSchema))
export const toggleBgColorCmd = $command('ToggleBgColor', makeToggleColorCmd(bgColorSpanSchema))
