<script>
  import { onMount } from 'svelte'
  import { project } from '../../lib/stores/project.svelte.js'
  import { editor } from '../../lib/stores/editor.svelte.js'
  import { ui, modalAlert } from '../../lib/stores/ui.svelte.js'
  import * as api from '../../lib/api.js'

  let stories = $state([])

  onMount(async () => {
    try {
      stories = await api.getStoryMetadata()
    } catch (e) {
      stories = []
    }
  })

  function cancel() {
    ui.moveToStoryFor = null
  }

  async function pick(storyId) {
    const sourcePath = ui.moveToStoryFor
    if (!sourcePath) return
    try {
      const newPath = await api.moveToStory(sourcePath, storyId)
      editor.panes = editor.panes.map((p) =>
        p.filePath === sourcePath ? { ...p, filePath: newPath } : p,
      )
      await project.scanAll()
      await project.scanStories()
    } catch (e) {
      await modalAlert('Move failed: ' + e.message)
    }
    ui.moveToStoryFor = null
  }

  function onKeydown(e) {
    if (e.key === 'Escape') cancel()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="mts-backdrop" onclick={cancel}>
  <div class="mts-panel" onclick={(e) => e.stopPropagation()}>
    <h3 class="mts-title">Move to story</h3>
    {#if stories.length === 0}
      <div class="mts-empty">No stories yet. Create one first.</div>
    {:else}
      <div class="mts-list">
        {#each stories as s}
          <button class="mts-row" onclick={() => pick(s.id)}>
            <span class="mts-name">{s.name}</span>
            <span class="mts-slug">{s.slug}</span>
          </button>
        {/each}
      </div>
    {/if}
    <div class="mts-actions">
      <button class="mts-btn" onclick={cancel}>Cancel</button>
    </div>
  </div>
</div>

<style>
  .mts-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }
  .mts-panel {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.25);
    width: min(420px, 92vw);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    padding: 1rem 1.1rem;
  }
  .mts-title {
    margin: 0 0 0.6rem;
    font-size: 0.95rem;
    font-family: var(--font-ui);
    color: var(--text);
  }
  .mts-empty {
    padding: 1rem;
    color: var(--muted);
    font-style: italic;
    text-align: center;
    font-size: 0.85rem;
  }
  .mts-list {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
    margin-bottom: 0.7rem;
  }
  .mts-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: 0.55rem 0.7rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    cursor: pointer;
    text-align: left;
    transition: all 0.1s;
  }
  .mts-row:hover {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
  }
  .mts-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mts-slug { font-size: 0.72rem; color: var(--muted); }
  .mts-actions { display: flex; justify-content: flex-end; gap: 0.4rem; }
  .mts-btn {
    padding: 0.35rem 0.9rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text);
    cursor: pointer;
    font-size: 0.82rem;
  }
  .mts-btn:hover { background: var(--accent-light); border-color: var(--accent); color: var(--accent); }
</style>
