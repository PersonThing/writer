/**
 * Editor store — manages open panes (each backed by a Milkdown instance),
 * dirty state, and the set of active inline formats (read by the toolbar
 * to highlight the matching buttons).
 *
 * Milkdown owns its own undo/redo history, so there are no per-pane undo
 * stacks here. Every file opens in the WYSIWYG editor — plot/bible view
 * types no longer exist.
 */
import * as api from '../api.js'
import { project } from './project.svelte.js'
import { modalConfirm, modalAlert } from './ui.svelte.js'

const MAX_PANES = 4

class EditorStore {
  panes = $state([])
  activePaneId = $state(null)

  // Drag state for pane reordering (shared across pane components)
  draggedPaneId = $state(null)
  dragOverPaneId = $state(null)

  // Format markers active at the current cursor/selection in the active
  // pane. Populated by EditorPane on selection/content changes; read by
  // EditorArea's shared toolbar to highlight the matching buttons.
  activeFormats = $state(new Set())

  get activePane() {
    return this.panes.find((p) => p.id === this.activePaneId) || null
  }

  get isSinglePane() {
    return this.panes.length === 1
  }

  get isMultiPane() {
    return this.panes.length > 1
  }

  get anyDirty() {
    return this.panes.some((p) => p.dirty)
  }

  #createPane(filePath, content = '') {
    return {
      id: crypto.randomUUID(),
      filePath,
      content,
      savedContent: content,
      dirty: false,
      pendingRename: null,
      flex: 1,
    }
  }

  resizePanes(leftId, rightId, leftFlex, rightFlex) {
    this.panes = this.panes.map((p) => {
      if (p.id === leftId) return { ...p, flex: leftFlex }
      if (p.id === rightId) return { ...p, flex: rightFlex }
      return p
    })
  }

  async openFile(path, { newPane = false } = {}) {
    const existing = this.panes.find((p) => p.filePath === path)
    if (existing) {
      this.activePaneId = existing.id
      return
    }

    const content = await api.readFile(path)

    if (newPane && this.panes.length < MAX_PANES) {
      const pane = this.#createPane(path, content)
      this.panes = [...this.panes, pane]
      this.activePaneId = pane.id
    } else if (this.panes.length === 0) {
      const pane = this.#createPane(path, content)
      this.panes = [pane]
      this.activePaneId = pane.id
    } else {
      const active = this.panes.find((p) => p.id === this.activePaneId)
      if (active && active.dirty) {
        const name = project.displayName(active.filePath)
        if (!(await modalConfirm(`Discard unsaved changes to "${name}"?`)))
          return
      }
      const pane = this.#createPane(path, content)
      this.panes = this.panes.map((p) =>
        p.id === this.activePaneId ? pane : p,
      )
      this.activePaneId = pane.id
    }
  }

  async closePane(paneId) {
    const pane = this.panes.find((p) => p.id === paneId)
    if (!pane) return
    if (pane.dirty) {
      const name = project.displayName(pane.filePath)
      if (!(await modalConfirm(`Discard unsaved changes to "${name}"?`))) return
    }
    this.panes = this.panes.filter((p) => p.id !== paneId)
    if (this.activePaneId === paneId) {
      this.activePaneId =
        this.panes.length > 0 ? this.panes[this.panes.length - 1].id : null
    }
  }

  closeAllPanes() {
    this.panes = []
    this.activePaneId = null
  }

  setActivePane(paneId) {
    this.activePaneId = paneId
  }

  reorderPanes(fromId, toId) {
    if (fromId === toId) return
    const fromIdx = this.panes.findIndex((p) => p.id === fromId)
    const toIdx = this.panes.findIndex((p) => p.id === toId)
    if (fromIdx === -1 || toIdx === -1) return
    const next = [...this.panes]
    const [moved] = next.splice(fromIdx, 1)
    next.splice(toIdx, 0, moved)
    this.panes = next
  }

  updateContent(paneId, content) {
    this.panes = this.panes.map((p) => {
      if (p.id !== paneId) return p
      return { ...p, content, dirty: content !== p.savedContent }
    })
  }

  setPendingRename(paneId, newName) {
    this.panes = this.panes.map((p) => {
      if (p.id !== paneId) return p
      const curName = project.displayName(p.filePath)
      if (newName && newName !== curName) {
        return { ...p, pendingRename: newName, dirty: true }
      }
      return { ...p, pendingRename: null }
    })
  }

  async savePane(paneId) {
    const pane = this.panes.find((p) => p.id === paneId)
    if (!pane) return

    if (pane.pendingRename) {
      const parts = pane.filePath.split('/')
      parts.pop()
      const folder = parts.length ? parts.join('/') : ''
      const newFileName = pane.pendingRename.endsWith('.md')
        ? pane.pendingRename
        : pane.pendingRename + '.md'
      const newPath = folder ? folder + '/' + newFileName : newFileName

      try {
        await api.writeFile(newPath, pane.content)
        await api.deleteFile(pane.filePath)
        await project.patchMeta(newPath, {
          ...project.getMeta(pane.filePath),
          modified: Date.now(),
        })

        this.panes = this.panes.map((p) => {
          if (p.id !== paneId) return p
          return {
            ...p,
            filePath: newPath,
            savedContent: p.content,
            dirty: false,
            pendingRename: null,
          }
        })

        await project.scanAll()
      } catch (e) {
        modalAlert('Rename failed: ' + e.message)
        return
      }
    } else {
      await api.writeFile(pane.filePath, pane.content)
      await project.patchMeta(pane.filePath, { modified: Date.now() })

      this.panes = this.panes.map((p) => {
        if (p.id !== paneId) return p
        return { ...p, savedContent: p.content, dirty: false }
      })
    }

    return true
  }

  async newFile() {
    let name = 'Untitled'
    let filename = name + '.md'
    let i = 1
    while (project.files.has(filename)) {
      name = `Untitled ${i}`
      filename = name + '.md'
      i++
    }

    await api.writeFile(filename, '')
    await project.scanAll()

    const useNewPane = this.panes.length < MAX_PANES
    if (project.files.has(filename)) {
      await this.openFile(filename, { newPane: useNewPane })
    }
  }
}

export const editor = new EditorStore()
