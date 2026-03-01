/**
 * Project store — files, metadata, statuses, filters, sorting.
 * Uses Svelte 5 class pattern: $state fields + $derived fields + methods.
 */
import * as api from '../api.js';

export const DEFAULT_STATUSES = [
  { id: 'new',  label: 'New',   color: '#7c7c7c', description: 'Newly added, not yet started' },
  { id: 'todo', label: 'To do', color: '#4a68b0', description: 'Ready to work on' },
  { id: '30',   label: '30%',   color: '#e05c04', description: 'Early draft' },
  { id: '70',   label: '70%',   color: '#a07c22', description: 'Nearly there' },
  { id: 'done', label: 'Done',  color: '#1e8a48', description: 'Finished' },
];

class ProjectStore {
  // ── State ────────────────────────────────────────────────────────────────
  rootPath = $state(null);
  files = $state(new Map());
  dirs = $state(new Set());
  meta = $state({});
  searchQuery = $state('');
  activeFilter = $state('');
  activeSort = $state('status');
  collapsed = $state(new Set());

  #showAppCallback = null;

  // ── Derived ──────────────────────────────────────────────────────────────
  get statuses() {
    return this.meta._statuses || DEFAULT_STATUSES;
  }

  get doneOrder() {
    return Array.isArray(this.meta._doneOrder) ? this.meta._doneOrder : [];
  }

  get fileCounts() {
    const counts = { '': 0, social: 0 };
    for (const s of this.statuses) counts[s.id] = 0;
    let total = 0;
    for (const [path] of this.files) {
      const m = this.getMeta(path);
      total++;
      const sid = m.status || '';
      if (sid in counts) counts[sid]++;
      else counts['']++;
      if (m.social) counts.social++;
    }
    counts._total = total;
    return counts;
  }

  get filteredFiles() {
    let paths = [...this.files.keys()];

    // Hide done files unless explicitly filtering by "done"
    if (this.activeFilter !== 'done') {
      paths = paths.filter(p => this.getMeta(p).status !== 'done');
    }

    // Search filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      paths = paths.filter(p => this.displayName(p).toLowerCase().includes(q));
    }

    // Status filter
    if (this.activeFilter === 'social') {
      paths = paths.filter(p => this.getMeta(p).social);
    } else if (this.activeFilter) {
      paths = paths.filter(p => this.getMeta(p).status === this.activeFilter);
    }

    // Sort
    paths.sort((a, b) => {
      const ma = this.getMeta(a), mb = this.getMeta(b);
      if (this.activeSort === 'quality') {
        if (mb.quality !== ma.quality) return mb.quality - ma.quality;
        return this.displayName(a).localeCompare(this.displayName(b));
      }
      if (this.activeSort === 'status') {
        const order = this.statuses.map(s => s.id).concat(['']);
        const diff = order.indexOf(ma.status || '') - order.indexOf(mb.status || '');
        if (diff !== 0) return diff;
        return this.displayName(a).localeCompare(this.displayName(b));
      }
      if (this.activeSort === 'modified') {
        return (mb.modified || 0) - (ma.modified || 0);
      }
      return this.displayName(a).localeCompare(this.displayName(b));
    });

    return paths;
  }

  // ── Meta helpers ─────────────────────────────────────────────────────────

  getMeta(path) {
    return this.meta[path] || { status: '', quality: 0, social: false };
  }

  async patchMeta(path, patch) {
    if ('status' in patch && patch.status !== this.getMeta(path).status) {
      this.#syncDoneOrder(path, patch.status);
    }
    this.meta = { ...this.meta, [path]: { ...this.getMeta(path), ...patch } };
    await this.saveMeta();
  }

  statusColor(id) {
    if (!id) return '#444';
    const s = this.statuses.find(s => s.id === id);
    return s ? s.color : '#444';
  }

  // ── File name helpers ──────────────────────────────────────────────────

  topFolder(relPath) {
    const tops = [...this.dirs].filter(k => !k.includes('/'));
    for (const t of tops) {
      if (relPath === t || relPath.startsWith(t + '/')) return t;
    }
    return '(root)';
  }

  displayName(relPath) {
    const top = this.topFolder(relPath);
    const stem = relPath.endsWith('.md') ? relPath.slice(0, -3) : relPath;
    const sub = top === '(root)' ? stem : stem.slice(top.length + 1);
    return sub.replace(/\//g, ' / ');
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async openRoot(dirPath) {
    this.rootPath = dirPath;
    await this.scanAll();
    await this.loadMeta();
    this.#showApp();
  }

  async scanAll() {
    const result = await api.scanDirectory(this.rootPath);
    const newFiles = new Map();
    for (const rel of Object.keys(result.files)) {
      newFiles.set(rel, result.files[rel]);
    }
    this.files = newFiles;
    const newDirs = new Set();
    for (const rel of Object.keys(result.dirs)) {
      newDirs.add(rel);
    }
    this.dirs = newDirs;
  }

  async loadMeta() {
    try {
      const text = await api.readFile(this.rootPath + '/poems-meta.json');
      this.meta = text.trim() ? JSON.parse(text) : {};
    } catch {
      this.meta = {};
    }
  }

  async saveMeta() {
    await api.writeFile(this.rootPath + '/poems-meta.json', JSON.stringify(this.meta, null, 2));
  }

  // ── Done / Reading Order ───────────────────────────────────────────────

  #syncDoneOrder(path, newStatus) {
    let order = Array.isArray(this.meta._doneOrder) ? [...this.meta._doneOrder] : [];
    const inOrder = order.includes(path);
    if (newStatus === 'done' && !inOrder) {
      order.push(path);
    } else if (newStatus !== 'done' && inOrder) {
      order = order.filter(p => p !== path);
    }
    this.meta = { ...this.meta, _doneOrder: order };
  }

  async reorderDone(fromPath, toPath) {
    const order = [...this.doneOrder];
    const fromIdx = order.indexOf(fromPath);
    const toIdx = order.indexOf(toPath);
    if (fromIdx === -1 || toIdx === -1) return;
    order.splice(fromIdx, 1);
    order.splice(toIdx, 0, fromPath);
    this.meta = { ...this.meta, _doneOrder: order };
    await this.saveMeta();
  }

  // ── App visibility ─────────────────────────────────────────────────────

  onShowApp(cb) { this.#showAppCallback = cb; }
  #showApp() { if (this.#showAppCallback) this.#showAppCallback(); }
}

export const project = new ProjectStore();
