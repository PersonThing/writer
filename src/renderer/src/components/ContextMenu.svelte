<script>
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { ui, hideContextMenu } from '../lib/stores/ui.svelte.js';
  import * as api from '../lib/api.js';

  function handleStatus(statusId) {
    if (!ui.ctxPath) return;
    project.patchMeta(ui.ctxPath, { status: statusId });
    hideContextMenu();
  }

  function handleQuality(q) {
    if (!ui.ctxPath) return;
    const cur = project.getMeta(ui.ctxPath).quality || 0;
    project.patchMeta(ui.ctxPath, { quality: cur === q ? 0 : q });
  }

  async function handleRename() {
    if (!ui.ctxPath) return;
    hideContextMenu();
    const pane = editor.panes.find(p => p.filePath === ui.ctxPath);
    if (!pane) {
      await editor.openFile(ui.ctxPath);
    }
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('focus-heading'));
    }, 50);
  }

  async function handleDelete() {
    if (!ui.ctxPath) return;
    const name = project.displayName(ui.ctxPath);
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) {
      hideContextMenu();
      return;
    }
    try {
      await api.deleteFile(project.rootPath + '/' + ui.ctxPath);
    } catch (e) {
      alert('Could not delete: ' + e.message);
    }
    const pane = editor.panes.find(p => p.filePath === ui.ctxPath);
    if (pane) editor.closePane(pane.id);

    const newMeta = { ...project.meta };
    delete newMeta[ui.ctxPath];
    project.meta = newMeta;
    await project.saveMeta();
    await project.scanAll();
    hideContextMenu();
  }

  function handleWindowClick(e) {
    if (ui.ctxVisible) hideContextMenu();
  }
  function handleKeydown(e) {
    if (e.key === 'Escape' && ui.ctxVisible) hideContextMenu();
  }

  $effect(() => {
    if (ui.ctxVisible) {
      setTimeout(() => {
        window.addEventListener('click', handleWindowClick);
        window.addEventListener('keydown', handleKeydown);
      }, 0);
    }
    return () => {
      window.removeEventListener('click', handleWindowClick);
      window.removeEventListener('keydown', handleKeydown);
    };
  });
</script>

{#if ui.ctxVisible}
  {@const m = ui.ctxPath ? project.getMeta(ui.ctxPath) : { status: '', quality: 0 }}
  <div
    class="ctx-menu"
    style="left: {ui.ctxX}px; top: {ui.ctxY}px"
    onclick={(e) => e.stopPropagation()}
  >
    <div class="ctx-section">Status</div>
    <div
      class="ctx-item"
      class:active={!m.status}
      onclick={() => handleStatus('')}
    >
      — No status
    </div>
    {#each project.statuses as s}
      <div
        class="ctx-item"
        class:active={m.status === s.id}
        title={s.description || ''}
        onclick={() => handleStatus(s.id)}
      >
        {s.label}
      </div>
    {/each}

    <hr class="ctx-sep">
    <div class="ctx-section">Quality</div>
    <div class="ctx-stars">
      {#each Array(5) as _, i}
        <span
          class="ctx-star"
          class:on={i < (m.quality || 0)}
          onclick={() => handleQuality(i + 1)}
        >&#9733;</span>
      {/each}
    </div>

    <hr class="ctx-sep">
    <div class="ctx-item" onclick={handleRename}>&#9998; Rename</div>
    <div class="ctx-item ctx-delete" onclick={handleDelete}>&#128465; Delete</div>
  </div>
{/if}

<style>
  .ctx-menu {
    position: fixed; z-index: 9999;
    background: var(--surface); border: 1px solid var(--border);
    border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,.15);
    padding: .35rem 0; min-width: 190px; font-size: .82rem;
  }
  .ctx-section {
    padding: .2rem .75rem; font-size: .67rem;
    text-transform: uppercase; letter-spacing: .07em;
    color: var(--muted); margin-top: .25rem;
  }
  .ctx-item {
    display: flex; align-items: center; gap: .5rem;
    padding: .38rem .85rem; cursor: pointer; transition: background .1s;
    color: var(--text);
  }
  .ctx-item:hover { background: var(--accent-light); color: var(--accent); }
  .ctx-item.active { font-weight: bold; color: var(--accent); }
  .ctx-sep { border: none; border-top: 1px solid var(--border); margin: .3rem 0; }
  .ctx-stars { display: flex; gap: 3px; padding: .3rem .85rem; }
  .ctx-star {
    font-size: 1rem; cursor: pointer; color: #ccc; transition: color .1s;
  }
  .ctx-star.on { color: var(--accent); }
  .ctx-delete { color: #c0392b !important; }
  .ctx-delete:hover { background: #fdeaea !important; color: #c0392b !important; }
</style>
