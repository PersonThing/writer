<script>
  import { project } from '../lib/stores/project.svelte.js'
  import { editor } from '../lib/stores/editor.svelte.js'
  import { showContextMenu } from '../lib/stores/ui.svelte.js'
  import { iconGripDots } from '../lib/icons.js'

  let draggedPath = $state(null)
  let dragSourceStatusId = $state(null)
  let dragOverPath = $state(null)

  function handleClick(e, path) {
    if (e.target.closest('.drag-grip')) return
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

  // Drag & drop — reorder within same status, or move across statuses
  function handleDragStart(e, path, statusId) {
    draggedPath = path
    dragSourceStatusId = statusId
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => {
      e.target.style.opacity = '.4'
    }, 0)
  }

  function handleDragEnd(e) {
    e.target.style.opacity = ''
    draggedPath = null
    dragSourceStatusId = null
    dragOverPath = null
  }

  function handleDragOver(e, path) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverPath = path !== draggedPath ? path : null
  }

  async function handleDrop(e, path, statusId) {
    e.preventDefault()
    if (!draggedPath || path === draggedPath) return
    if (statusId === dragSourceStatusId) {
      await project.reorderInGroup(statusId, draggedPath, path)
    } else {
      await project.moveToGroup(draggedPath, statusId, path)
    }
    draggedPath = null
    dragSourceStatusId = null
    dragOverPath = null
  }
</script>

<div class="file-list">
  {#each project.filteredFiles as item}
    {@const m = project.getMeta(item.path)}
    {@const dname = project.displayName(item.path)}
    {@const isCur = isCurrentFile(item.path)}
    {@const isOpen = isOpenInPane(item.path)}
    {@const isDirty = isDirtyFile(item.path)}
    <div
      class="file-item"
      class:current={isCur}
      class:open={isOpen && !isCur}
      class:drag-over={dragOverPath === item.path}
      draggable="true"
      role="button"
      tabindex="0"
      ondragstart={(e) => handleDragStart(e, item.path, item.statusId)}
      ondragend={handleDragEnd}
      ondragover={(e) => handleDragOver(e, item.path)}
      ondrop={(e) => handleDrop(e, item.path, item.statusId)}
      onclick={(e) => handleClick(e, item.path)}
      oncontextmenu={(e) => handleContext(e, item.path)}
      onkeydown={(e) => {
        if (e.key === 'Enter') handleClick(e, item.path)
      }}
    >
      <span class="drag-grip">{@html iconGripDots(10)}</span>
      <span class="s-dot" style="background: {item.color}"></span>
      <span class="file-name" title={dname}>
        {dname}
        {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
      </span>
      <span class="item-badges">
        <span class="p-dots">
          {#each Array(5) as _, i}
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

  .file-item {
    display: flex;
    align-items: center;
    padding: 0.42rem 1rem;
    cursor: pointer;
    gap: 0.45rem;
    transition: background 0.1s;
    border-left: 2px solid transparent;
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
  .file-item.drag-over {
    border-top: 2px solid var(--accent);
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
</style>
