<script>
  import { onMount, onDestroy } from 'svelte'
  import { project } from '../../lib/stores/project.svelte.js'
  import { editor } from '../../lib/stores/editor.svelte.js'
  import { showToast } from '../../lib/stores/ui.svelte.js'
  import { iconGripDots } from '../../lib/icons.js'
  import { createWriterEditor } from '../../lib/editor/milkdown-editor.js'
  import { runFormat, detectActiveFormats } from '../../lib/editor/commands.js'

  let { pane, isActive = false } = $props()

  let rootEl = $state(null)
  let headingEl = $state(null)
  let headingValue = $state('')
  let statusOpen = $state(false)
  let qualityOpen = $state(false)

  // Milkdown handle — created on mount, destroyed on unmount.
  let mdEditor = null
  let mdReady = false
  let suppressChange = false
  let changeTimer = 0

  // ── Pane drag (works from the grip handle) ────────────────────────────
  function handleGripDragStart(e) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', pane.id)
    requestAnimationFrame(() => {
      editor.draggedPaneId = pane.id
    })
  }
  function handleGripDragEnd() {
    editor.draggedPaneId = null
    editor.dragOverPaneId = null
  }

  // ── Dropdown pickers (close on outside click) ─────────────────────────
  $effect(() => {
    if (!statusOpen && !qualityOpen) return
    function onDocClick(e) {
      if (!e.target.closest('.picker-wrap')) {
        statusOpen = false
        qualityOpen = false
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  })

  let m = $derived(project.getMeta(pane.filePath))
  let currentStatus = $derived(project.statuses.find((s) => s.id === m.status))

  // ── Heading rename tracking ────────────────────────────────────────────
  let lastFilePath = ''
  $effect(() => {
    const fp = pane.filePath
    if (fp !== lastFilePath) {
      lastFilePath = fp
      headingValue = project.displayName(fp)
      // When the pane switches to a different file, replace the editor
      // content without tearing down the instance.
      if (mdReady && mdEditor) {
        suppressChange = true
        mdEditor.setMarkdown(pane.content)
        suppressChange = false
      }
    }
  })

  $effect(() => {
    function focusHeading() {
      if (headingEl && isActive) {
        headingEl.focus()
        headingEl.select()
      }
    }
    window.addEventListener('focus-heading', focusHeading)
    return () => window.removeEventListener('focus-heading', focusHeading)
  })

  // Listen for format commands from the shared toolbar
  $effect(() => {
    function handleFormat(e) {
      if (!isActive || !mdReady || !mdEditor) return
      const { action, payload } = normalizeFormat(e.detail)
      runFormat(mdEditor.crepe.editor, action, payload)
      refreshActiveFormats()
    }
    window.addEventListener('apply-format', handleFormat)
    return () => window.removeEventListener('apply-format', handleFormat)
  })

  function normalizeFormat(detail) {
    if (typeof detail === 'string') return { action: detail, payload: null }
    return detail || { action: null, payload: null }
  }

  function refreshActiveFormats() {
    if (!mdReady || !mdEditor) return
    editor.activeFormats = detectActiveFormats(mdEditor.crepe.editor)
  }

  // ── Save / heading actions ─────────────────────────────────────────────
  function handleHeadingInput() {
    editor.setPendingRename(pane.id, headingValue.trim())
  }
  function handleHeadingKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      e.target.blur()
    }
    if (e.key === 'Escape') {
      headingValue = project.displayName(pane.filePath)
      editor.setPendingRename(pane.id, null)
      e.target.blur()
    }
  }

  async function handleStatus(statusId) {
    const cur = m.status || ''
    await project.patchMeta(pane.filePath, {
      status: cur === statusId ? '' : statusId,
    })
  }
  async function handleStar(p) {
    const cur = m.quality || 0
    await project.patchMeta(pane.filePath, { quality: cur === p ? 0 : p })
  }

  async function handleSave() {
    const ok = await editor.savePane(pane.id)
    if (ok) showToast()
  }

  function handleClose() {
    editor.closePane(pane.id)
  }

  function handleFocus() {
    editor.setActivePane(pane.id)
    refreshActiveFormats()
  }

  // Intercept Ctrl+S at the wrapper level — Milkdown would otherwise
  // swallow it. Keydown propagates up before ProseMirror handles it.
  function handleWrapperKeydown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 's' && isActive) {
      e.preventDefault()
      handleSave()
    }
  }

  // ── Mount / destroy Milkdown ─────────────────────────────────────────
  onMount(async () => {
    try {
      mdEditor = await createWriterEditor({
        root: rootEl,
        defaultValue: pane.content,
        onChange: (md) => {
          if (suppressChange) return
          editor.updateContent(pane.id, md)
          clearTimeout(changeTimer)
          changeTimer = setTimeout(refreshActiveFormats, 100)
        },
        onSelectionChange: refreshActiveFormats,
      })
      mdReady = true
    } catch (err) {
      console.error('Milkdown init failed', err)
    }
  })

  onDestroy(() => {
    clearTimeout(changeTimer)
    if (mdEditor) {
      mdEditor.destroy().catch(() => {})
      mdEditor = null
      mdReady = false
    }
  })
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  class="pane-wrapper"
  class:active={isActive}
  onclick={handleFocus}
  onkeydown={handleWrapperKeydown}
  role="group"
