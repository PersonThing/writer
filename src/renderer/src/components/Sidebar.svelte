<script>
  import * as api from '../lib/api.js';
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { ui } from '../lib/stores/ui.svelte.js';
  import { iconPlus, iconRefresh, iconFolder, iconGear } from '../lib/icons.js';
  import FileList from './FileList.svelte';

  async function changeDir() {
    const dirPath = await api.openDirectory();
    if (dirPath) {
      editor.closeAllPanes();
      await project.openRoot(dirPath);
    }
  }

  async function rescan() {
    await project.scanAll();
  }
</script>

<aside class="sidebar">
  <div class="sb-header">
    <span class="sb-title">Writing Projects</span>
    <button class="sb-icon-btn" title="New poem" onclick={() => editor.newFile()}>{@html iconPlus()}</button>
    <button class="sb-icon-btn" title="Refresh file list" onclick={rescan}>{@html iconRefresh()}</button>
    <button class="sb-icon-btn" title="Change folder" onclick={changeDir}>{@html iconFolder()}</button>
  </div>

  <div class="sb-controls">
    <div class="search-row">
      <input
        class="search"
        type="search"
        placeholder="Search poems..."
        autocomplete="off"
        bind:value={project.searchQuery}
      >
      <button class="sb-icon-btn gear-btn" title="Edit statuses" onclick={() => ui.statusEditorOpen = true}>{@html iconGear(20)}</button>
    </div>
  </div>

  <div class="filter-chips">
    <button
      class="chip"
      class:active={project.activeFilter === ''}
      onclick={() => project.activeFilter = ''}
    >
      All <span class="chip-count">{project.fileCounts._total}</span>
    </button>
    {#each project.statuses as s}
      <button
        class="chip"
        class:active={project.activeFilter === s.id}
        onclick={() => project.activeFilter = project.activeFilter === s.id ? '' : s.id}
      >
        <span class="chip-dot" style="background: {s.color}"></span>
        {s.label}
        <span class="chip-count">{project.fileCounts[s.id] || 0}</span>
      </button>
    {/each}
    {#if project.fileCounts[''] > 0}
      <button
        class="chip"
        class:active={project.activeFilter === '_none'}
        onclick={() => project.activeFilter = project.activeFilter === '_none' ? '' : '_none'}
      >
        <span class="chip-dot" style="background: #444"></span>
        No Status
        <span class="chip-count">{project.fileCounts['']}</span>
      </button>
    {/if}
    <button
      class="chip"
      class:active={project.activeFilter === 'social'}
      onclick={() => project.activeFilter = project.activeFilter === 'social' ? '' : 'social'}
    >
      Social <span class="chip-count">{project.fileCounts.social || 0}</span>
    </button>
  </div>

  <FileList />
</aside>

<style>
  .sidebar {
    width: 265px; flex-shrink: 0;
    background: var(--sb-bg); color: var(--sb-text);
    display: flex; flex-direction: column; overflow: hidden;
    border-right: 1px solid #000;
  }
  .sb-header {
    padding: .85rem 1rem; border-bottom: 1px solid var(--sb-border);
    display: flex; align-items: center; gap: .5rem; flex-shrink: 0;
  }
  .sb-title {
    font-family: var(--font-serif); font-size: .9rem;
    color: var(--accent); flex: 1;
  }
  .sb-icon-btn {
    background: none; border: none; color: #555; cursor: pointer;
    font-size: .85rem; padding: 2px 4px; border-radius: 4px;
    transition: color .15s; display: inline-flex; align-items: center;
  }
  .sb-icon-btn:hover { color: #999; }

  .sb-controls {
    padding: .65rem .75rem; border-bottom: 1px solid var(--sb-border);
    display: flex; flex-direction: column; gap: .5rem; flex-shrink: 0;
  }
  .search-row {
    display: flex; align-items: center; gap: .4rem;
  }
  .search {
    background: #222; border: 1px solid #3a3732;
    border-radius: 6px; padding: .38rem .7rem;
    color: var(--sb-text); font-size: .82rem; flex: 1;
    outline: none;
  }
  .search:focus { border-color: var(--accent); }
  .search::placeholder { color: #555; }

  .gear-btn { flex-shrink: 0; padding: 2px; }

  .filter-chips {
    display: flex; flex-wrap: wrap; gap: 4px;
    padding: .5rem .75rem; border-bottom: 1px solid var(--sb-border);
    flex-shrink: 0;
  }
  .chip {
    display: inline-flex; align-items: center; gap: 4px;
    padding: .2rem .55rem; border-radius: 12px;
    font-size: .7rem; cursor: pointer;
    background: transparent; border: 1px solid var(--sb-border);
    color: var(--sb-text); transition: all .15s;
  }
  .chip:hover { background: var(--sb-hover); border-color: #555; }
  .chip.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .chip-dot {
    width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
  }
  .chip.active .chip-dot { opacity: .8; }
  .chip-count { color: inherit; opacity: .6; font-size: .65rem; }
</style>
