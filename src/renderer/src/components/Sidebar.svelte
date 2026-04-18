<script>
  import { project } from '../lib/stores/project.svelte.js'
  import { editor } from '../lib/stores/editor.svelte.js'
  import { ui, toggleSidebar } from '../lib/stores/ui.svelte.js'
  import {
    iconPlus,
    iconRefresh,
    iconGear,
    iconFolder,
  } from '../lib/icons.js'
  import { modalPrompt } from '../lib/stores/ui.svelte.js'
  import FileList from './FileList.svelte'
  import StoryList from './StoryList.svelte'

  let isStories = $derived(ui.activeTab === 'short-stories')

  async function rescan() {
    await project.scanAll()
    if (isStories) await project.scanStories()
  }

  async function newFolder() {
    const name = await modalPrompt('Folder name:')
    if (!name || !name.trim()) return
    await project.createFolder(name.trim())
  }
</script>

<aside class="sidebar" class:collapsed={ui.sidebarCollapsed}>
  {#if ui.sidebarCollapsed}
    <button
      class="sb-collapse-btn expand"
      title="Expand sidebar"
      onclick={toggleSidebar}
    >&raquo;</button>
  {:else if isStories}
    <div class="sb-header">
      <div style="flex:1"></div>
      <button
        class="sb-collapse-btn"
        title="Collapse sidebar"
        onclick={toggleSidebar}
      >&laquo;</button>
    </div>
    <StoryList />
  {:else}
    <div class="sb-header">
      <button
        class="sb-icon-btn"
        title="New poem"
        onclick={() => editor.newFile()}>{@html iconPlus()}</button
      >
      <button class="sb-icon-btn" title="Refresh file list" onclick={rescan}
        >{@html iconRefresh()}</button
      >
      <button class="sb-icon-btn" title="New folder" onclick={newFolder}
        >{@html iconFolder()}</button
      >
      <div style="flex:1"></div>
      <button
        class="sb-collapse-btn"
        title="Collapse sidebar"
        onclick={toggleSidebar}
      >&laquo;</button>
    </div>

    <div class="sb-controls">
      <div class="search-row">
        <input
          class="search"
          type="search"
          placeholder="Search poems..."
          autocomplete="off"
          bind:value={project.searchQuery}
          oninput={() => project.triggerSearch(project.searchQuery)}
        />
        <button
          class="sb-icon-btn gear-btn"
          title="Edit statuses"
          onclick={() => (ui.statusEditorOpen = true)}
          >{@html iconGear(20)}</button
        >
      </div>
      <div class="sort-row">
        <span class="sort-label">Sort:</span>
        <button
          class="sort-btn"
          class:active={project.sortMode === 'name'}
          onclick={() => (project.sortMode = 'name')}
        >Name</button>
        <button
          class="sort-btn"
          class:active={project.sortMode === 'created'}
          onclick={() => (project.sortMode = 'created')}
        >Date</button>
        <button
          class="sort-btn"
          class:active={project.sortMode === 'status'}
          onclick={() => (project.sortMode = 'status')}
        >Status</button>
      </div>
    </div>

    <div class="filter-chips">
      <button
        class="chip"
        class:active={project.activeFilter === ''}
        onclick={() => (project.activeFilter = '')}
      >
        All <span class="chip-count">{project.fileCounts._total}</span>
      </button>
      {#each project.statuses as s}
        <button
          class="chip"
          class:active={project.activeFilter === s.id}
          onclick={() =>
            (project.activeFilter = project.activeFilter === s.id ? '' : s.id)}
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
          onclick={() =>
            (project.activeFilter =
              project.activeFilter === '_none' ? '' : '_none')}
        >
          <span class="chip-dot" style="background: #444"></span>
          No Status
          <span class="chip-count">{project.fileCounts['']}</span>
        </button>
      {/if}
    </div>

    <FileList />
  {/if}
</aside>

<style>
  .sidebar {
    width: 265px;
    flex-shrink: 0;
    background: var(--sb-bg);
    color: var(--sb-text);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-right: 1px solid #000;
    transition: width 0.18s ease;
  }
  .sidebar.collapsed {
    width: 28px;
    align-items: center;
  }
  .sb-collapse-btn {
    background: none;
    border: none;
    color: #666;
    cursor: pointer;
    font-size: 0.95rem;
    padding: 2px 6px;
    border-radius: 4px;
    transition: color 0.15s, background 0.15s;
    line-height: 1;
  }
  .sb-collapse-btn:hover {
    color: #ccc;
    background: var(--sb-hover);
  }
  .sb-collapse-btn.expand {
    margin-top: 0.85rem;
    width: 100%;
    padding: 6px 0;
  }
  .sb-header {
    padding: 0.85rem 1rem;
    border-bottom: 1px solid var(--sb-border);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .sb-icon-btn {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    font-size: 0.85rem;
    padding: 2px 4px;
    border-radius: 4px;
    transition: color 0.15s;
    display: inline-flex;
    align-items: center;
  }
  .sb-icon-btn:hover {
    color: #999;
  }

  .sb-controls {
    padding: 0.65rem 0.75rem;
    border-bottom: 1px solid var(--sb-border);
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex-shrink: 0;
  }
  .search-row {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .search {
    background: #222;
    border: 1px solid #3a3732;
    border-radius: 6px;
    padding: 0.38rem 0.7rem;
    color: var(--sb-text);
    font-size: 0.82rem;
    flex: 1;
    outline: none;
  }
  .search:focus {
    border-color: var(--accent);
  }
  .search::placeholder {
    color: #555;
  }

  .gear-btn {
    flex-shrink: 0;
    padding: 2px;
  }

  .sort-row {
    display: flex;
    align-items: center;
    gap: 0.3rem;
  }
  .sort-label {
    font-size: 0.68rem;
    color: #555;
    margin-right: 0.1rem;
  }
  .sort-btn {
    background: transparent;
    border: 1px solid var(--sb-border);
    border-radius: 4px;
    color: #777;
    font-size: 0.68rem;
    padding: 0.12rem 0.4rem;
    cursor: pointer;
    transition: all 0.15s;
  }
  .sort-btn:hover {
    color: #aaa;
    border-color: #555;
  }
  .sort-btn.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  .filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--sb-border);
    flex-shrink: 0;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0.2rem 0.55rem;
    border-radius: 12px;
    font-size: 0.7rem;
    cursor: pointer;
    background: transparent;
    border: 1px solid var(--sb-border);
    color: var(--sb-text);
    transition: all 0.15s;
  }
  .chip:hover {
    background: var(--sb-hover);
    border-color: #555;
  }
  .chip.active {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }
  .chip-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .chip.active .chip-dot {
    opacity: 0.8;
  }
  .chip-count {
    color: inherit;
    opacity: 0.6;
    font-size: 0.65rem;
  }
</style>
