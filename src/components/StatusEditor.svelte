<script>
  import { project, slugify } from '../lib/stores/project.svelte.js'
  import { ui, modalAlert } from '../lib/stores/ui.svelte.js'
  import { iconGripDots } from '../lib/icons.js'

  let draft = $state([])
  let dragIdx = $state(null)
  let dragOverIdx = $state(null)

  const NO_STATUS_ENTRY = {
    id: '_none',
    label: 'No Status',
    color: '#444',
    isNoStatus: true,
  }

  $effect(() => {
    if (ui.statusEditorOpen) {
      const statuses = JSON.parse(JSON.stringify(project.statuses))
      const pos = project.meta._noStatusPosition ?? statuses.length
      const clamped = Math.max(0, Math.min(pos, statuses.length))
      statuses.splice(clamped, 0, { ...NO_STATUS_ENTRY })
      draft = statuses
    }
  })

  function remove(idx) {
    draft = draft.filter((_, i) => i !== idx)
  }

  function addStatus() {
    draft = [...draft, { label: 'New Status', color: '#888888' }]
  }

  // Drag & drop reorder
  function handleDragStart(e, idx) {
    dragIdx = idx
    e.dataTransfer.effectAllowed = 'move'
    setTimeout(() => {
      e.target.style.opacity = '.4'
    }, 0)
  }

  function handleDragEnd(e) {
    e.target.style.opacity = ''
    dragIdx = null
    dragOverIdx = null
  }

  function handleDragOver(e, idx) {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    dragOverIdx = idx !== dragIdx ? idx : null
  }

  function handleDrop(e, idx) {
    e.preventDefault()
    if (dragIdx === null || idx === dragIdx) return
    const next = [...draft]
    const [item] = next.splice(dragIdx, 1)
    next.splice(idx, 0, item)
    draft = next
    dragIdx = null
    dragOverIdx = null
  }

  async function save() {
    const oldStatuses = JSON.parse(JSON.stringify(project.statuses))

    // Find position of "No Status" and extract it from the list
    const noStatusIdx = draft.findIndex((s) => s.isNoStatus)
    const statusesOnly = draft.filter((s) => !s.isNoStatus)

    const cleaned = statusesOnly.map((s) => ({
      id: slugify(s.label),
      label: s.label.trim(),
      color: s.color,
    }))

    // Validate non-empty IDs and uniqueness
    const ids = cleaned.map((s) => s.id).filter(Boolean)
    if (ids.length !== cleaned.length || new Set(ids).size !== ids.length) {
      await modalAlert('Each status needs a unique non-empty label.')
      return
    }

    project.migrateStatusIds(oldStatuses, cleaned)
    project.meta = {
      ...project.meta,
      _statuses: cleaned,
      _noStatusPosition: noStatusIdx,
    }
    await project.saveMeta()
    ui.statusEditorOpen = false
  }

  function close() {
    ui.statusEditorOpen = false
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) close()
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
          <div
            class="status-edit-row"
            class:drag-over={dragOverIdx === i}
            draggable="true"
            ondragstart={(e) => handleDragStart(e, i)}
            ondragend={handleDragEnd}
            ondragover={(e) => handleDragOver(e, i)}
            ondrop={(e) => handleDrop(e, i)}
          >
            <span class="grip-handle">{@html iconGripDots(12)}</span>
            {#if s.isNoStatus}
              <span class="no-status-dot"></span>
              <span class="no-status-label">No Status</span>
            {:else}
              <input type="color" bind:value={s.color} />
              <input
                type="text"
                class="label-input"
                bind:value={s.label}
                placeholder="Label"
              />
              <button class="rm-btn" onclick={() => remove(i)} title="Remove"
                >&times;</button
              >
            {/if}
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
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  .modal-box {
    background: var(--surface);
    border-radius: 10px;
    padding: 1.2rem;
    min-width: 360px;
    max-width: 480px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }
  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-weight: 600;
    font-size: 0.9rem;
    margin-bottom: 0.8rem;
    color: var(--text);
  }
  .modal-close {
    background: none;
    border: none;
    font-size: 1.2rem;
    cursor: pointer;
    color: var(--muted);
    padding: 0 4px;
  }
  .modal-footer {
    margin-top: 0.8rem;
    display: flex;
    justify-content: flex-end;
  }

  .status-edit-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.25rem 0.3rem;
    border-radius: 5px;
    border: 1px solid transparent;
  }
  .status-edit-row.drag-over {
    border-top: 2px solid var(--accent);
  }
  .status-edit-row input[type='text'] {
    font-size: 0.8rem;
    padding: 0.3rem 0.5rem;
    border: 1px solid var(--border);
    border-radius: 5px;
    background: var(--surface);
    color: var(--text);
  }
  .status-edit-row input[type='color'] {
    width: 28px;
    height: 28px;
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 1px;
    cursor: pointer;
    background: none;
  }
  .label-input {
    flex: 1;
  }
  .grip-handle {
    color: var(--muted);
    cursor: grab;
    flex-shrink: 0;
    display: inline-flex;
  }
  .grip-handle:active {
    cursor: grabbing;
  }
  .rm-btn {
    background: none;
    border: none;
    color: #c0392b;
    cursor: pointer;
    font-size: 0.9rem;
    padding: 2px 4px;
  }
  .no-status-dot {
    width: 28px;
    height: 28px;
    border-radius: 5px;
    border: 1px dashed var(--border);
    flex-shrink: 0;
  }
  .no-status-label {
    font-size: 0.8rem;
    color: var(--muted);
    font-style: italic;
  }
</style>
