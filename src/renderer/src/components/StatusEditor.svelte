<script>
  import { project } from '../lib/stores/project.svelte.js';
  import { ui } from '../lib/stores/ui.svelte.js';

  let draft = $state([]);

  $effect(() => {
    if (ui.statusEditorOpen) {
      draft = JSON.parse(JSON.stringify(project.statuses));
    }
  });

  function moveUp(idx) {
    if (idx <= 0) return;
    const next = [...draft];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    draft = next;
  }

  function moveDown(idx) {
    if (idx >= draft.length - 1) return;
    const next = [...draft];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    draft = next;
  }

  function remove(idx) {
    draft = draft.filter((_, i) => i !== idx);
  }

  function addStatus() {
    draft = [...draft, { id: 'status' + (draft.length + 1), label: 'New Status', color: '#888888', description: '' }];
  }

  async function save() {
    // Validate unique non-empty ids
    const ids = draft.map(s => s.id.trim()).filter(Boolean);
    if (ids.length !== draft.length || new Set(ids).size !== ids.length) {
      alert('Each status needs a unique non-empty ID.');
      return;
    }
    const cleaned = draft.map(s => ({
      id: s.id.trim(),
      label: s.label.trim(),
      color: s.color,
      description: (s.description || '').trim(),
    }));
    project.meta = { ...project.meta, _statuses: cleaned };
    await project.saveMeta();
    ui.statusEditorOpen = false;
  }

  function close() {
    ui.statusEditorOpen = false;
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) close();
  }
</script>

{#if ui.statusEditorOpen}
  <div class="modal-overlay" onclick={handleOverlayClick} role="dialog">
    <div class="modal-box">
      <div class="modal-header">
        <span>Edit Statuses</span>
        <button class="modal-close" onclick={close}>&times;</button>
      </div>

      <div class="status-list">
        {#each draft as s, i}
          <div class="status-edit-row">
            <span class="move-btn" onclick={() => moveUp(i)} title="Move up">{i > 0 ? '▲' : ''}</span>
            <span class="move-btn" onclick={() => moveDown(i)} title="Move down">{i < draft.length - 1 ? '▼' : ''}</span>
            <input type="text" class="label-input" bind:value={s.label} placeholder="Label">
            <input type="text" class="id-input" bind:value={s.id} placeholder="id">
            <input type="color" bind:value={s.color}>
            <input type="text" class="desc-input" bind:value={s.description} placeholder="Description (tooltip)">
            <button class="rm-btn" onclick={() => remove(i)} title="Remove">&times;</button>
          </div>
        {/each}
      </div>

      <button class="btn-small" onclick={addStatus}>+ Add Status</button>
      <div class="modal-footer">
        <button class="btn-primary btn-small" onclick={save}>Save</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,.45);
    display: flex; align-items: center; justify-content: center;
    z-index: 9999;
  }
  .modal-box {
    background: var(--surface); border-radius: 10px; padding: 1.2rem;
    min-width: 420px; max-width: 560px; max-height: 80vh; overflow-y: auto;
    box-shadow: 0 8px 30px rgba(0,0,0,.25);
  }
  .modal-header {
    display: flex; align-items: center; justify-content: space-between;
    font-weight: 600; font-size: .9rem; margin-bottom: .8rem;
    color: var(--text);
  }
  .modal-close {
    background: none; border: none; font-size: 1.2rem; cursor: pointer;
    color: var(--muted); padding: 0 4px;
  }
  .modal-footer { margin-top: .8rem; display: flex; justify-content: flex-end; }

  .status-edit-row {
    display: flex; align-items: center; gap: .5rem; margin-bottom: .5rem;
  }
  .status-edit-row input[type="text"] {
    font-size: .8rem; padding: .3rem .5rem; border: 1px solid var(--border);
    border-radius: 5px; background: var(--surface); color: var(--text);
  }
  .status-edit-row input[type="color"] {
    width: 28px; height: 28px; border: 1px solid var(--border);
    border-radius: 5px; padding: 1px; cursor: pointer; background: none;
  }
  .label-input { flex: 1; }
  .id-input { width: 70px; font-family: var(--font-mono); font-size: .72rem; }
  .desc-input { flex: 1; font-size: .75rem; }
  .rm-btn {
    background: none; border: none; color: #c0392b; cursor: pointer;
    font-size: .9rem; padding: 2px 4px;
  }
  .move-btn {
    background: none; border: none; color: var(--muted); cursor: pointer;
    font-size: .75rem; padding: 0 2px; user-select: none;
  }
</style>
