<script>
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { showContextMenu } from '../lib/stores/ui.svelte.js';
  import { iconChevronRight, iconChevronDown, iconShare, iconGripDots } from '../lib/icons.js';

  let draggedPath = $state(null);
  let dragSourceStatusId = $state(null);
  let dragOverPath = $state(null);
  let dragOverGroupId = $state(null);

  function handleClick(e, path) {
    if (e.target.closest('.drag-grip')) return;
    const newPane = e.ctrlKey || e.metaKey;
    editor.openFile(path, { newPane });
  }

  function handleContext(e, path) {
    e.preventDefault();
    showContextMenu(e.clientX, e.clientY, path);
  }

  function isCurrentFile(path) {
    return editor.panes.some(p => p.id === editor.activePaneId && p.filePath === path);
  }

  function isOpenInPane(path) {
    return editor.panes.some(p => p.filePath === path);
  }

  function isDirtyFile(path) {
    const pane = editor.panes.find(p => p.filePath === path);
    return pane ? pane.dirty : false;
  }

  function toggleGroup(id) {
    const next = new Set(project.collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    project.collapsed = next;
  }

  // Drag & drop — within and across groups
  function handleDragStart(e, path, statusId) {
    draggedPath = path;
    dragSourceStatusId = statusId;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { e.target.style.opacity = '.4'; }, 0);
  }

  function handleDragEnd(e) {
    e.target.style.opacity = '';
    draggedPath = null;
    dragSourceStatusId = null;
    dragOverPath = null;
    dragOverGroupId = null;
  }

  function handleDragOver(e, path, statusId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverPath = (path !== draggedPath) ? path : null;
    dragOverGroupId = null;
  }

  function handleHeaderDragOver(e, groupId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverPath = null;
    dragOverGroupId = groupId;
  }

  async function handleDrop(e, path, statusId) {
    e.preventDefault();
    if (!draggedPath || path === draggedPath) return;
    if (statusId === dragSourceStatusId) {
      await project.reorderInGroup(statusId, draggedPath, path);
    } else {
      await project.moveToGroup(draggedPath, statusId, path);
    }
    draggedPath = null;
    dragSourceStatusId = null;
    dragOverPath = null;
    dragOverGroupId = null;
  }

  async function handleHeaderDrop(e, groupId) {
    e.preventDefault();
    if (!draggedPath) return;
    if (groupId === dragSourceStatusId) return;
    await project.moveToGroup(draggedPath, groupId, null);
    draggedPath = null;
    dragSourceStatusId = null;
    dragOverPath = null;
    dragOverGroupId = null;
  }
</script>

<div class="file-list">
  {#each project.groupedFiles as group}
    {#if group.count > 0 || !project.searchQuery}
      {@const isCollapsed = project.collapsed.has(group.id)}
      <div class="group-header"
        class:header-drag-over={dragOverGroupId === group.id}
        onclick={() => toggleGroup(group.id)}
        ondragover={(e) => handleHeaderDragOver(e, group.id)}
        ondrop={(e) => handleHeaderDrop(e, group.id)}
        role="button" tabindex="0"
        onkeydown={(e) => { if (e.key === 'Enter') toggleGroup(group.id); }}>
        <span class="group-chevron">
          {@html isCollapsed ? iconChevronRight(12) : iconChevronDown(12)}
        </span>
        <span class="group-dot" style="background: {group.color}"></span>
        <span class="group-label">{group.label}</span>
        <span class="group-count">{group.count}</span>
      </div>

      {#if !isCollapsed}
        {#each group.files as path}
          {@const m = project.getMeta(path)}
          {@const dname = project.displayName(path)}
          {@const isCur = isCurrentFile(path)}
          {@const isOpen = isOpenInPane(path)}
          {@const isDirty = isDirtyFile(path)}
          <div
            class="file-item"
            class:current={isCur}
            class:open={isOpen && !isCur}
            class:drag-over={dragOverPath === path}
            draggable="true"
            role="button"
            tabindex="0"
            ondragstart={(e) => handleDragStart(e, path, group.id)}
            ondragend={handleDragEnd}
            ondragover={(e) => handleDragOver(e, path, group.id)}
            ondrop={(e) => handleDrop(e, path, group.id)}
            onclick={(e) => handleClick(e, path)}
            oncontextmenu={(e) => handleContext(e, path)}
            onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, path); }}
          >
            <span class="drag-grip">{@html iconGripDots(10)}</span>
            <span class="s-dot" style="background: {group.color}"></span>
            <span class="file-name" title={dname}>
              {dname}
              {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
            </span>
            <span class="item-badges">
              {#if m.social}<span class="social-pip">{@html iconShare(12)}</span>{/if}
              <span class="p-dots">
                {#each Array(5) as _, i}
                  <span class="p-dot" class:on={i < m.quality}></span>
                {/each}
              </span>
            </span>
          </div>
        {/each}
      {/if}
    {/if}
  {/each}

  {#if project.groupedFiles.every(g => g.count === 0) && project.searchQuery}
    <div class="empty">No poems match.</div>
  {/if}
</div>

<style>
  .file-list { flex: 1; overflow-y: auto; padding: 0; }
  .file-list::-webkit-scrollbar { width: 4px; }
  .file-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .empty {
    padding: 1rem 1.2rem; color: #555; font-size: .82rem; font-style: italic;
  }

  .group-header {
    display: flex; align-items: center; gap: .4rem;
    padding: .35rem .75rem; cursor: pointer; user-select: none;
    font-size: .72rem; color: var(--sb-text);
    border-bottom: 1px solid var(--sb-border);
    position: sticky; top: 0; background: var(--sb-bg); z-index: 1;
  }
  .group-header:hover { background: var(--sb-hover); }
  .group-header.header-drag-over { background: var(--sb-active); border-bottom-color: var(--accent); }
  .group-chevron { display: inline-flex; color: #555; flex-shrink: 0; }
  .group-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .group-label { flex: 1; font-weight: 600; }
  .group-count { color: #777; font-size: .65rem; }

  .file-item {
    display: flex; align-items: center;
    padding: .42rem 1rem; cursor: pointer; gap: .45rem;
    transition: background .1s; border-left: 2px solid transparent;
  }
  .file-item:hover { background: var(--sb-hover); }
  .file-item.current { background: var(--sb-active); border-left-color: var(--accent); }
  .file-item.open { background: var(--sb-hover); border-left-color: var(--sb-border); }

  .s-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .drag-grip { color: #444; cursor: grab; flex-shrink: 0; display: inline-flex; }
  .drag-grip:active { cursor: grabbing; }
  .file-item.drag-over { border-top: 2px solid var(--accent); }

  .file-name {
    font-size: .8rem; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dirty-mark { color: var(--accent); font-size: .75rem; }

  .item-badges { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
  .social-pip { display: inline-flex; align-items: center; color: #7c35d4; }
  .p-dots { display: flex; gap: 2px; }
  .p-dot { width: 4px; height: 4px; border-radius: 50%; background: #333; }
  .p-dot.on { background: var(--accent); }
</style>
