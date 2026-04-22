/**
 * Centralized editor commands used by the shared toolbar and keymap.
 *
 * Each function takes the Milkdown `editor` instance plus an optional
 * payload and performs a ProseMirror transaction (or dispatches a
 * registered command). Keeping these behind a single `runFormat()` entry
 * point lets the toolbar and EditorPane stay thin.
 */
import {
  commandsCtx,
  editorViewCtx,
  editorStateCtx,
} from '@milkdown/core'
import {
  toggleStrongCommand,
  toggleEmphasisCommand,
  wrapInHeadingCommand,
  insertHrCommand,
  wrapInBulletListCommand,
  linkSchema,
  strongSchema,
  emphasisSchema,
} from '@milkdown/preset-commonmark'
import {
  toggleStrikethroughCommand,
  strikethroughSchema,
} from '@milkdown/preset-gfm'
import { toggleLinkCommand } from '@milkdown/kit/component/link-tooltip'
import { toggleMark } from '@milkdown/prose/commands'
import { TextSelection } from '@milkdown/prose/state'
import {
  toggleColorCmd,
  toggleBgColorCmd,
  colorSpanSchema,
  bgColorSpanSchema,
} from './color-plugin.js'

/** Call a registered Milkdown command by its key. */
function call(editor, key, payload) {
  editor.action((ctx) => {
    ctx.get(commandsCtx).call(key, payload)
  })
}

/** Expand an empty selection to cover the current textblock. */
function expandToLine(view) {
  const { state } = view
  if (!state.selection.empty) return
  const $from = state.selection.$from
  const start = $from.start($from.depth)
  const end = $from.end($from.depth)
  if (end > start) {
    view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, start, end)))
  }
}

function withLineExpansion(editor, fn) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    expandToLine(view)
    fn(view, ctx)
  })
}

export function runFormat(editor, action, payload) {
  if (!editor) return
  switch (action) {
    case 'bold':
      return withLineExpansion(editor, (_v, ctx) =>
        ctx.get(commandsCtx).call(toggleStrongCommand.key),
      )
    case 'italic':
      return withLineExpansion(editor, (_v, ctx) =>
        ctx.get(commandsCtx).call(toggleEmphasisCommand.key),
      )
    case 'strikethrough':
      return withLineExpansion(editor, (_v, ctx) =>
        ctx.get(commandsCtx).call(toggleStrikethroughCommand.key),
      )
    case 'h1':
      return call(editor, wrapInHeadingCommand.key, 1)
    case 'h2':
      return call(editor, wrapInHeadingCommand.key, 2)
    case 'h3':
      return call(editor, wrapInHeadingCommand.key, 3)
    case 'hr':
      return call(editor, insertHrCommand.key)
    case 'bullet':
      return call(editor, wrapInBulletListCommand.key)
    case 'link':
      return call(editor, toggleLinkCommand.key)
    case 'em-dash':
      return insertText(editor, '\u2014')
    case 'poetry-br':
      return insertHardBreak(editor)
    case 'dup-line':
      return duplicateBlock(editor)
    case 'case':
      return cycleCase(editor)
    case 'color':
      return call(editor, toggleColorCmd.key, { color: payload?.color })
    case 'bgColor':
      return call(editor, toggleBgColorCmd.key, { color: payload?.color })
  }
}

function insertText(editor, text) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const tr = state.tr.insertText(text, state.selection.from, state.selection.to)
    view.dispatch(tr)
  })
}

function insertHardBreak(editor) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const br = state.schema.nodes.hardbreak
    if (!br) return
    const tr = state.tr.replaceSelectionWith(br.create(), false)
    view.dispatch(tr.scrollIntoView())
  })
}

function duplicateBlock(editor) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const $pos = state.selection.$from
    const depth = $pos.depth
    if (depth < 1) return
    const block = $pos.node(depth)
    const blockStart = $pos.before(depth)
    const blockEnd = $pos.after(depth)
    const tr = state.tr.insert(blockEnd, block.copy(block.content))
    view.dispatch(tr.scrollIntoView())
    void blockStart
  })
}

const CASE_STEPS = ['upper', 'title', 'lower']
let caseIdx = 0
let caseTimer = 0

function cycleCase(editor) {
  editor.action((ctx) => {
    const view = ctx.get(editorViewCtx)
    const { state } = view
    const { from, to, empty } = state.selection
    if (empty) return

    const now = Date.now()
    if (now - caseTimer > 900) caseIdx = 0
    caseTimer = now
    const mode = CASE_STEPS[caseIdx]
    caseIdx = (caseIdx + 1) % CASE_STEPS.length

    const text = state.doc.textBetween(from, to, '\n', '\n')
    let next
    if (mode === 'upper') next = text.toUpperCase()
    else if (mode === 'lower') next = text.toLowerCase()
    else
      next = text.replace(
        /\S+/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )

    const tr = state.tr.insertText(next, from, to)
    view.dispatch(tr)
  })
}

/**
 * Inspect the active marks at the current selection and return the
 * set of format names matching the toolbar's vocabulary.
 */
export function detectActiveFormats(editor) {
  const active = new Set()
  if (!editor) return active
  editor.action((ctx) => {
    const state = ctx.get(editorStateCtx)
    const { $from, empty, from, to } = state.selection
    const marks = empty ? state.storedMarks || $from.marks() : []

    function has(markType) {
      if (!markType) return false
      if (empty) return marks.some((m) => m.type === markType)
      return state.doc.rangeHasMark(from, to, markType)
    }

    const strong = strongSchema.type(ctx)
    const emph = emphasisSchema.type(ctx)
    const strike = strikethroughSchema.type(ctx)
    const link = linkSchema.type(ctx)
    const color = colorSpanSchema.type(ctx)
    const bg = bgColorSpanSchema.type(ctx)

    if (has(strong)) active.add('bold')
    if (has(emph)) active.add('italic')
    if (has(strike)) active.add('strikethrough')
    if (has(link)) active.add('link')

    // Track active color and bg color by attribute so the toolbar swatch
    // can show which one is applied.
    const findMark = (markType) => {
      if (!markType) return null
      if (empty) return marks.find((m) => m.type === markType) || null
      let found = null
      state.doc.nodesBetween(from, to, (node) => {
        if (found) return false
        const m = node.marks?.find((mk) => mk.type === markType)
        if (m) found = m
      })
      return found
    }
    const cm = findMark(color)
    if (cm) active.add(`color-${cm.attrs.color}`)
    const bm = findMark(bg)
    if (bm) active.add(`bgColor-${bm.attrs.color}`)
  })
  return active
}
