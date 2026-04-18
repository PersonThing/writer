/**
 * Project store — files, metadata, statuses.
 * File ordering is independent of status. Status is just a tag.
 */
import * as api from '../api.js'

export const DEFAULT_STATUSES = [
  { id: 'new', label: 'New', color: '#7c7c7c' },
  { id: 'todo', label: 'To do', color: '#4a68b0' },
  { id: '30', label: '30%', color: '#e05c04' },
  { id: '70', label: '70%', color: '#a07c22' },
  { id: 'done', label: 'Done', color: '#1e8a48' },
]

export function slugify(label) {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

class ProjectStore {
  // ── State ────────────────────────────────────────────────────────────────
  rootPath = $state(null)
  files = $state(new Map())
  dirs = $state(new Set())
  meta = $state({})
  searchQuery = $state('')
  searchMatches = $state(null)
  activeFilter = $state('')
  sortMode = $state('name') // 'name' | 'created' | 'status'

  #showAppCallback = null
  #searchTimer = 0

  // ── Derived ──────────────────────────────────────────────────────────────
  get statuses() {
    return this.meta._statuses || DEFAULT_STATUSES
  }

  /**
   * Returns a flat list of file items, optionally filtered by status and search.
   * Files are ordered by _fileOrder (a single flat array), then alphabetically
   * for any files not in the order list.
   */
  get filteredFiles() {
    let allPaths = [...this.files.keys()]

    // Apply search filter
    if (this.searchQuery && this.searchMatches) {
      allPaths = allPaths.filter((p) => this.searchMatches.has(p))
    } else if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase()
      allPaths = allPaths.filter((p) =>
        this.displayName(p).toLowerCase().includes(q),
      )
    }

    // Apply status filter
    if (this.activeFilter === '_none') {
      const knownIds = new Set(this.statuses.map((s) => s.id))
      allPaths = allPaths.filter((p) => {
        const sid = this.getMeta(p).status || ''
        return sid === '' || !knownIds.has(sid)
      })
    } else if (this.activeFilter) {
      allPaths = allPaths.filter(
        (p) => (this.getMeta(p).status || '') === this.activeFilter,
      )
    }

    // Sort by selected mode
    const statusOrder = new Map()
    this.statuses.forEach((s, i) => statusOrder.set(s.id, i))

    if (this.sortMode === 'created') {
      allPaths.sort((a, b) => {
        const ca = this.files.get(a)?.created || 0
        const cb = this.files.get(b)?.created || 0
        return cb - ca // newest first
      })
    } else if (this.sortMode === 'status') {
      allPaths.sort((a, b) => {
        const sa = this.getMeta(a).status || ''
        const sb = this.getMeta(b).status || ''
        const oa = sa ? (statusOrder.get(sa) ?? 999) : 1000
        const ob = sb ? (statusOrder.get(sb) ?? 999) : 1000
        if (oa !== ob) return oa - ob
        return this.displayName(a).localeCompare(this.displayName(b))
      })
    } else {
      // 'name' — alphabetical
      allPaths.sort((a, b) =>
        this.displayName(a).localeCompare(this.displayName(b)),
      )
    }

    const result = allPaths
    return result.map((p) => ({
      path: p,
      color: this.statusColor(this.getMeta(p).status || ''),
      statusId: this.getMeta(p).status || '',
    }))
  }

  /**
   * Build a tree structure for folder-based display.
   * Returns { folders: [{name, path, children}], files: [{path, ...}] }
   */
  get fileTree() {
    const items = this.filteredFiles
    const tree = { folders: {}, files: [] }

    // Collect all dirs that should be shown
    const visibleDirs = new Set()
    for (const item of items) {
      const parts = item.path.split('/')
      if (parts.length > 1) {
        let acc = ''
        for (let i = 0; i < parts.length - 1; i++) {
          acc = acc ? acc + '/' + parts[i] : parts[i]
          visibleDirs.add(acc)
        }
      }
    }

    // Also add dirs that exist on disk even if empty (so user can see them)
    for (const d of this.dirs) {
      // Only add top-level empty dirs when not searching/filtering
      if (!this.searchQuery && !this.activeFilter) {
        visibleDirs.add(d)
      }
    }

    return { items, visibleDirs: [...visibleDirs].sort() }
  }

  get fileCounts() {
    const counts = { '': 0 }
    for (const s of this.statuses) counts[s.id] = 0
    let total = 0
    for (const [path] of this.files) {
      const m = this.getMeta(path)
      total++
      const sid = m.status || ''
      if (sid in counts) counts[sid]++
      else counts['']++
    }
    counts._total = total
    return counts
  }

  // ── Meta helpers ─────────────────────────────────────────────────────────

  getMeta(path) {
    return this.meta[path] || { status: '', quality: 0 }
  }

  async patchMeta(path, patch) {
    this.meta = { ...this.meta, [path]: { ...this.getMeta(path), ...patch } }
    await this.saveMeta()
  }

  statusColor(id) {
    if (!id) return '#444'
    const s = this.statuses.find((s) => s.id === id)
    return s ? s.color : '#444'
  }

  // ── File name helpers ──────────────────────────────────────────────────

  topFolder(relPath) {
    const tops = [...this.dirs].filter((k) => !k.includes('/'))
    for (const t of tops) {
      if (relPath === t || relPath.startsWith(t + '/')) return t
    }
    return '(root)'
  }

  displayName(relPath) {
    const stem = relPath.endsWith('.md') ? relPath.slice(0, -3) : relPath
    const parts = stem.split('/')
    return parts[parts.length - 1]
  }

  folderOf(relPath) {
    const parts = relPath.split('/')
    if (parts.length <= 1) return ''
    return parts.slice(0, -1).join('/')
  }

  // ── Actions ──────────────────────────────────────────────────────────────

  async openRoot() {
    this.rootPath = await api.getRootPath()
    await this.scanAll()
    await this.loadMeta()
    await this.scanStories()
    await this.loadStoryMeta()
    this.#showApp()
  }

  async scanAll() {
    const result = await api.scanDirectory()
    const newFiles = new Map()
    for (const rel of Object.keys(result.files)) {
      // Exclude _stories/ files from poetry view
      if (rel.startsWith('_stories/')) continue
      newFiles.set(rel, result.files[rel])
    }
    this.files = newFiles
    const newDirs = new Set()
    for (const rel of Object.keys(result.dirs)) {
      if (rel.startsWith('_stories')) continue
      newDirs.add(rel)
    }
    this.dirs = newDirs
  }

  async loadMeta() {
    try {
      const text = await api.readFile(this.rootPath + '/poems-meta.json')
      this.meta = text.trim() ? JSON.parse(text) : {}
    } catch {
      this.meta = {}
    }

    // Migrate old per-status _fileOrder to flat array
    if (this.meta._fileOrder && !Array.isArray(this.meta._fileOrder)) {
      const oldOrder = this.meta._fileOrder
      const flat = []
      for (const list of Object.values(oldOrder)) {
        if (Array.isArray(list)) {
          for (const p of list) {
            if (!flat.includes(p)) flat.push(p)
          }
        }
      }
      this.meta = { ...this.meta, _fileOrder: flat }
      await this.saveMeta()
    }

    // Clean up old migration fields
    if (this.meta._doneOrder || this.meta._noStatusPosition !== undefined) {
      const newMeta = { ...this.meta }
      delete newMeta._doneOrder
      delete newMeta._noStatusPosition
      this.meta = newMeta
      await this.saveMeta()
    }
  }

  async saveMeta() {
    await api.writeFile(
      this.rootPath + '/poems-meta.json',
      JSON.stringify(this.meta, null, 2),
    )
  }

  // ── File ordering (flat list, independent of status) ───────────────────

  async reorderFile(fromPath, toPath) {
    const fileOrder = [...(this.meta._fileOrder || [])]
    const allPaths = [...this.files.keys()]

    // Ensure both paths are in the order list
    for (const p of allPaths) {
      if (!fileOrder.includes(p)) fileOrder.push(p)
    }

    const fromIdx = fileOrder.indexOf(fromPath)
    const toIdx = fileOrder.indexOf(toPath)
    if (fromIdx === -1 || toIdx === -1) return

    fileOrder.splice(fromIdx, 1)
    fileOrder.splice(toIdx, 0, fromPath)

    this.meta = { ...this.meta, _fileOrder: fileOrder }
    await this.saveMeta()
  }

  async moveFileToFolder(filePath, targetFolder) {
    const fileName = filePath.split('/').pop()
    const newPath = targetFolder ? targetFolder + '/' + fileName : fileName

    if (newPath === filePath) return

    // Move on disk
    await api.moveFile(filePath, newPath)

    // Update metadata key
    const m = this.getMeta(filePath)
    const newMeta = { ...this.meta }
    delete newMeta[filePath]
    newMeta[newPath] = m

    // Update file order
    if (Array.isArray(newMeta._fileOrder)) {
      newMeta._fileOrder = newMeta._fileOrder.map((p) =>
        p === filePath ? newPath : p,
      )
    }

    this.meta = newMeta
    await this.saveMeta()
    await this.scanAll()
  }

  async createFolder(name) {
    await api.createFolder(name)
    await this.scanAll()
  }

  async renameFolderOnDisk(oldPath, newPath) {
    await api.renameFolder(oldPath, newPath)

    // Update all metadata keys that start with oldPath/
    const newMeta = { ...this.meta }
    const prefix = oldPath + '/'
    for (const [key, val] of Object.entries(newMeta)) {
      if (key === oldPath || key.startsWith(prefix)) {
        const newKey = newPath + key.slice(oldPath.length)
        newMeta[newKey] = val
        delete newMeta[key]
      }
    }

    // Update file order
    if (Array.isArray(newMeta._fileOrder)) {
      newMeta._fileOrder = newMeta._fileOrder.map((p) => {
        if (p === oldPath || p.startsWith(prefix)) {
          return newPath + p.slice(oldPath.length)
        }
        return p
      })
    }

    this.meta = newMeta
    await this.saveMeta()
    await this.scanAll()
  }

  migrateStatusIds(oldStatuses, newStatuses) {
    const idMap = {}
    for (let i = 0; i < oldStatuses.length; i++) {
      const oldId = oldStatuses[i].id
      const newId = newStatuses[i]?.id
      if (oldId && newId && oldId !== newId) {
        idMap[oldId] = newId
      }
    }
    if (Object.keys(idMap).length === 0) return

    const newMeta = { ...this.meta }

    for (const [path, data] of Object.entries(newMeta)) {
      if (path.startsWith('_')) continue
      if (data.status && idMap[data.status]) {
        newMeta[path] = { ...data, status: idMap[data.status] }
      }
    }

    this.meta = newMeta
  }

  // ── Stories ─────────────────────────────────────────────────────────────

  stories = $state(new Map()) // storyName -> { files: [...] }
  storyMeta = $state({})
  activeStory = $state(null) // currently expanded story folder name

  get storyList() {
    const order = this.storyMeta._storyOrder || []
    const all = [...this.stories.keys()]
    const ordered = order.filter((n) => this.stories.has(n))
    const rest = all.filter((n) => !order.includes(n)).sort()
    return [...ordered, ...rest]
  }

  getStoryFiles(storyName) {
    return this.stories.get(storyName) || []
  }

  getStoryChapters(storyName) {
    const files = this.getStoryFiles(storyName)
    return files.filter((f) => !f.startsWith('_'))
  }

  async scanStories() {
    const result = await api.scanDirectory()
    const storyMap = new Map()

    for (const rel of Object.keys(result.files)) {
      if (!rel.startsWith('_stories/')) continue
      const rest = rel.slice('_stories/'.length)
      const slash = rest.indexOf('/')
      if (slash === -1) continue
      const storyName = rest.slice(0, slash)
      const fileName = rest.slice(slash + 1)
      if (!storyMap.has(storyName)) storyMap.set(storyName, [])
      storyMap.get(storyName).push(fileName)
    }

    // Sort files within each story: _plot.md first, _bible.md second, rest sorted
    for (const [name, files] of storyMap) {
      files.sort((a, b) => {
        if (a === '_plot.md') return -1
        if (b === '_plot.md') return 1
        if (a === '_bible.md') return -1
        if (b === '_bible.md') return 1
        return a.localeCompare(b)
      })
    }

    this.stories = storyMap
  }

  async loadStoryMeta() {
    try {
      const text = await api.readFile(this.rootPath + '/stories-meta.json')
      this.storyMeta = text.trim() ? JSON.parse(text) : {}
    } catch {
      this.storyMeta = {}
    }
  }

  async saveStoryMeta() {
    await api.writeFile(
      this.rootPath + '/stories-meta.json',
      JSON.stringify(this.storyMeta, null, 2),
    )
  }

  async patchStoryMeta(storyName, patch) {
    this.storyMeta = {
      ...this.storyMeta,
      [storyName]: { ...(this.storyMeta[storyName] || {}), ...patch },
    }
    await this.saveStoryMeta()
  }

  async createStory(name) {
    const slug = slugify(name)
    if (!slug) return
    await api.createStory(slug)

    // Add to order
    const order = [...(this.storyMeta._storyOrder || []), slug]
    this.storyMeta = {
      ...this.storyMeta,
      _storyOrder: order,
      [slug]: { status: 'new', created: Date.now() },
    }
    await this.saveStoryMeta()
    await this.scanStories()
    this.activeStory = slug
  }

  async deleteStory(storyName) {
    await api.deleteFolder(this.rootPath + '/_stories/' + storyName)

    const newMeta = { ...this.storyMeta }
    delete newMeta[storyName]
    if (Array.isArray(newMeta._storyOrder)) {
      newMeta._storyOrder = newMeta._storyOrder.filter((n) => n !== storyName)
    }
    this.storyMeta = newMeta
    await this.saveStoryMeta()
    await this.scanStories()
    if (this.activeStory === storyName) this.activeStory = null
  }

  async addChapter(storyName, chapterName) {
    const fileName = chapterName.endsWith('.md') ? chapterName : chapterName + '.md'
    const filePath = this.rootPath + '/_stories/' + storyName + '/' + fileName
    await api.writeFile(filePath, '')
    await this.scanStories()
  }

  storyFilePath(storyName, fileName) {
    return '_stories/' + storyName + '/' + fileName
  }

  // ── Search (debounced, server-side body search) ─────────────────────────

  triggerSearch(query) {
    clearTimeout(this.#searchTimer)
    if (!query.trim()) {
      this.searchMatches = null
      return
    }
    this.#searchTimer = setTimeout(async () => {
      try {
        const matches = await api.searchFiles(query)
        if (this.searchQuery === query) {
          this.searchMatches = new Set(matches)
        }
      } catch {
        this.searchMatches = null
      }
    }, 250)
  }

  // ── App visibility ─────────────────────────────────────────────────────

  onShowApp(cb) {
    this.#showAppCallback = cb
  }
  #showApp() {
    if (this.#showAppCallback) this.#showAppCallback()
  }
}

export const project = new ProjectStore()
