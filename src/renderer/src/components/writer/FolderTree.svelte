<script>
  import { onMount } from 'svelte'
  import { project } from '../../lib/stores/project.svelte.js'
  import { editor } from '../../lib/stores/editor.svelte.js'
  import { showContextMenu, modalAlert } from '../../lib/stores/ui.svelte.js'
  import * as api from '../../lib/api.js'
  import { iconGripDots } from '../../lib/icons.js'
  import { handleFileUploads } from '../../lib/upload.js'

  /**
   * Props:
   *   items        — ordered [{ path, color?, ... }] to render
   *   emptyDirs    — Iterable<path> of folders with no files (for empty
   *                  dir rendering); the tree is free to ignore these.
   *   scopeRoot    — path prefix that every item lives under (e.g.
   *                  '_stories/my-novel'). '' for the poems root.
   *   showBadges   — render the 5 quality dots next to each row.
   *   canReorder   — accept sibling drag-reorder drops.
   *   allowExternalDrops — enable Finder/Explorer file uploads.
   *   dragType     — MIME payload for drag events, used by cross-tab
   *                  drop targets to identify where the file came from.
   */
  let {
    items = [],
    emptyDirs = [],
    scopeRoot = '',
    showBadges = true,
    canReorder = true,
    allowExternalDrops = true,
    dragType = 'application/x-writer-file-path',
  } = $props()

  let draggedPath = $state(null)
  let dragOverFolder = $state(null)
  let dragOverFile = $state(null)
  let dragOverPosition = $state('after')
  let externalDragActive = $state(false)
  let renamingPath = $state(null)
  let renameValue = $state('')
  let renamingFolder = $state(null)
  let renameFolderValue = $state('')
  let collapsedFolders = $state(new Set())

  function hasExternalFiles(e) {
    return Array.from(e.dataTransfer?.types || []).includes('Files')
  }

  // Child-folder path relative to scopeRoot. When scopeRoot === '' we
  // return the full folder, matching the original poems behavior.
  function folderOf(itemPath) {
    const rel = relativeOf(itemPath)
    const parts = rel.split('/')
    if (parts.length <= 1) return ''
    return parts.slice(0, -1).join('/')
  }

  function relativeOf(fullPath) {
    if (!scopeRoot) return fullPath
    if (fullPath === scopeRoot) return ''
    const prefix = scopeRoot + '/'
    return fullPath.startsWith(prefix) ? fullPath.slice(prefix.length) : fullPath
  }

  function absoluteOf(relPath) {
    if (!scopeRoot) return relPath
    if (!relPath) return scopeRoot
    return scopeRoot + '/' + relPath
  }

  function displayName(path) {
    const rel = relativeOf(path)
    const last = rel.split('/').pop() || rel
    return last.endsWith('.md') ? last.slice(0, -3) : last
  }

  // ContextMenu dispatches this event when the user picks "Rename
  // folder". The path is fully qualified (includes scopeRoot).
  onMount(() => {
    function onStartFolderRename(e) {
      const full = e.detail?.path
      if (!full) return
      if (scopeRoot && !full.startsWith(scopeRoot + '/') && full !== scopeRoot) return
      if (!scopeRoot && full.startsWith('_stories/')) return
      startFolderRename(full)
    }
    window.addEventListener('start-folder-rename', onStartFolderRename)
    return () =>
      window.removeEventListener('start-folder-rename', onStartFolderRename)
  })

  // Build the tree bucket map from items + empty dirs. Keys are
  // relative folder paths ('' for root within scope).
  let tree = $derived.by(() => {
    const folders = new Map()
    const rootFiles = []
    for (const item of items) {
      const f = folderOf(item.path)
      if (f) {
        if (!folders.has(f)) folders.set(f, [])
        folders.get(f).push(item)
      } else {
        rootFiles.push(item)
      }
    }
    for (const dAbs of emptyDirs || []) {
      const d = relativeOf(dAbs)
      if (!d) continue
      if (!folders.has(d)) folders.set(d, [])
      // Also ensure parent chain shows up for deeply nested empties.
      let acc = ''
      for (const seg of d.split('/')) {
        acc = acc ? acc + '/' + seg : seg
        if (!folders.has(acc)) folders.set(acc, [])
      }
    }
    const sorted = [...folders.entries()].sort((a, b) =>
      a[0].localeCompare(b[0]),
    )
    return { folders: sorted, rootFiles }
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

  function handleFolderContext(e, folderRel) {
    e.preventDefault()
    e.stopPropagation()
    showContextMenu(e.clientX, e.clientY, absoluteOf(folderRel), 'folder')
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

  // ── Drag & drop ────────────────────────────────────────────────────────

  function handleDragStart(e, path) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', path)
    e.dataTransfer.setData(dragType, path)
    requestAnimationFrame(() => {
      draggedPath = path
    })
  }
  function handleDragEnd() {
    draggedPath = null
    dragOverFolder = null
    dragOverFile = null
  }

  function handleDragOverFile(e, path) {
    if (!draggedPath || draggedPath === path) return
    if (!canReorder) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    dragOverFile = path
    dragOverPosition = e.clientY < midY ? 'before' : 'after'
  }

  async function handleDropOnFile(e, targetPath) {
    if (!draggedPath || draggedPath === targetPath) return
    if (!canReorder) return
    e.preventDefault()
    e.stopPropagation()

    const srcFolder = folderOf(draggedPath)
    const dstFolder = folderOf(targetPath)
    if (srcFolder !== dstFolder) {
      const fileName = draggedPath.split('/').pop()
      const dstAbs = absoluteOf(dstFolder)
      const newPath = dstAbs ? dstAbs + '/' + fileName : fileName
      await api.moveFile(draggedPath, newPath)
      await project.scanAll()
      await project.scanStories()
      draggedPath = newPath
    }

    const siblings = items
      .map((f) => f.path)
      .filter((p) => folderOf(p) === dstFolder)
    const srcIdx = siblings.indexOf(draggedPath)
    if (srcIdx === -1) return
    siblings.splice(srcIdx, 1)
    let dstIdx = siblings.indexOf(targetPath)
    if (dstIdx === -1) return
    if (dragOverPosition === 'after') dstIdx += 1
    siblings.splice(dstIdx, 0, draggedPath)

    dragOverFile = null
    try {
      await project.reorderFiles(siblings)
    } catch (err) {
      await modalAlert('Reorder failed: ' + err.message)
    }
  }

  function handleDragOverFolder(e, folderRel) {
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = hasExternalFiles(e) ? 'copy' : 'move'
    dragOverFolder = folderRel
  }

  async function handleDropOnFolder(e, folderRel) {
    e.preventDefault()
    e.stopPropagation()

    const dstAbs = absoluteOf(folderRel)

    if (hasExternalFiles(e) && e.dataTransfer.files?.length) {
      dragOverFolder = null
      externalDragActive = false
      if (!allowExternalDrops) return
      await handleFileUploads(Array.from(e.dataTransfer.files), dstAbs)
      return
    }

    if (!draggedPath) return
    const currentFolder = folderOf(draggedPath)
    if (currentFolder === folderRel) {
      draggedPath = null
      dragOverFolder = null
      return
    }
    const fileName = draggedPath.split('/').pop()
    const newPath = dstAbs ? dstAbs + '/' + fileName : fileName
    await api.moveFile(draggedPath, newPath)
    await project.scanAll()
    await project.scanStories()
    editor.panes = editor.panes.map((p) => {
      if (p.filePath === draggedPath) return { ...p, filePath: newPath }
      return p
    })
    draggedPath = null
    dragOverFolder = null
  }

  function handleListDragOver(e) {
    if (hasExternalFiles(e) && allowExternalDrops) {
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
      externalDragActive = true
    }
  }
  function handleListDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      externalDragActive = false
      dragOverFolder = null
    }
  }
  function handleListDrop(e) {
    if (hasExternalFiles(e) && e.dataTransfer.files?.length && allowExternalDrops) {
      handleDropOnFolder(e, '')
    }
  }

  // ── Rename files inline ──────────────────────────────────────────────

  function startRename(path) {
    renamingPath = path
    renameValue = displayName(path)
  }

  async function commitRename(path) {
    const newName = renameValue.trim()
    if (!newName || newName === displayName(path)) {
      renamingPath = null
      return
    }
    const folderRel = folderOf(path)
    const folderAbs = absoluteOf(folderRel)
    const newFileName = newName.endsWith('.md') ? newName : newName + '.md'
    const newPath = folderAbs ? folderAbs + '/' + newFileName : newFileName

    try {
      await api.renameFile(path, newPath)
      const meta = project.getMeta(path)
      await project.patchMeta(newPath, { ...meta, modified: Date.now() })
      editor.panes = editor.panes.map((p) => {
        if (p.filePath === path) return { ...p, filePath: newPath, pendingRename: null }
        return p
      })
      await project.scanAll()
      await project.scanStories()
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

  function startFolderRename(folderAbs) {
    renamingFolder = folderAbs
    renameFolderValue = folderAbs.split('/').pop()
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
      await project.scanStories()
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

  function handleFolderRenameKeydown(e, folderAbs) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commitFolderRename(folderAbs)
    }
    if (e.key === 'Escape') {
      renamingFolder = null
    }
  }

  // ── Collapse/expand ──────────────────────────────────────────────────

  function toggleFolder(folderRel) {
    const next = new Set(collapsedFolders)
    if (next.has(folderRel)) next.delete(folderRel)
    else next.add(folderRel)
    collapsedFolders = next
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
<div
  class="folder-tree"
  class:is-dragging={draggedPath || externalDragActive}
  ondragover={handleListDragOver}
  ondragleave={handleListDragLeave}
  ondrop={handleListDrop}
>
  {#if scopeRoot === '' || allowExternalDrops}
    <div
      class="root-drop-zone"
      class:visible={draggedPath || (externalDragActive && allowExternalDrops)}
      class:drag-over-folder={dragOverFolder === ''}
      ondragover={(e) => handleDragOverFolder(e, '')}
      ondragleave={() => { if (dragOverFolder === '') dragOverFolder = null }}
      ondrop={(e) => handleDropOnFolder(e, '')}
    >{externalDragActive ? 'Drop files to import' : 'Move to root'}</div>
  {/if}

  {#each tree.folders as [folderRel, folderItems]}
    {@const folderAbs = absoluteOf(folderRel)}
    {@const folderName = folderRel.split('/').pop()}
    {@const isCollapsed = collapsedFolders.has(folderRel)}
    {@const depth = folderRel.split('/').length - 1}
    <div
      class="folder-header"
      class:drag-over-folder={dragOverFolder === folderRel}
      style="padding-left: {0.5 + depth * 0.9}rem"
      ondragover={(e) => handleDragOverFolder(e, folderRel)}
      ondragleave={() => { if (dragOverFolder === folderRel) dragOverFolder = null }}
      ondrop={(e) => handleDropOnFolder(e, folderRel)}
      oncontextmenu={(e) => handleFolderContext(e, folderRel)}
    >
      <button class="folder-toggle" onclick={() => toggleFolder(folderRel)}>
        {isCollapsed ? '▸' : '▾'}
      </button>
      {#if renamingFolder === folderAbs}
        <input
          class="rename-input"
          type="text"
          bind:value={renameFolderValue}
          onblur={() => commitFolderRename(folderAbs)}
          onkeydown={(e) => handleFolderRenameKeydown(e, folderAbs)}
        />
      {:else}
        <span
          class="folder-name"
          ondblclick={() => startFolderRename(folderAbs)}
        >{folderName}</span>
      {/if}
      <span class="folder-count">{folderItems.length}</span>
    </div>

    {#if !isCollapsed}
      {#each folderItems as item}
        {@const dname = displayName(item.path)}
        {@const isCur = isCurrentFile(item.path)}
        {@const isOpen = isOpenInPane(item.path)}
        {@const isDirty = isDirtyFile(item.path)}
        <div
          class="file-item"
          class:current={isCur}
          class:open={isOpen && !isCur}
          class:dragging={draggedPath === item.path}
          class:drop-above={dragOverFile === item.path && dragOverPosition === 'before'}
          class:drop-below={dragOverFile === item.path && dragOverPosition === 'after'}
          style="padding-left: {1 + (depth + 1) * 0.9}rem"
          draggable="true"
          role="button"
          tabindex="0"
          ondragstart={(e) => handleDragStart(e, item.path)}
          ondragend={handleDragEnd}
          ondragover={(e) => handleDragOverFile(e, item.path)}
          ondragleave={() => { if (dragOverFile === item.path) dragOverFile = null }}
          ondrop={(e) => handleDropOnFile(e, item.path)}
          onclick={(e) => handleClick(e, item.path)}
          oncontextmenu={(e) => handleContext(e, item.path)}
          onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, item.path) }}
        >
          <span class="drag-grip">{@html iconGripDots(10)}</span>
          {#if showBadges}
            <span class="s-dot" style="background: {item.color || '#444'}"></span>
          {/if}
          {#if renamingPath === item.path}
            <input
              class="rename-input"
              type="text"
              bind:value={renameValue}
              onblur={() => commitRename(item.path)}
              onkeydown={(e) => handleRenameKeydown(e, item.path)}
              onclick={(e) => e.stopPropagation()}
            />
          {:else}
            <span class="file-name" title={dname} ondblclick={() => startRename(item.path)}>
              {dname}
              {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
            </span>
          {/if}
          {#if showBadges}
            <span class="item-badges">
              <span class="p-dots">
                {#each Array(5) as _, i}
                  {@const m = project.getMeta(item.path)}
                  <span class="p-dot" class:on={i < m.quality}></span>
                {/each}
              </span>
            </span>
          {/if}
        </div>
      {/each}
    {/if}
  {/each}

  {#each tree.rootFiles as item}
    {@const dname = displayName(item.path)}
    {@const isCur = isCurrentFile(item.path)}
    {@const isOpen = isOpenInPane(item.path)}
    {@const isDirty = isDirtyFile(item.path)}
    <div
      class="file-item"
      class:current={isCur}
      class:open={isOpen && !isCur}
      class:dragging={draggedPath === item.path}
      class:drop-above={dragOverFile === item.path && dragOverPosition === 'before'}
      class:drop-below={dragOverFile === item.path && dragOverPosition === 'after'}
      draggable="true"
      role="button"
      tabindex="0"
      ondragstart={(e) => handleDragStart(e, item.path)}
      ondragend={handleDragEnd}
      ondragover={(e) => handleDragOverFile(e, item.path)}
      ondragleave={() => { if (dragOverFile === item.path) dragOverFile = null }}
      ondrop={(e) => handleDropOnFile(e, item.path)}
      onclick={(e) => handleClick(e, item.path)}
      oncontextmenu={(e) => handleContext(e, item.path)}
      onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, item.path) }}
    >
      <span class="drag-grip">{@html iconGripDots(10)}</span>
      {#if showBadges}
        <span class="s-dot" style="background: {item.color || '#444'}"></span>
      {/if}
      {#if renamingPath === item.path}
        <input
          class="rename-input"
          type="text"
          bind:value={renameValue}
          onblur={() => commitRename(item.path)}
          onkeydown={(e) => handleRenameKeydown(e, item.path)}
          onclick={(e) => e.stopPropagation()}
        />
      {:else}
        <span class="file-name" title={dname} ondblclick={() => startRename(item.path)}>
          {dname}
          {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
        </span>
      {/if}
      {#if showBadges}
        <span class="item-badges">
          <span class="p-dots">
            {#each Array(5) as _, i}
              {@const m = project.getMeta(item.path)}
              <span class="p-dot" class:on={i < m.quality}></span>
            {/each}
          </span>
        </span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .folder-tree {
    display: flex;
    flex-direction: column;
  }

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
  .root-drop-zone.visible { display: block; }
  .root-drop-zone.drag-over-folder {
    background: rgba(196, 160, 0, 0.15);
    border-color: var(--accent);
    color: var(--accent);
  }

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
  .folder-count { font-size: 0.6rem; opacity: 0.5; }

  .file-item {
    display: flex;
    align-items: center;
    padding: 0.42rem 1rem;
    cursor: pointer;
    gap: 0.45rem;
    transition: background 0.1s;
    border-left: 2px solid transparent;
  }
  .file-item:hover { background: var(--sb-hover); }
  .file-item.current { background: var(--sb-active); border-left-color: var(--accent); }
  .file-item.open { background: var(--sb-hover); border-left-color: var(--sb-border); }
  .file-item.dragging { opacity: 0.4; }
  .file-item.drop-above { box-shadow: inset 0 2px 0 0 var(--accent); }
  .file-item.drop-below { box-shadow: inset 0 -2px 0 0 var(--accent); }

  .s-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .drag-grip { color: #444; cursor: grab; flex-shrink: 0; display: inline-flex; }
  .drag-grip:active { cursor: grabbing; }
  .file-name {
    font-size: 0.8rem;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dirty-mark { color: var(--accent); font-size: 0.75rem; }

  .item-badges { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
  .p-dots { display: flex; gap: 2px; }
  .p-dot { width: 4px; height: 4px; border-radius: 50%; background: #333; }
  .p-dot.on { background: var(--accent); }

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
