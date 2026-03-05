<script>
  import { doneOrder, displayName, reorderDone } from '../lib/stores/project.svelte.js';
  import { openFile, panes, activePaneId } from '../lib/stores/editor.svelte.js';

  let draggedPath = $state(null);
  let dragOverPath = $state(null);

  function handleDragStart(e, path) {
    draggedPath = path;
    e.dataTransfer.effectAllowed = 'move';
    setTimeout(() => { e.target.style.opacity = '.4'; }, 0);
  }

  function handleDragEnd(e) {
    e.target.style.opacity = '';
    draggedPath = null;
    dragOverPath = null;
  }

  function handleDragOver(e, path) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    dragOverPath = (path !== draggedPath) ? path : null;
  }

  async function handleDrop(e, path) {
    e.preventDefault();
    if (!draggedPath || path === draggedPath) return;
    await reorderDone(draggedPath, path);
    draggedPath = null;
    dragOverPath = null;
  }

  function handleClick(e, path) {
    if (e.target.classList.contains('done-grip')) return;
    const newPane = e.ctrlKey || e.metaKey;
    openFile(path, { newPane });
  }

  function isCurrentFile(path) {
    return panes.some(p => p.id === activePaneId && p.filePath === path);
  }
</script>

<div class="done-panel">
  <div class="done-hdr">
    <strong>Reading Order</strong>
    <span class="done-count">{doneOrder.length || ''}</span>
  </div>
  <div class="done-list">
    {#if doneOrder.length === 0}
      <div class="done-empty">Mark poems as Done to build your reading order</div>
    {:else}
      {#each doneOrder as path, idx}
        {@const name = displayName(path)}
        <div
          class="done-item"
          class:current={isCurrentFile(path)}
          class:drag-over={dragOverPath === path}
          draggable="true"
          role="button"
          tabindex="0"
          ondragstart={(e) => handleDragStart(e, path)}
          ondragend={handleDragEnd}
          ondragover={(e) => handleDragOver(e, path)}
          ondrop={(e) => handleDrop(e, path)}
          onclick={(e) => handleClick(e, path)}
          onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, path); }}
        >
          <span class="done-grip">&#10247;</span>
          <span class="done-num">{idx + 1}</span>
          <span class="done-name" title={name}>{name}</span>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .done-panel {
    width: 220px; flex-shrink: 0;
    background: var(--bg); border-left: 1px solid var(--border);
    display: flex; flex-direction: column; overflow: hidden;
  }
  .done-hdr {
    padding: .75rem 1rem .5rem;
    font-size: .7rem; text-transform: uppercase; letter-spacing: .08em;
    color: var(--muted); border-bottom: 1px solid var(--border);
    display: flex; align-items: center; justify-content: space-between;
    flex-shrink: 0;
  }
  .done-hdr strong {
    color: var(--text); font-size: .78rem;
    text-transform: none; letter-spacing: 0;
  }
  .done-list { flex: 1; overflow-y: auto; padding: .4rem 0; }
  .done-list::-webkit-scrollbar { width: 3px; }
  .done-list::-webkit-scrollbar-thumb { background: var(--border); border-radius: 2px; }
  .done-empty {
    padding: 1.5rem 1rem; font-size: .8rem; color: var(--muted);
    font-style: italic; text-align: center; line-height: 1.6;
  }
  .done-item {
    display: flex; align-items: center; gap: .4rem;
    padding: .38rem .75rem; cursor: pointer;
    border-left: 2px solid transparent;
    transition: background .1s; user-select: none;
  }
  .done-item:hover { background: var(--accent-light); }
  .done-item.current { background: var(--accent-light); border-left-color: var(--accent); }
  .done-item.drag-over { border-top: 2px solid var(--accent); }
  .done-grip {
    color: #ccc; font-size: .85rem; cursor: grab; flex-shrink: 0;
    padding: 0 2px; line-height: 1;
  }
  .done-grip:active { cursor: grabbing; }
  .done-num {
    font-size: .65rem; color: var(--muted); flex-shrink: 0;
    min-width: 1.2rem; text-align: right;
  }
  .done-name {
    font-size: .78rem; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
    color: var(--text);
  }
</style>
