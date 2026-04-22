<script>
  import { project } from '../../lib/stores/project.svelte.js'
  import FolderTree from './FolderTree.svelte'

  // Poems tree — full filtered/sorted list from the store, badges on,
  // drag-reorder only in "My order" mode (otherwise the manual order
  // fights the active sort).
  let items = $derived(project.filteredFiles)

  let emptyDirs = $derived(
    !project.searchQuery && !project.activeFilter
      ? [...project.dirs].filter((d) => !d.startsWith('_stories'))
      : [],
  )
</script>

<div class="file-list-scroll">
  <FolderTree
    {items}
    {emptyDirs}
    scopeRoot=""
    showBadges={true}
    canReorder={project.sortMode === 'my'}
    allowExternalDrops={true}
    dragType="application/x-writer-poem-path"
  />

  {#if project.filteredFiles.length === 0 && project.searchQuery}
    <div class="empty">No poems match.</div>
  {/if}
</div>

<style>
  .file-list-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }
  .empty {
    padding: 1rem 1.2rem;
    color: #555;
    font-size: 0.82rem;
    font-style: italic;
  }
</style>
