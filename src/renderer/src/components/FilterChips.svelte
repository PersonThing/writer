<script>
  import { project } from '../lib/stores/project.svelte.js';

  function setFilter(f) {
    project.activeFilter = f;
  }
</script>

<div class="filter-row">
  <button
    class="chip"
    class:active={project.activeFilter === ''}
    onclick={() => setFilter('')}
  >
    All ({project.fileCounts._total || 0})
  </button>
  {#each project.statuses as s}
    <button
      class="chip"
      class:active={project.activeFilter === s.id}
      title={s.description || ''}
      onclick={() => setFilter(s.id)}
    >
      {s.label} ({project.fileCounts[s.id] || 0})
    </button>
  {/each}
  <button
    class="chip"
    class:active={project.activeFilter === 'social'}
    onclick={() => setFilter('social')}
  >
    Social ({project.fileCounts.social || 0})
  </button>
</div>

<style>
  .filter-row { display: flex; flex-wrap: wrap; gap: 4px; }
  .chip {
    font-size: .67rem; padding: 2px 8px; border-radius: 10px;
    border: 1px solid #3a3732; background: transparent;
    color: #666; cursor: pointer; transition: all .13s;
    white-space: nowrap;
  }
  .chip:hover, .chip.active {
    border-color: var(--accent); color: var(--accent);
    background: rgba(184,92,26,.12);
  }
</style>
