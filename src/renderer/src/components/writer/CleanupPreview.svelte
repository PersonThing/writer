<script>
  import { CLEANUP_RULES, applyCleanup, computeDiff } from '../../lib/cleanup.js'
  import { ui, showToast } from '../../lib/stores/ui.svelte.js'
  import { editor } from '../../lib/stores/editor.svelte.js'

  let rules = $state({})

  // Initialize all rules as enabled when opening
  $effect(() => {
    if (ui.cleanupOpen) {
      const r = {}
      for (const rule of CLEANUP_RULES) r[rule.id] = true
      rules = r
    }
  })

  let originalContent = $derived(
    editor.activePane ? editor.activePane.content : '',
  )
  let cleanedContent = $derived(applyCleanup(originalContent, rules))
  let diff = $derived(computeDiff(originalContent, cleanedContent))
  let hasChanges = $derived(originalContent !== cleanedContent)
  let changedCount = $derived(diff.filter((d) => d.type === 'changed').length)

  function apply() {
    if (!editor.activePane || !hasChanges) return
    editor.updateContent(editor.activePane.id, cleanedContent)
    showToast('Cleaned up')
    ui.cleanupOpen = false
  }

  function close() {
    ui.cleanupOpen = false
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) close()
  }
</script>

{#if ui.cleanupOpen}
  <div class="modal-overlay" onclick={handleOverlayClick} role="dialog">
    <div class="modal-box">
      <div class="modal-header">
        <span>Clean Up Formatting</span>
        <button class="modal-close" onclick={close}>&times;</button>
      </div>

      <div class="rules">
        {#each CLEANUP_RULES as rule}
          <label class="rule-toggle">
            <input type="checkbox" bind:checked={rules[rule.id]} />
            {rule.label}
          </label>
        {/each}
      </div>

      {#if !editor.activePane}
        <div class="no-file-msg">Open a file to preview cleanup.</div>
      {:else if !hasChanges}
        <div class="no-changes">No changes needed with current rules.</div>
      {:else}
        <div class="changes-summary">
          {changedCount} line{changedCount !== 1 ? 's' : ''} will change
        </div>
        <div class="diff-container">
          <div class="diff-col">
            <div class="diff-header">Original</div>
            {#each diff as d}
              <div class="diff-line" class:changed={d.type === 'changed'}>
                <span class="line-num">{d.lineNum}</span>
                <span class="line-text">{d.original || ' '}</span>
              </div>
            {/each}
          </div>
          <div class="diff-col">
            <div class="diff-header">Cleaned</div>
            {#each diff as d}
              <div class="diff-line" class:changed={d.type === 'changed'}>
                <span class="line-num">{d.lineNum}</span>
                <span class="line-text">{d.cleaned || ' '}</span>
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="modal-footer">
        <div style="flex:1"></div>

        <button class="btn-small" onclick={close}>Cancel</button>

        <button
          class="btn-primary btn-small"
          onclick={apply}
          disabled={!hasChanges}>Apply</button
        >
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
    min-width: 600px;
    max-width: 800px;
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
    gap: 0.5rem;
    align-items: center;
    padding-top: 0.8rem;
    border-top: 1px solid var(--border);
  }

  .rules {
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    flex-wrap: wrap;
    margin-bottom: 0.8rem;
  }
  .rule-toggle {
    font-size: 0.78rem;
    display: flex;
    align-items: center;
    gap: 0.3rem;
    color: var(--text);
    cursor: pointer;
  }
  .no-file-msg,
  .no-changes {
    padding: 1.5rem;
    text-align: center;
    color: var(--muted);
    font-style: italic;
    font-size: 0.85rem;
  }
  .changes-summary {
    font-size: 0.75rem;
    color: var(--accent);
    margin-bottom: 0.5rem;
  }

  .diff-container {
    display: flex;
    gap: 1px;
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .diff-col {
    flex: 1;
    overflow-x: auto;
  }
  .diff-header {
    padding: 0.3rem 0.5rem;
    font-size: 0.7rem;
    font-weight: 600;
    background: var(--bg);
    color: var(--muted);
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
  }
  .diff-line {
    display: flex;
    padding: 0.1rem 0.5rem;
    white-space: pre;
    min-height: 1.4em;
  }
  .diff-line.changed {
    background: #fdf5e6;
  }
  :global(.dark) .diff-line.changed {
    background: #2e2418;
  }
  .line-num {
    min-width: 2.5rem;
    text-align: right;
    color: var(--muted);
    padding-right: 0.5rem;
    flex-shrink: 0;
    user-select: none;
  }
  .line-text {
    flex: 1;
  }
</style>
