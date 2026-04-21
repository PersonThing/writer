/**
 * Project store — files, metadata, statuses.
 * Status/quality live on the file row in Postgres (returned by scan-directory).
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
  files = $state(new Map()) // path -> { status, quality, modified, created }
  dirs = $state(new Set())
  statusList = $state([...DEFAULT_STATUSES])
  searchQuery = $state('')
  searchMatches = $state(null)
  activeFilter = $state('')
  sortMode = $state('my') // 'my' | 'status'

  #showAppCallback = null
  #searchTimer = 0

  // ── Derived ──────────────────────────────────────────────────────────────
  get statuses() {
    return this.statusList
  }

  get filteredFiles() {
    let allPaths = [...this.files.keys()]

    if (this.searchQuery && this.searchMatches) {
      allPaths = allPaths.filter((p) => this.searchMatches.has(p))
    } else if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase()
      allPaths = allPaths.filter((p) =>
        this.displayName(p).toLowerCase().includes(q),
      )
    }

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

    const statusOrder = new Map()
    this.statuses.forEach((s, i) => statusOrder.set(s.id, i))

    if (this.sortMode === 'status') {
      // Group by status (in status-list order), then by explicit sort.
      allPaths.sort((a, b) => {
        const sa = this.getMeta(a).status || ''
        const sb = this.getMeta(b).status || ''
        const oa = sa ? (statusOrder.get(sa) ?? 999) : 1000
        const ob = sb ? (statusOrder.get(sb) ?? 999) : 1000
        if (oa !== ob) return oa - ob
        const soa = this.files.get(a)?.sortOrder ?? 0
        const sob = this.files.get(b)?.sortOrder ?? 0
        if (soa !== sob) return soa - sob
        return this.displayName(a).localeCompare(this.displayName(b))
      })
    } else {
      // 'my' — user-defined explicit order; alphabetical is the fallback
      // for any zero-valued ties.
      allPaths.sort((a, b) => {
        const soa = this.files.get(a)?.sortOrder ?? 0
        const sob = this.files.get(b)?.sortOrder ?? 0
        if (soa !== sob) return soa - sob
        return this.displayName(a).localeCompare(this.displayName(b))
      })
    }

    return allPaths.map((p) => ({
      path: p,
      color: this.statusColor(this.getMeta(p).status || ''),
      statusId: this.getMeta(p).status || '',
    }))
  }

  get fileTree() {
    const items = this.filteredFiles
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
    for (const d of this.dirs) {
      if (!this.searchQuery && !this.activeFilter) visibleDirs.add(d)
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
    const row = this.files.get(path)
    return row
      ? { status: row.status || '', quality: row.quality || 0 }
      : { status: '', quality: 0 }
  }

  async patchMeta(path, patch) {
    // Optimistic local update
    const cur = this.files.get(path) || {}
    const next = new Map(this.files)
    next.set(path, { ...cur, ...patch })
    this.files = next
    await api.setMeta(path, patch)
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

  async init() {
    await this.loadStatuses()
    await this.scanAll()
    await this.scanStories()
    this.#showApp()
  }

  async loadStatuses() {
    try {
      const rows = await api.getStatuses()
      this.statusList = rows.length ? rows : [...DEFAULT_STATUSES]
    } catch {
      this.statusList = [...DEFAULT_STATUSES]
    }
  }

  async saveStatuses(statuses) {
    await api.saveStatuses(statuses)
    this.statusList = statuses
  }

  async scanAll() {
    const result = await api.scanDirectory()
    const newFiles = new Map()
    for (const rel of Object.keys(result.files)) {
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

  // ── Moves / renames ────────────────────────────────────────────────────

  async moveFileToFolder(filePath, targetFolder) {
    const fileName = filePath.split('/').pop()
    const newPath = targetFolder ? targetFolder + '/' + fileName : fileName
    if (newPath === filePath) return
    await api.moveFile(filePath, newPath)
    await this.scanAll()
  }

  async createFolder(name) {
    await api.createFolder(name)
    await this.scanAll()
  }

  /**
   * Set the explicit user order for the given list of file paths.
   * The paths are renumbered with sortOrder values 10, 20, 30… in the
   * order provided. Typically called with the siblings of one folder
   * bucket after a drag-reorder drop.
   */
  async reorderFiles(paths) {
    if (!Array.isArray(paths) || paths.length < 2) return
    // Optimistic update so the UI doesn't snap back while the server
    // roundtrips — mirrors the spacing the server applies.
    const next = new Map(this.files)
    paths.forEach((p, i) => {
      const row = next.get(p)
      if (row) next.set(p, { ...row, sortOrder: (i + 1) * 10 })
    })
    this.files = next
    try {
      await api.reorderFiles(paths)
    } catch (e) {
      // Pull fresh truth on failure so we don't diverge.
      await this.scanAll()
      throw e
    }
  }

  async renameFolderOnDisk(oldPath, newPath) {
    await api.renameFolder(oldPath, newPath)
    await this.scanAll()
  }

  // ── Stories ─────────────────────────────────────────────────────────────

  stories = $state(new Map()) // storySlug -> [fileName, ...]
  activeStory = $state(null)

  get storyList() {
    return [...this.stories.keys()].sort()
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

    for (const [, files] of storyMap) {
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

  async createStory(name) {
    const slug = slugify(name)
    if (!slug) return
    await api.createStory(name)
    await this.scanStories()
    this.activeStory = slug
  }

  async deleteStory(storyName) {
    await api.deleteFolder('_stories/' + storyName)
    await this.scanStories()
    if (this.activeStory === storyName) this.activeStory = null
  }

  async addChapter(storyName, chapterName) {
    const fileName = chapterName.endsWith('.md')
      ? chapterName
      : chapterName + '.md'
    const filePath = '_stories/' + storyName + '/' + fileName
    await api.writeFile(filePath, '')
    await this.scanStories()
  }

  storyFilePath(storyName, fileName) {
    return '_stories/' + storyName + '/' + fileName
  }

  // ── Search ─────────────────────────────────────────────────────────────

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
