/**
 * Project store — files, metadata, statuses, grouped files.
 * Uses Svelte 5 class pattern: $state fields + $derived fields + methods.
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
  activeFilter = $state('')

  #showAppCallback = null

  // ── Derived ──────────────────────────────────────────────────────────────
  get statuses() {
    return this.meta._statuses || DEFAULT_STATUSES
  }

  get groupedFiles() {
    let allPaths = [...this.files.keys()]

    // Apply search filter
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase()
      allPaths = allPaths.filter((p) =>
        this.displayName(p).toLowerCase().includes(q),
      )
    }

    const pathSet = new Set(allPaths)
    const fileOrder = this.meta._fileOrder || {}

    // Build groups in status config order
    const groups = this.statuses.map((s) => {
      const matching = allPaths.filter(
        (p) => (this.getMeta(p).status || '') === s.id,
      )
      const orderedList = fileOrder[s.id] || []
      const ordered = orderedList.filter(
        (p) => pathSet.has(p) && matching.includes(p),
      )
      const orderedSet = new Set(ordered)
      const remaining = matching.filter((p) => !orderedSet.has(p))
      remaining.sort((a, b) =>
        this.displayName(a).localeCompare(this.displayName(b)),
      )

      return {
        id: s.id,
        label: s.label,
        color: s.color,
        files: [...ordered, ...remaining],
        count: matching.length,
      }
    })

    // "No Status" group — insert at configured position
    const knownIds = new Set(this.statuses.map((s) => s.id))
    const noStatus = allPaths.filter((p) => {
      const sid = this.getMeta(p).status || ''
      return sid === '' || !knownIds.has(sid)
    })
    const noOrderedList = fileOrder[''] || []
    const noOrdered = noOrderedList.filter(
      (p) => pathSet.has(p) && noStatus.includes(p),
    )
    const noOrderedSet = new Set(noOrdered)
    const noRemaining = noStatus.filter((p) => !noOrderedSet.has(p))
    noRemaining.sort((a, b) =>
      this.displayName(a).localeCompare(this.displayName(b)),
    )

    const noStatusGroup = {
      id: '',
      label: 'No Status',
      color: '#444',
      files: [...noOrdered, ...noRemaining],
      count: noStatus.length,
    }

    const pos = this.meta._noStatusPosition ?? groups.length
    const clamped = Math.max(0, Math.min(pos, groups.length))
    groups.splice(clamped, 0, noStatusGroup)

    return groups
  }

  get filteredFiles() {
    const groups = this.groupedFiles
    let result = []

    if (this.activeFilter === 'social') {
      // Show social files across all groups, preserving status order
      for (const g of groups) {
        for (const path of g.files) {
          if (this.getMeta(path).social) {
            result.push({ path, color: g.color, statusId: g.id })
          }
        }
      }
    } else if (this.activeFilter === '_none') {
      // Show only no-status group
      const g = groups.find((g) => g.id === '')
      if (g) {
        for (const path of g.files) {
          result.push({ path, color: g.color, statusId: g.id })
        }
      }
    } else if (this.activeFilter) {
      // Show only matching status group
      const g = groups.find((g) => g.id === this.activeFilter)
      if (g) {
        for (const path of g.files) {
          result.push({ path, color: g.color, statusId: g.id })
        }
      }
    } else {
      // All files, flattened in status order
      for (const g of groups) {
        for (const path of g.files) {
          result.push({ path, color: g.color, statusId: g.id })
        }
      }
    }

    return result
  }

  get fileCounts() {
    const counts = { '': 0, social: 0 }
    for (const s of this.statuses) counts[s.id] = 0
    let total = 0
    for (const [path] of this.files) {
      const m = this.getMeta(path)
      total++
      const sid = m.status || ''
      if (sid in counts) counts[sid]++
      else counts['']++
      if (m.social) counts.social++
    }
    counts._total = total
    return counts
  }

  // ── Meta helpers ─────────────────────────────────────────────────────────

  getMeta(path) {
    return this.meta[path] || { status: '', quality: 0, social: false }
  }

  async patchMeta(path, patch) {
    if ('status' in patch) {
      const oldStatus = this.getMeta(path).status || ''
      const newStatus = patch.status || ''
      if (oldStatus !== newStatus) {
        this.#syncFileOrder(path, oldStatus, newStatus)
      }
    }
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

  // ── Actions ──────────────────────────────────────────────────────────────

  async openRoot(dirPath) {
    this.rootPath = dirPath
    await this.scanAll()
    await this.loadMeta()
    this.#showApp()
  }

  async scanAll() {
    const result = await api.scanDirectory(this.rootPath)
    const newFiles = new Map()
    for (const rel of Object.keys(result.files)) {
      newFiles.set(rel, result.files[rel])
    }
    this.files = newFiles
    const newDirs = new Set()
    for (const rel of Object.keys(result.dirs)) {
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

    // Migrate _doneOrder → _fileOrder (one-time)
    if (Array.isArray(this.meta._doneOrder) && !this.meta._fileOrder) {
      const fileOrder = { done: [...this.meta._doneOrder] }
      const newMeta = { ...this.meta, _fileOrder: fileOrder }
      delete newMeta._doneOrder
      this.meta = newMeta
      await this.saveMeta()
    } else if (Array.isArray(this.meta._doneOrder)) {
      const newMeta = { ...this.meta }
      delete newMeta._doneOrder
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

  // ── File Order (per-group ordering) ───────────────────────────────────

  #syncFileOrder(path, oldStatus, newStatus) {
    const fileOrder = { ...(this.meta._fileOrder || {}) }

    // Remove from old group
    const oldKey = oldStatus || ''
    if (Array.isArray(fileOrder[oldKey])) {
      fileOrder[oldKey] = fileOrder[oldKey].filter((p) => p !== path)
    }

    // Add to end of new group
    const newKey = newStatus || ''
    if (!Array.isArray(fileOrder[newKey])) fileOrder[newKey] = []
    if (!fileOrder[newKey].includes(path)) {
      fileOrder[newKey].push(path)
    }

    this.meta = { ...this.meta, _fileOrder: fileOrder }
  }

  async reorderInGroup(statusId, fromPath, toPath) {
    const key = statusId || ''
    const fileOrder = { ...(this.meta._fileOrder || {}) }

    // Snapshot current rendered order for this group
    const group = this.groupedFiles.find((g) => g.id === statusId)
    let list = group ? [...group.files] : []

    const fromIdx = list.indexOf(fromPath)
    const toIdx = list.indexOf(toPath)
    if (fromIdx === -1 || toIdx === -1) return

    list.splice(fromIdx, 1)
    list.splice(toIdx, 0, fromPath)

    fileOrder[key] = list
    this.meta = { ...this.meta, _fileOrder: fileOrder }
    await this.saveMeta()
  }

  async moveToGroup(path, targetStatusId, beforePath) {
    const oldStatus = this.getMeta(path).status || ''
    const newStatus = targetStatusId ?? ''
    const fileOrder = { ...(this.meta._fileOrder || {}) }

    // Remove from old group's file order
    const oldKey = oldStatus || ''
    if (Array.isArray(fileOrder[oldKey])) {
      fileOrder[oldKey] = fileOrder[oldKey].filter((p) => p !== path)
    }

    // Get target group's current rendered list
    const targetGroup = this.groupedFiles.find((g) => g.id === targetStatusId)
    let targetList = targetGroup ? [...targetGroup.files] : []
    // Remove in case it's somehow already there
    targetList = targetList.filter((p) => p !== path)

    // Insert at position
    if (beforePath) {
      const idx = targetList.indexOf(beforePath)
      if (idx !== -1) {
        targetList.splice(idx, 0, path)
      } else {
        targetList.push(path)
      }
    } else {
      targetList.push(path)
    }

    const newKey = newStatus || ''
    fileOrder[newKey] = targetList

    // Update status + file order + save in one go
    const updatedMeta = {
      ...this.meta,
      _fileOrder: fileOrder,
      [path]: { ...this.getMeta(path), status: newStatus },
    }
    this.meta = updatedMeta
    await this.saveMeta()
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

    // Update file metadata status fields
    for (const [path, data] of Object.entries(newMeta)) {
      if (path.startsWith('_')) continue
      if (data.status && idMap[data.status]) {
        newMeta[path] = { ...data, status: idMap[data.status] }
      }
    }

    // Update _fileOrder keys
    if (newMeta._fileOrder) {
      const newFileOrder = {}
      for (const [key, list] of Object.entries(newMeta._fileOrder)) {
        const newKey = idMap[key] !== undefined ? idMap[key] : key
        newFileOrder[newKey] = list
      }
      newMeta._fileOrder = newFileOrder
    }

    this.meta = newMeta
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
