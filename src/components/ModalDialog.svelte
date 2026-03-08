<script>
  import { ui, modalResolve } from '../lib/stores/ui.svelte.js'

  let inputEl = $state(null)

  $effect(() => {
    if (ui.modal?.type === 'prompt' && inputEl) {
      inputEl.focus()
      inputEl.select()
    }
  })

  function handleConfirm() {
    if (!ui.modal) return
    if (ui.modal.type === 'prompt') {
      modalResolve(ui.modal.inputValue?.trim() || null)
    } else if (ui.modal.type === 'confirm') {
      modalResolve(true)
    } else {
      modalResolve(undefined)
    }
  }

  function handleCancel() {
    if (!ui.modal) return
    if (ui.modal.type === 'confirm') {
      modalResolve(false)
    } else if (ui.modal.type === 'prompt') {
      modalResolve(null)
    } else {
      modalResolve(undefined)
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) handleCancel()
  }

  function handleKeydown(e) {
    if (!ui.modal) return
    if (e.key === 'Escape') handleCancel()
    if (e.key === 'Enter' && ui.modal.type !== 'prompt') handleConfirm()
  }
</script>

{#if ui.modal}
  <div
    class="modal-overlay"
    onclick={handleOverlayClick}
    onkeydown={handleKeydown}
    role="dialog"
  >
    <div class="modal-box">
      <p class="modal-message">{ui.modal.message}</p>

      {#if ui.modal.type === 'prompt'}
        <input
          class="modal-input"
          type="text"
          bind:this={inputEl}
          bind:value={ui.modal.inputValue}
          placeholder={ui.modal.placeholder}
          onkeydown={(e) => {
            if (e.key === 'Enter') handleConfirm()
          }}
        />
      {/if}

      <div class="modal-actions">
        {#if ui.modal.type !== 'alert'}
          <button class="btn-small" onclick={handleCancel}
            >{ui.modal.cancelLabel}</button
          >
        {/if}
        <button class="btn-primary btn-small" onclick={handleConfirm}
          >{ui.modal.confirmLabel}</button
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
    z-index: 99999;
  }
  .modal-box {
    background: var(--surface);
    border-radius: 10px;
    padding: 1.4rem 1.6rem;
    min-width: 320px;
    max-width: 440px;
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.25);
  }
  .modal-message {
    font-size: 0.88rem;
    line-height: 1.5;
    color: var(--text);
    margin: 0 0 1rem;
  }
  .modal-input {
    width: 100%;
    font-size: 0.85rem;
    padding: 0.45rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--bg);
    color: var(--text);
    outline: none;
    margin-bottom: 1rem;
    box-sizing: border-box;
  }
  .modal-input:focus {
    border-color: var(--accent);
  }
  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
</style>
