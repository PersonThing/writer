/**
 * Factory for writer's Milkdown editor instance.
 *
 * Builds a Crepe editor with writer-specific plugins:
 *   - remark-color + ProseMirror marks for [color]/[bg-color] tokens
 *   - extra keybindings (headings, strikethrough, hr, bullet list)
 *
 * Callers pass the root element, an initial markdown string, and an
 * `onChange(markdown)` callback. Returns `{ crepe, destroy, setMarkdown,
 * getMarkdown }`.
 */
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/nord.css'

import { listenerCtx } from '@milkdown/kit/plugin/listener'
import { replaceAll, getMarkdown } from '@milkdown/kit/utils'

import { colorPlugins } from './color-plugin.js'
import { writerKeymapPlugins } from './keymap.js'

export async function createWriterEditor({ root, defaultValue = '', onChange, onSelectionChange }) {
  const crepe = new Crepe({
    root,
    defaultValue,
    features: {
      [Crepe.Feature.BlockEdit]: false,
      [Crepe.Feature.ImageBlock]: false,
      [Crepe.Feature.Latex]: false,
    },
  })

  crepe.editor.use(colorPlugins).use(writerKeymapPlugins)

  await crepe.create()

  crepe.editor.action((ctx) => {
    const listener = ctx.get(listenerCtx)
    if (onChange) {
      listener.markdownUpdated((_, md) => onChange(md))
    }
    if (onSelectionChange) {
      listener.selectionUpdated(() => onSelectionChange())
    }
  })

  return {
    crepe,
    destroy: () => crepe.destroy(),
    setMarkdown: (md) => crepe.editor.action(replaceAll(md)),
    getMarkdown: () => crepe.editor.action(getMarkdown()),
  }
}
