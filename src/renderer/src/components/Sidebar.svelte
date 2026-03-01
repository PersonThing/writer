<script>
  import * as api from '../lib/api.js';
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { ui } from '../lib/stores/ui.svelte.js';
  import FilterChips from './FilterChips.svelte';
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
    <button class="sb-icon-btn" title="New poem" onclick={() => editor.newFile()}>&#65291;</button>
    <button class="sb-icon-btn" title="Refresh file list" onclick={rescan}>&#8634;</button>
    <button class="sb-icon-btn" title="Change folder" onclick={changeDir}>&#128193;</button>
  </div>

  <div class="sb-controls">
    <input
      class="search"
      type="search"
      placeholder="Search poems..."
      autocomplete="off"
      bind:value={project.searchQuery}
    >

    <div class="filter-wrapper">
      <FilterChips />
      <button class="sb-icon-btn gear-btn" title="Edit statuses" onclick={() => ui.statusEditorOpen = true}>&#9881;</button>
    </div>

    <div class="sort-row">
      <span>Sort by</span>
      <select class="sort-sel" bind:value={project.activeSort}>
        <option value="status">Status</option>
        <option value="quality">Quality</option>
        <option value="name">Name</option>
        <option value="modified">Last modified</option>
      </select>
    </div>
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
    transition: color .15s;
  }
  .sb-icon-btn:hover { color: #999; }

  .sb-controls {
    padding: .65rem .75rem; border-bottom: 1px solid var(--sb-border);
    display: flex; flex-direction: column; gap: .5rem; flex-shrink: 0;
  }
  .search {
    background: #222; border: 1px solid #3a3732;
    border-radius: 6px; padding: .38rem .7rem;
    color: var(--sb-text); font-size: .82rem; width: 100%;
    outline: none;
  }
  .search:focus { border-color: var(--accent); }
  .search::placeholder { color: #555; }

  .filter-wrapper {
    display: flex; align-items: center; gap: 4px;
  }
  .gear-btn { font-size: .7rem; flex-shrink: 0; }

  .sort-row {
    display: flex; align-items: center;
    gap: .4rem; font-size: .72rem; color: #555;
  }
  .sort-sel {
    flex: 1; background: #222; border: 1px solid #3a3732;
    border-radius: 4px; color: var(--sb-text); font-size: .72rem;
    padding: 2px 4px; outline: none;
  }
</style>
