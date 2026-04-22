/**
 * Writer-specific keyboard shortcuts for Milkdown.
 *
 * Crepe covers Ctrl+B/I, Ctrl+Z/Y, Tab, paste, link-tooltip, markdown
 * input rules. This plugin adds shortcuts that are specific to the
 * writer UI: heading levels, strikethrough, hr, bullet list toggle,
 * duplicate block, poetry hard break, case cycle, save, color toggles.
 */
import { commandsCtx } from '@milkdown/core'
import { $useKeymap } from '@milkdown/utils'
import {
  toggleStrikethroughCommand,
} from '@milkdown/preset-gfm'
import {
  wrapInHeadingCommand,
  insertHrCommand,
  wrapInBulletListCommand,
} from '@milkdown/preset-commonmark'

import { toggleColorCmd, toggleBgColorCmd } from './color-plugin.js'

const writerKeymap = $useKeymap('writerKeymap', {
  Heading1: {
    shortcuts: ['Mod-1'],
    command: (ctx) => () => {
      ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 1)
      return true
    },
  },
  Heading2: {
    shortcuts: ['Mod-2'],
    command: (ctx) => () => {
      ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 2)
      return true
    },
  },
  Heading3: {
    shortcuts: ['Mod-3'],
    command: (ctx) => () => {
      ctx.get(commandsCtx).call(wrapInHeadingCommand.key, 3)
      return true
    },
  },
  Strikethrough: {
    shortcuts: ['Mod-Shift-x'],
    command: (ctx) => () => {
      ctx.get(commandsCtx).call(toggleStrikethroughCommand.key)
      return true
    },
  },
  HorizontalRule: {
    shortcuts: ['Mod-\\'],
    command: (ctx) => () => {
      ctx.get(commandsCtx).call(insertHrCommand.key)
      return true
    },
  },
  BulletList: {
    shortcuts: ['Mod-Shift-l'],
    command: (ctx) => () => {
      ctx.get(commandsCtx).call(wrapInBulletListCommand.key)
      return true
    },
  },
})

export const writerKeymapPlugins = [writerKeymap].flat()
export { toggleColorCmd, toggleBgColorCmd }
