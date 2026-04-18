<script>
  import * as api from '../lib/api.js'
  import { project } from '../lib/stores/project.svelte.js'
  import { editor } from '../lib/stores/editor.svelte.js'
  import { showContextMenu, modalPrompt, modalAlert, showToast } from '../lib/stores/ui.svelte.js'
  import { iconGripDots } from '../lib/icons.js'

  let draggedPath = $state(null)
  let dragOverFolder = $state(null)
  let externalDragActive = $state(false)
  let renamingPath = $state(null)
  let renameValue = $state('')
  let renamingFolder = $state(null)
  let renameFolderValue = $state('')
  let collapsedFolders = $state(new Set())

  const ALLOWED_EXTS = ['md', 'txt', 'docx']
  function extOf(name) {
    const i = name.lastIndexOf('.')
    return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
  }
  function isAllowedFile(file) {
    return ALLOWED_EXTS.includes(extOf(file.name))
  }
  function hasExternalFiles(e) {
    return Array.from(e.dataTransfer?.types || []).includes('Files')
  }

  // Build tree from filteredFiles
  let tree = $derived.by(() => {
    const items = project.filteredFiles
    const folders = new Map() // folderPath → [items]
    const rootFiles = []

    for (const item of items) {
      const folder = project.folderOf(item.path)
      if (folder) {
        if (!folders.has(folder)) folders.set(folder, [])
        folders.get(folder).push(item)
      } else {
        rootFiles.push(item)
      }
    }

    // Add empty dirs (only when not searching)
    if (!project.searchQuery && !project.activeFilter) {
      for (const d of project.dirs) {
        if (!d.includes('/') && !folders.has(d)) {
          folders.set(d, [])
        }
      }
    }

    // Sort folder names
    const sortedFolders = [...folders.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )

    return { folders: sortedFolders, rootFiles }
  })

  function handleClick(e, path) {
    if (e.target.closest('.drag-grip')) return
    if (e.target.closest('.rename-input')) return
    const newPane = e.ctrlKey || e.metaKey
    editor.openFile(path, { newPane })
  }

  function handleContext(e, path) {
    e.preventDefault()
    showContextMenu(e.clientX, e.clientY, path)
  }

  function isCurrentFile(path) {
    return editor.panes.some(
      (p) => p.id === editor.activePaneId && p.filePath === path,
    )
  }

  function isOpenInPane(path) {
    return editor.panes.some((p) => p.filePath === path)
  }

  function isDirtyFile(path) {
    const pane = editor.panes.find((p) => p.filePath === path)
    return pane ? pane.dirty : false
  }

  // ── Drag & drop for reordering and moving to folders ─────────────────

  function handleDragStart(e, path) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', path)
    // Delay state update so Svelte doesn't re-render and kill the drag
    requestAnimationFrame(() => {
      draggedPath = path
    })
  }

  function handleDragEnd(e) {
    draggedPath = null
    dragOverFolder = null
  }

  function handleDragOverFolder(e, folderPath) {
    e.preventDefault()
    e.dataTransfer.dropEffect = hasExternalFiles(e) ? 'copy' : 'move'
    dragOverFolder = folderPath
  }

  async function handleDropOnFolder(e, folderPath) {
    e.preventDefault()

    // External drop from Finder/Explorer
    if (hasExternalFiles(e) && e.dataTransfer.files?.length) {
      const files = Array.from(e.dataTransfer.files)
      const accepted = files.filter(isAllowedFile)
      const rejected = files.filter((f) => !isAllowedFile(f))
      dragOverFolder = null
      externalDragActive = false

      if (rejected.length) {
        await modalAlert(
          `Skipped ${rejected.length} unsupported file(s):\n` +
            rejected.map((f) => f.name).join('\n') +
            `\n\nAllowed: .${ALLOWED_EXTS.join(', .')}`,
        )
      }
      if (!accepted.length) return

      try {
        const results = await api.uploadFiles(accepted, folderPath)
        await project.scanAll()
        const saved = results.filter((r) => r.saved).length
        const errors = results.filter((r) => r.error && !r.skipped)
        if (saved) showToast(`Uploaded ${saved} file${saved === 1 ? '' : 's'}`)
        if (errors.length) {
          await modalAlert(
            'Errors:\n' + errors.map((r) => `${r.original}: ${r.error}`).join('\n'),
          )
        }
      } catch (err) {
        await modalAlert('Upload failed: ' + err.message)
      }
      return
    }

    // Internal drop — moving an existing file between folders
    if (!draggedPath) return
    const currentFolder = project.folderOf(draggedPath)
    if (currentFolder === folderPath) {
      draggedPath = null
      dragOverFolder = null
      return
    }
    await project.moveFileToFolder(draggedPath, folderPath)
    const fileName = draggedPath.split('/').pop()
    const newPath = folderPath ? folderPath + '/' + fileName : fileName
    editor.panes = editor.panes.map((p) => {
      if (p.filePath === draggedPath) {
        return { ...p, filePath: newPath }
      }
      return p
    })
    draggedPath = null
    dragOverFolder = null
  }

  // ── External file drag (Finder/Explorer) ─────────────────────────────

  function handleListDragOver(e) {
    if (hasExternalFiles(e)) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      externalDragActive = true
    }
  }
  function handleListDragLeave(e) {
    // Only clear when leaving the list entirely (relatedTarget outside)
    if (!e.currentTarget.contains(e.relatedTarget)) {
      externalDragActive = false
      dragOverFolder = null
    }
  }
  function handleListDrop(e) {
    // Fallback: dropped on empty sidebar space → treat as root drop
    if (hasExternalFiles(e) && e.dataTransfer.files?.length) {
      handleDropOnFolder(e, '')
    }
  }

  // ── Rename files inline ──────────────────────────────────────────────

  function startRename(path) {
    renamingPath = path
    renameValue = project.displayName(path)
  }

  async function commitRename(path) {
    const newName = renameValue.trim()
    if (!newName || newName === project.displayName(path)) {
      renamingPath = null
      return
    }

    const folder = project.folderOf(path)
    const newFileName = newName.endsWith('.md') ? newName : newName + '.md'
    const newPath = folder ? folder + '/' + newFileName : newFileName

    try {
      await api.renameFile(
        project.rootPath + '/' + path,
        project.rootPath + '/' + newPath,
      )
      // Update metadata
      const m = project.getMeta(path)
      await project.patchMeta(newPath, { ...m, modified: Date.now() })
      // Update open pane
      editor.panes = editor.panes.map((p) => {
        if (p.filePath === path) return { ...p, filePath: newPath, pendingRename: null }
        return p
      })
      await project.scanAll()
    } catch (e) {
      modalAlert('Rename failed: ' + e.message)
    }
    renamingPath = null
  }

  function handleRenameKeydown(e, path) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitRename(path)
    }
    if (e.key === 'Escape') {
      renamingPath = null
    }
  }

  // ── Rename folders inline ────────────────────────────────────────────

  function startFolderRename(folderPath) {
    renamingFolder = folderPath
    renameFolderValue = folderPath.split('/').pop()
  }

  async function commitFolderRename(oldPath) {
    const newName = renameFolderValue.trim()
    const oldName = oldPath.split('/').pop()
    if (!newName || newName === oldName) {
      renamingFolder = null
      return
    }

    const parts = oldPath.split('/')
    parts[parts.length - 1] = newName
    const newPath = parts.join('/')

    try {
      await project.renameFolderOnDisk(oldPath, newPath)
      // Update open panes
      editor.panes = editor.panes.map((p) => {
        if (p.filePath.startsWith(oldPath + '/')) {
          return { ...p, filePath: newPath + p.filePath.slice(oldPath.length) }
        }
        return p
      })
    } catch (e) {
      modalAlert('Folder rename failed: ' + e.message)
    }
    renamingFolder = null
  }

  function handleFolderRenameKeydown(e, folderPath) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitFolderRename(folderPath)
    }
    if (e.key === 'Escape') {
      renamingFolder = null
    }
  }

  // ── Collapse/expand ──────────────────────────────────────────────────

  function toggleFolder(folderPath) {
    const next = new Set(collapsedFolders)
    if (next.has(folderPath)) next.delete(folderPath)
    else next.add(folderPath)
    collapsedFolders = next
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="file-list"
  class:is-dragging={draggedPath || externalDragActive}
  ondragover={handleListDragOver}
  ondragleave={handleListDragLeave}
  ondrop={handleListDrop}
>
  <!-- Root drop zone (top) — always rendered, shown via CSS when dragging -->
  <div
    class="root-drop-zone"
    class:visible={draggedPath || externalDragActive}
    class:drag-over-folder={dragOverFolder === '_root'}
    ondragover={(e) => handleDragOverFolder(e, '_root')}
    ondragleave={() => { if (dragOverFolder === '_root') dragOverFolder = null }}
    ondrop={(e) => handleDropOnFolder(e, '')}
  >{externalDragActive ? 'Drop files to import' : 'Move to root'}</div>

  <!-- Folders -->
  {#each tree.folders as [folderPath, folderItems]}
    {@const folderName = folderPath.split('/').pop()}
    {@const isCollapsed = collapsedFolders.has(folderPath)}
    <div
      class="folder-header"
      class:drag-over-folder={dragOverFolder === folderPath}
      ondragover={(e) => handleDragOverFolder(e, folderPath)}
      ondragleave={() => { if (dragOverFolder === folderPath) dragOverFolder = null }}
      ondrop={(e) => handleDropOnFolder(e, folderPath)}
    >
      <button class="folder-toggle" onclick={() => toggleFolder(folderPath)}>
        {isCollapsed ? '▸' : '▾'}
      </button>
      {#if renamingFolder === folderPath}
        <input
          class="rename-input"
          type="text"
          bind:value={renameFolderValue}
          onblur={() => commitFolderRename(folderPath)}
          onkeydown={(e) => handleFolderRenameKeydown(e, folderPath)}
          autofocus
        />
      {:else}
        <span
          class="folder-name"
          ondblclick={() => startFolderRename(folderPath)}
        >{folderName}</span>
      {/if}
      <span class="folder-count">{folderItems.length}</span>
    </div>

    {#if !isCollapsed}
      {#each folderItems as item}
        {@const dname = project.displayName(item.path)}
        {@const isCur = isCurrentFile(item.path)}
        {@const isOpen = isOpenInPane(item.path)}
        {@const isDirty = isDirtyFile(item.path)}
        <div
          class="file-item indented"
          class:current={isCur}
          class:open={isOpen && !isCur}
          class:dragging={draggedPath === item.path}
          draggable="true"
          role="button"
          tabindex="0"
          ondragstart={(e) => handleDragStart(e, item.path)}
          ondragend={handleDragEnd}
          onclick={(e) => handleClick(e, item.path)}
          oncontextmenu={(e) => handleContext(e, item.path)}
          onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, item.path) }}
        >
          <span class="drag-grip">{@html iconGripDots(10)}</span>
          <span class="s-dot" style="background: {item.color}"></span>
          {#if renamingPath === item.path}
            <input
              class="rename-input"
              type="text"
              bind:value={renameValue}
              onblur={() => commitRename(item.path)}
              onkeydown={(e) => handleRenameKeydown(e, item.path)}
              onclick={(e) => e.stopPropagation()}
              autofocus
            />
          {:else}
            <span class="file-name" title={dname} ondblclick={() => startRename(item.path)}>
              {dname}
              {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
            </span>
          {/if}
          <span class="item-badges">
            <span class="p-dots">
              {#each Array(5) as _, i}
                {@const m = project.getMeta(item.path)}
                <span class="p-dot" class:on={i < m.quality}></span>
              {/each}
            </span>
          </span>
        </div>
      {/each}
    {/if}
  {/each}

  <!-- Root-level files -->
  {#each tree.rootFiles as item}
    {@const dname = project.displayName(item.path)}
    {@const isCur = isCurrentFile(item.path)}
    {@const isOpen = isOpenInPane(item.path)}
    {@const isDirty = isDirtyFile(item.path)}
    <div
      class="file-item"
      class:current={isCur}
      class:open={isOpen && !isCur}
      class:dragging={draggedPath === item.path}
      draggable="true"
      role="button"
      tabindex="0"
      ondragstart={(e) => handleDragStart(e, item.path)}
      ondragend={handleDragEnd}
      onclick={(e) => handleClick(e, item.path)}
      oncontextmenu={(e) => handleContext(e, item.path)}
      onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, item.path) }}
    >
      <span class="drag-grip">{@html iconGripDots(10)}</span>
      <span class="s-dot" style="background: {item.color}"></span>
      {#if renamingPath === item.path}
        <input
          class="rename-input"
          type="text"
          bind:value={renameValue}
          onblur={() => commitRename(item.path)}
          onkeydown={(e) => handleRenameKeydown(e, item.path)}
          onclick={(e) => e.stopPropagation()}
          autofocus
        />
      {:else}
        <span class="file-name" title={dname} ondblclick={() => startRename(item.path)}>
          {dname}
          {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
        </span>
      {/if}
      <span class="item-badges">
        <span class="p-dots">
          {#each Array(5) as _, i}
            {@const m = project.getMeta(item.path)}
            <span class="p-dot" class:on={i < m.quality}></span>
          {/each}
        </span>
      </span>
    </div>
  {/each}

  {#if project.filteredFiles.length === 0 && project.searchQuery}
    <div class="empty">No poems match.</div>
  {/if}
</div>

<style>
  .file-list {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }
  .file-list::-webkit-scrollbar {
    width: 6px;
  }
  .file-list::-webkit-scrollbar-thumb {
    background: #555;
    border-radius: 2px;
  }

  .empty {
    padding: 1rem 1.2rem;
    color: #555;
    font-size: 0.82rem;
    font-style: italic;
  }

  /* ── Root drop zone ───────────────────────────────────────────────── */
  .root-drop-zone {
    padding: 0.4rem 0.75rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #555;
    border: 2px dashed #444;
    border-radius: 4px;
    margin: 0.4rem 0.6rem;
    text-align: center;
    transition: all 0.15s;
    display: none;
  }
  .root-drop-zone.visible {
    display: block;
  }
  .root-drop-zone.drag-over-folder {
    background: rgba(196, 160, 0, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

  /* ── Folder header ───────────────────────────────────────────────── */
  .folder-header {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--sb-text);
    opacity: 0.7;
    border-bottom: 1px solid var(--sb-border);
    cursor: default;
  }
  .folder-header.drag-over-folder {
    background: rgba(196, 160, 0, 0.15);
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }
  .folder-toggle {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: 0.7rem;
    padding: 0;
    width: 12px;
    text-align: center;
  }
  .folder-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: default;
  }
  .folder-count {
    font-size: 0.6rem;
    opacity: 0.5;
  }

  /* ── File item ───────────────────────────────────────────────────── */
  .file-item {
    display: flex;
    align-items: center;
    padding: 0.42rem 1rem;
    cursor: pointer;
    gap: 0.45rem;
    transition: background 0.1s;
    border-left: 2px solid transparent;
  }
  .file-item.indented {
    padding-left: 1.8rem;
  }
  .file-item:hover {
    background: var(--sb-hover);
  }
  .file-item.current {
    background: var(--sb-active);
    border-left-color: var(--accent);
  }
  .file-item.open {
    background: var(--sb-hover);
    border-left-color: var(--sb-border);
  }
  .file-item.dragging {
    opacity: 0.4;
  }

  .s-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .drag-grip {
    color: #444;
    cursor: grab;
    flex-shrink: 0;
    display: inline-flex;
  }
  .drag-grip:active {
    cursor: grabbing;
  }
  .file-name {
    font-size: 0.8rem;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dirty-mark {
    color: var(--accent);
    font-size: 0.75rem;
  }

  .item-badges {
    display: flex;
    align-items: center;
    gap: 3px;
    flex-shrink: 0;
  }
  .p-dots {
    display: flex;
    gap: 2px;
  }
  .p-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #333;
  }
  .p-dot.on {
    background: var(--accent);
  }

  /* ── Rename input ────────────────────────────────────────────────── */
  .rename-input {
    flex: 1;
    font-size: 0.8rem;
    padding: 1px 4px;
    border: 1px solid var(--accent);
    border-radius: 3px;
    background: var(--sb-bg);
    color: var(--sb-text);
    outline: none;
    min-width: 0;
  }
</style>