>
  <div class="pane-header">
    <span
      class="drag-grip"
      class:dragging={editor.draggedPaneId === pane.id}
      draggable="true"
      role="button"
      tabindex="-1"
      title="Drag to reorder"
      ondragstart={handleGripDragStart}
      ondragend={handleGripDragEnd}
    >{@html iconGripDots(12)}</span>

    <input
      type="text"
      class="file-heading"
      bind:this={headingEl}
      bind:value={headingValue}
      oninput={handleHeadingInput}
      onkeydown={handleHeadingKeydown}
      spellcheck="false"
    />

    <div class="picker-wrap">
      <button
        class="picker-btn"
        aria-label={currentStatus ? currentStatus.label : 'Status'}
        data-tip={currentStatus ? currentStatus.label : 'Status'}
        onclick={() => { statusOpen = !statusOpen; qualityOpen = false }}
      >
        <span class="status-dot" class:active={!!currentStatus} style="--dot-color: {currentStatus ? currentStatus.color : 'var(--border)'}"></span>
      </button>
      {#if statusOpen}
        <div class="picker-popup" role="menu">
          <button
            class="picker-row"
            onclick={() => { handleStatus(''); statusOpen = false }}
          >
            <span class="status-dot" style="--dot-color: var(--border)"></span>
            <span class="picker-label">None</span>
          </button>
          {#each project.statuses as s}
            <button
              class="picker-row"
              class:active={m.status === s.id}
              onclick={() => { handleStatus(s.id); statusOpen = false }}
            >
              <span class="status-dot active" style="--dot-color: {s.color}"></span>
              <span class="picker-label">{s.label}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>

    <div class="picker-wrap">
      <button
        class="picker-btn"
        aria-label="Quality"
        data-tip="Quality"
        onclick={() => { qualityOpen = !qualityOpen; statusOpen = false }}
      >
        <span class="stars">
          {#each Array(5) as _, i}
            <span class="star" class:on={i < m.quality}>&#9733;</span>
          {/each}
        </span>
      </button>
      {#if qualityOpen}
        <div class="picker-popup quality" role="menu">
          <div class="stars picker-stars">
            {#each Array(5) as _, i}
              <button
                type="button"
                class="star-btn"
                class:on={i < m.quality}
                aria-label="{i + 1} stars"
                onclick={() => { handleStar(i + 1); qualityOpen = false }}
              >&#9733;</button>
            {/each}
          </div>
          <button
            class="picker-row"
            onclick={() => { handleStar(0); qualityOpen = false }}
          >
            <span class="picker-label">Clear</span>
          </button>
        </div>
      {/if}
    </div>

    <button
      class="save-btn"
      class:saved={!pane.dirty}
      disabled={!pane.dirty}
      onclick={handleSave}
    >
      {pane.dirty ? 'Save' : 'Saved'}
    </button>

    <button class="pane-close" title="Close file" onclick={handleClose}>&times;</button>
  </div>

  <div class="editor-body">
    <div class="milkdown-root" bind:this={rootEl}></div>
  </div>
</div>

<style>
  .pane-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    border-right: 1px solid var(--border);
  }
  .pane-wrapper:last-child { border-right: none; }
  .pane-wrapper.active { box-shadow: inset 0 2px 0 var(--accent); }

  .pane-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.45rem 0.8rem;
    border-bottom: 1px solid var(--border);
    background: var(--surface);
    flex-shrink: 0;
  }
  .file-heading {
    font-family: var(--font-serif);
    font-size: 0.88rem;
    font-weight: bold;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--text);
    border: 1px solid transparent;
    border-radius: 4px;
    padding: 1px 4px;
    background: transparent;
    outline: none;
    flex: 1;
    min-width: 60px;
  }
  .file-heading:hover { border-color: var(--border); }
  .file-heading:focus { border-color: var(--accent); background: var(--surface); }

  .drag-grip {
    display: inline-flex;
    align-items: center;
    color: var(--muted);
    cursor: grab;
    padding: 2px 2px;
    border-radius: 3px;
    flex-shrink: 0;
    user-select: none;
  }
  .drag-grip:hover { color: var(--text); background: var(--accent-light); }
  .drag-grip:active { cursor: grabbing; }
  .drag-grip.dragging { opacity: 0.5; }

  .picker-wrap { position: relative; flex-shrink: 0; }
  .picker-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 6px;
    border: 1px solid transparent;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    color: var(--text);
  }
  .picker-btn:hover { border-color: var(--border); background: var(--accent-light); }
  .picker-popup {
    position: absolute;
    top: calc(100% + 4px);
    right: 0;
    z-index: 20;
    min-width: 140px;
    padding: 4px;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .picker-popup.quality { min-width: 0; align-items: stretch; }
  .picker-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 5px 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    color: var(--text);
    font-size: 0.78rem;
    font-family: var(--font-ui);
  }
  .picker-row:hover { background: var(--accent-light); }
  .picker-row.active { background: var(--accent-light); color: var(--accent); }
  .picker-label { flex: 1; }
  .picker-stars { padding: 4px 6px; justify-content: center; gap: 3px; }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: none;
    background: var(--dot-color);
    background-clip: content-box;
    padding: 4px;
    box-sizing: content-box;
    opacity: 0.4;
    display: inline-block;
    flex-shrink: 0;
  }
  .status-dot.active { opacity: 1; box-shadow: 0 0 0 2px var(--dot-color); }

  .stars { display: flex; gap: 1px; flex-shrink: 0; }
  .star { font-size: 0.85rem; color: var(--star-off); transition: color 0.1s; line-height: 1; user-select: none; }
  .star.on { color: var(--accent); }
  .star-btn {
    font-size: 1.1rem;
    background: none;
    border: none;
    padding: 0 2px;
    cursor: pointer;
    color: var(--star-off);
    line-height: 1;
    transition: color 0.1s;
  }
  .star-btn.on, .star-btn:hover { color: var(--accent); }

  .save-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 5px;
    padding: 0.18rem 0.65rem;
    height: 1.45rem;
    font-size: 0.73rem;
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
  }
  .save-btn:disabled { background: var(--border); color: var(--muted); cursor: default; }
  .save-btn.saved { background: #1e8a48; color: #fff; }

  .pane-close {
    background: none;
    border: none;
    font-size: 1.25rem;
    color: var(--muted);
    cursor: pointer;
    padding: 0 0.3rem;
    line-height: 1;
    border-radius: 4px;
    flex-shrink: 0;
  }
  .pane-close:hover { color: var(--text); background: var(--accent-light); }

  .editor-body { flex: 1; display: flex; overflow: hidden; }
  .milkdown-root {
    flex: 1;
    overflow-y: auto;
    background: var(--surface);
  }
  .milkdown-root :global(.milkdown) {
    min-height: 100%;
  }
  .milkdown-root :global(.ProseMirror) {
    padding: 1.75rem 2rem;
    font-family: var(--font-serif);
    font-size: 0.95rem;
    line-height: 1.75;
    color: var(--text);
    outline: none;
    min-height: 100%;
    max-width: 66ch;
    margin: 0 auto;
  }

  /* Writer color marks (match preview colors from the old renderer). */
  .milkdown-root :global(.md-color-red) { color: #d94a4a; }
  .milkdown-root :global(.md-color-green) { color: #3aa152; }
  .milkdown-root :global(.md-color-blue) { color: #3d7acb; }
  .milkdown-root :global(.md-color-yellow) { color: #c89a2a; }
  .milkdown-root :global(.md-bg-red) { background-color: rgba(217, 74, 74, 0.22); }
  .milkdown-root :global(.md-bg-green) { background-color: rgba(58, 161, 82, 0.22); }
  .milkdown-root :global(.md-bg-blue) { background-color: rgba(61, 122, 203, 0.22); }
  .milkdown-root :global(.md-bg-yellow) { background-color: rgba(200, 154, 42, 0.28); }
</style>
