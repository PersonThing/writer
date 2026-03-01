/**
 * Editor store — manages open panes, dirty state, undo/redo.
 * Uses Svelte 5 class pattern: $state fields + getter methods.
 */
import * as api from '../api.js';
import { project } from './project.svelte.js';

const MAX_UNDO = 200;

class EditorStore {
  // ── State ──────────────────────────────────────────────────────────────
  panes = $state([]);
  activePaneId = $state(null);
  viewMode = $state('split'); // 'split' | 'edit' | 'preview'

  // ── Derived (getters) ─────────────────────────────────────────────────
  get activePane() {
    return this.panes.find(p => p.id === this.activePaneId) || null;
  }

  get isSinglePane() {
    return this.panes.length === 1;
  }

  get isMultiPane() {
    return this.panes.length > 1;
  }

  get anyDirty() {
    return this.panes.some(p => p.dirty);
  }

  // ── Pane lifecycle ────────────────────────────────────────────────────

  #createPane(filePath, content = '') {
    return {
      id: crypto.randomUUID(),
      filePath,
      content,
      savedContent: content,
      dirty: false,
      pendingRename: null,
      undoStack: [],
      redoStack: [],
    };
  }

  async openFile(path, { newPane = false } = {}) {
    // If file is already open in a pane, just activate it
    const existing = this.panes.find(p => p.filePath === path);
    if (existing) {
      this.activePaneId = existing.id;
      return;
    }

    const content = await api.readFile(project.rootPath + '/' + path);

    if (newPane && this.panes.length < 3) {
      const pane = this.#createPane(path, content);
      this.panes = [...this.panes, pane];
      this.activePaneId = pane.id;
    } else if (this.panes.length === 0) {
      const pane = this.#createPane(path, content);
      this.panes = [pane];
      this.activePaneId = pane.id;
    } else {
      // Replace the active pane
      const active = this.panes.find(p => p.id === this.activePaneId);
      if (active && active.dirty) {
        const name = project.displayName(active.filePath);
        if (!confirm(`Discard unsaved changes to "${name}"?`)) return;
      }
      const pane = this.#createPane(path, content);
      this.panes = this.panes.map(p => p.id === this.activePaneId ? pane : p);
      this.activePaneId = pane.id;
    }
  }

  closePane(paneId) {
    const pane = this.panes.find(p => p.id === paneId);
    if (!pane) return;
    if (pane.dirty) {
      const name = project.displayName(pane.filePath);
      if (!confirm(`Discard unsaved changes to "${name}"?`)) return;
    }
    this.panes = this.panes.filter(p => p.id !== paneId);
    if (this.activePaneId === paneId) {
      this.activePaneId = this.panes.length > 0 ? this.panes[this.panes.length - 1].id : null;
    }
  }

  closeAllPanes() {
    this.panes = [];
    this.activePaneId = null;
  }

  setActivePane(paneId) {
    this.activePaneId = paneId;
  }

  // ── Content editing ───────────────────────────────────────────────────

  updateContent(paneId, content) {
    this.panes = this.panes.map(p => {
      if (p.id !== paneId) return p;
      return { ...p, content, dirty: content !== p.savedContent };
    });
  }

  setPendingRename(paneId, newName) {
    this.panes = this.panes.map(p => {
      if (p.id !== paneId) return p;
      const curName = project.displayName(p.filePath);
      if (newName && newName !== curName) {
        return { ...p, pendingRename: newName, dirty: true };
      }
      return { ...p, pendingRename: null };
    });
  }

  // ── Save ──────────────────────────────────────────────────────────────

  async savePane(paneId) {
    const pane = this.panes.find(p => p.id === paneId);
    if (!pane) return;

    if (pane.pendingRename) {
      const parts = pane.filePath.split('/');
      parts.pop();
      const folder = parts.length ? parts.join('/') : '';
      const newFileName = pane.pendingRename.endsWith('.md')
        ? pane.pendingRename
        : pane.pendingRename + '.md';
      const newPath = folder ? folder + '/' + newFileName : newFileName;

      try {
        await api.writeFile(project.rootPath + '/' + newPath, pane.content);
        await api.deleteFile(project.rootPath + '/' + pane.filePath);
        await project.patchMeta(newPath, { ...project.getMeta(pane.filePath), modified: Date.now() });

        this.panes = this.panes.map(p => {
          if (p.id !== paneId) return p;
          return { ...p, filePath: newPath, savedContent: p.content, dirty: false, pendingRename: null };
        });

        await project.scanAll();
      } catch (e) {
        alert('Rename failed: ' + e.message);
        return;
      }
    } else {
      await api.writeFile(project.rootPath + '/' + pane.filePath, pane.content);
      await project.patchMeta(pane.filePath, { modified: Date.now() });

      this.panes = this.panes.map(p => {
        if (p.id !== paneId) return p;
        return { ...p, savedContent: p.content, dirty: false };
      });
    }

    return true;
  }

  // ── Undo / Redo ───────────────────────────────────────────────────────

  pushUndo(paneId, value, selStart, selEnd) {
    this.panes = this.panes.map(p => {
      if (p.id !== paneId) return p;
      const stack = [...p.undoStack, { value, s: selStart, e: selEnd }];
      if (stack.length > MAX_UNDO) stack.shift();
      return { ...p, undoStack: stack, redoStack: [] };
    });
  }

  doUndo(paneId) {
    const pane = this.panes.find(p => p.id === paneId);
    if (!pane || !pane.undoStack.length) return null;

    const snap = pane.undoStack[pane.undoStack.length - 1];
    this.panes = this.panes.map(p => {
      if (p.id !== paneId) return p;
      return {
        ...p,
        undoStack: p.undoStack.slice(0, -1),
        redoStack: [...p.redoStack, { value: p.content, s: 0, e: 0 }],
        content: snap.value,
        dirty: snap.value !== p.savedContent,
      };
    });
    return snap;
  }

  doRedo(paneId) {
    const pane = this.panes.find(p => p.id === paneId);
    if (!pane || !pane.redoStack.length) return null;

    const snap = pane.redoStack[pane.redoStack.length - 1];
    this.panes = this.panes.map(p => {
      if (p.id !== paneId) return p;
      return {
        ...p,
        redoStack: p.redoStack.slice(0, -1),
        undoStack: [...p.undoStack, { value: p.content, s: 0, e: 0 }],
        content: snap.value,
        dirty: snap.value !== p.savedContent,
      };
    });
    return snap;
  }

  // ── New file ──────────────────────────────────────────────────────────

  async newFile() {
    const name = prompt('New poem title:');
    if (!name || !name.trim()) return;

    const filename = name.trim().replace(/[<>:"/\\|?*]/g, '') + '.md';
    const content = `# ${name.trim()}\n\n`;

    await api.writeFile(project.rootPath + '/' + filename, content);
    await project.scanAll();

    const useNewPane = this.panes.length < 3;
    if (project.files.has(filename)) {
      await this.openFile(filename, { newPane: useNewPane });
    }
  }
}

export const editor = new EditorStore();
