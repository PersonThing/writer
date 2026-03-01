<script>
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { showContextMenu } from '../lib/stores/ui.svelte.js';

  function handleClick(e, path) {
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
</script>

<div class="file-list">
  {#if project.filteredFiles.length === 0}
    <div class="empty">No poems match.</div>
  {:else}
    {#each project.filteredFiles as path}
      {@const m = project.getMeta(path)}
      {@const dname = project.displayName(path)}
      {@const isCur = isCurrentFile(path)}
      {@const isOpen = isOpenInPane(path)}
      {@const isDirty = isDirtyFile(path)}
      <div
        class="file-item"
        class:current={isCur}
        class:open={isOpen && !isCur}
        role="button"
        tabindex="0"
        onclick={(e) => handleClick(e, path)}
        oncontextmenu={(e) => handleContext(e, path)}
        onkeydown={(e) => { if (e.key === 'Enter') handleClick(e, path); }}
      >
        <span class="s-dot" style="background: {project.statusColor(m.status)}"></span>
        <span class="file-name" title={dname}>
          {dname}
          {#if isDirty}<span class="dirty-mark">&bull;</span>{/if}
        </span>
        <span class="item-badges">
          {#if m.social}<span class="social-pip">&#128241;</span>{/if}
          <span class="p-dots">
            {#each Array(5) as _, i}
              <span class="p-dot" class:on={i < m.quality}></span>
            {/each}
          </span>
        </span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .file-list { flex: 1; overflow-y: auto; padding: .4rem 0; }
  .file-list::-webkit-scrollbar { width: 4px; }
  .file-list::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }

  .empty {
    padding: 1rem 1.2rem; color: #555; font-size: .82rem; font-style: italic;
  }

  .file-item {
    display: flex; align-items: center;
    padding: .42rem 1rem; cursor: pointer; gap: .45rem;
    transition: background .1s; border-left: 2px solid transparent;
  }
  .file-item:hover { background: var(--sb-hover); }
  .file-item.current { background: var(--sb-active); border-left-color: var(--accent); }
  .file-item.open { background: var(--sb-hover); border-left-color: var(--sb-border); }

  .s-dot {
    width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
    background: #444;
  }
  .file-name {
    font-size: .8rem; flex: 1;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .dirty-mark { color: var(--accent); font-size: .75rem; }

  .item-badges { display: flex; align-items: center; gap: 3px; flex-shrink: 0; }
  .social-pip { font-size: .65rem; }
  .p-dots { display: flex; gap: 2px; }
  .p-dot { width: 4px; height: 4px; border-radius: 50%; background: #333; }
  .p-dot.on { background: var(--accent); }
</style>
