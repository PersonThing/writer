<script>
  import { editor } from '../../lib/stores/editor.svelte.js'
  import { ui } from '../../lib/stores/ui.svelte.js'
  import { iconLink, iconBroom } from '../../lib/icons.js'
  import EditorPane from './EditorPane.svelte'
  import PlotBoard from './PlotBoard.svelte'
  import BibleEditor from './BibleEditor.svelte'

  // ── Derived ────────────────────────────────────────────────────────────
  let showEdit = $derived(editor.viewMode !== 'preview')
  let allSpecial = $derived(editor.panes.length > 0 && editor.panes.every((p) => p.viewType && p.viewType !== 'markdown'))

  // ── Pane reorder drag/drop (state shared via editor store) ─────────────
  function handlePaneDragOver(e, paneId) {
    if (!editor.draggedPaneId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    editor.dragOverPaneId = paneId
  }
  function handlePaneDragLeave(paneId) {
    if (editor.dragOverPaneId === paneId) editor.dragOverPaneId = null
  }
  function handlePaneDrop(e, paneId) {
    e.preventDefault()
    if (editor.draggedPaneId && editor.draggedPaneId !== paneId) {
      editor.reorderPanes(editor.draggedPaneId, paneId)
    }
    editor.draggedPaneId = null
    editor.dragOverPaneId = null
  }

  // ── Pane resize (divider between panes) ────────────────────────────────
  let panesContainerEl = $state(null)
  const MIN_PANE_PX = 160

  function startResize(e, leftIdx) {
    if (!panesContainerEl) return
    e.preventDefault()
    const panes = editor.panes
    const leftPane = panes[leftIdx]
    const rightPane = panes[leftIdx + 1]
    if (!leftPane || !rightPane) return

    const rect = panesContainerEl.getBoundingClientRect()
    const totalWidth = rect.width
    // Sum of flex values across ALL panes — the pair we're resizing only owns
    // a portion of the container. We redistribute just within that pair.
    const totalFlex = panes.reduce((s, p) => s + (p.flex || 1), 0)
    const pairFlex = (leftPane.flex || 1) + (rightPane.flex || 1)
    // Width available to the pair in pixels
    const pairPxAvailable = totalWidth * (pairFlex / totalFlex)
    const startX = e.clientX
    const startLeftFlex = leftPane.flex || 1

    function onMove(ev) {
      const dx = ev.clientX - startX
      const newLeftPx = (totalWidth * (startLeftFlex / totalFlex)) + dx
      // Clamp so neither pane drops below MIN_PANE_PX
      const minPx = MIN_PANE_PX
      const maxPx = pairPxAvailable - MIN_PANE_PX
      const clamped = Math.max(minPx, Math.min(maxPx, newLeftPx))
      // Convert px back to flex (proportional to total)
      const leftFlex = (clamped / totalWidth) * totalFlex
      const rightFlex = pairFlex - leftFlex
      editor.resizePanes(leftPane.id, rightPane.id, leftFlex, rightFlex)
    }
    function onUp() {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // ── Formatting bar buttons ─────────────────────────────────────────────
  const fmtButtons = [
    { fmt: 'bold', label: '<b>B</b>', tip: 'Bold (Ctrl+B)' },
    { fmt: 'italic', label: '<i>I</i>', tip: 'Italic (Ctrl+I)' },
    { fmt: 'strikethrough', label: '<s>S</s>', tip: 'Strikethrough (Ctrl+Shift+X)' },
    null,
    { fmt: 'h1', label: 'H1', tip: 'Heading 1 (Ctrl+1)' },
    { fmt: 'h2', label: 'H2', tip: 'Heading 2 (Ctrl+2)' },
    { fmt: 'h3', label: 'H3', tip: 'Heading 3 (Ctrl+3)' },
    null,
    { fmt: 'link', label: iconLink(), tip: 'Link (Ctrl+K)' },
    { fmt: 'hr', label: '&#9135;', tip: 'Section break (Ctrl+\\)' },
    { fmt: 'bullet', label: '&#8226; List', tip: 'Bullet list (Ctrl+Shift+L)' },
    null,
    {
      fmt: 'poetry-br',
      label: '&#8629;\\',
      tip: 'Poetry line break (Ctrl+Enter)',
    },
    { fmt: 'em-dash', label: '&#8212;', tip: 'Em dash (Ctrl+Shift+.)' },
    { fmt: 'dup-line', label: '&#10697;', tip: 'Duplicate line (Ctrl+D)' },
    null,
    { fmt: 'case', label: 'Aa', tip: 'Cycle case (Shift+F3)' },
  ]

  function dispatchFormat(fmt) {
    window.dispatchEvent(new CustomEvent('apply-format', { detail: fmt }))
  }

  function setViewMode(mode) {
    // Don't allow split in multi-pane mode
    if (mode === 'split' && editor.isMultiPane) return
    editor.viewMode = mode
  }

  // beforeunload warning
  $effect(() => {
    function handleBeforeUnload(e) {
      if (editor.anyDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  })
</script>

<div class="editor-area">
  {#if editor.panes.length === 0}
    <div class="no-file">&larr; {ui.activeTab === 'short-stories' ? 'Select a story to begin' : 'Select a poem to read or edit'}</div>
  {:else}
    <!-- Shared toolbar — hide when all panes are special views -->
    {#if allSpecial}
      <!-- No toolbar for plot-board / bible views -->
    {:else if showEdit}
      <div class="shared-toolbar">
        {#each fmtButtons as btn}
          {#if btn === null}
            <span class="fmt-sep"></span>
          {:else}
            <button
              class="fmt-btn"
              data-tip={btn.tip}
              onclick={() => dispatchFormat(btn.fmt)}
            >
              {@html btn.label}
            </button>
          {/if}
        {/each}
        <span class="fmt-sep"></span>
        <button
          class="fmt-btn"
          onclick={() => (ui.cleanupOpen = true)}
          data-tip="Clean up formatting"
        >
          {@html iconBroom()} Clean
        </button>
        <div style="flex:1"></div>
        <div class="view-toggle">
          <button
            class="vbtn"
            class:active={editor.viewMode === 'edit'}
            onclick={() => setViewMode('edit')}>Edit</button
          >
          <button
            class="vbtn"
            class:active={editor.viewMode === 'preview'}
            onclick={() => setViewMode('preview')}>Preview</button
          >
          <button
            class="vbtn"
            class:active={editor.viewMode === 'split'}
            disabled={editor.isMultiPane}
            onclick={() => setViewMode('split')}>Split</button
          >
        </div>
      </div>
    {:else}
      <!-- Preview-only mode: just show the view toggle -->
      <div class="shared-toolbar preview-only">
        <div style="flex:1"></div>
        <div class="view-toggle">
          <button
            class="vbtn"
            class:active={editor.viewMode === 'edit'}
            onclick={() => setViewMode('edit')}>Edit</button
          >
          <button
            class="vbtn"
            class:active={editor.viewMode === 'preview'}
            onclick={() => setViewMode('preview')}>Preview</button
          >
          <button
            class="vbtn"
            class:active={editor.viewMode === 'split'}
            disabled={editor.isMultiPane}
            onclick={() => setViewMode('split')}>Split</button
          >
        </div>
      </div>
    {/if}

    <div class="panes-container" bind:this={panesContainerEl}>
      {#each editor.panes as pane, idx (pane.id)}
        <div
          class="pane-slot"
          class:dragging={editor.draggedPaneId === pane.id}
          class:drag-over={editor.dragOverPaneId === pane.id && editor.draggedPaneId !== pane.id}
          style="flex: {pane.flex || 1} 1 0;"
          role="group"
          ondragover={(e) => handlePaneDragOver(e, pane.id)}
          ondragleave={() => handlePaneDragLeave(pane.id)}
          ondrop={(e) => handlePaneDrop(e, pane.id)}
        >
          {#if pane.viewType === 'plot-board'}
            <PlotBoard {pane} isActive={pane.id === editor.activePaneId} />
          {:else if pane.viewType === 'bible'}
            <BibleEditor {pane} isActive={pane.id === editor.activePaneId} />
          {:else}
            <EditorPane {pane} isActive={pane.id === editor.activePaneId} />
          {/if}
        </div>
        {#if idx < editor.panes.length - 1}
          <!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
          <div
            class="pane-resizer"
            role="separator"
            aria-orientation="vertical"
            tabindex="-1"
            onmousedown={(e) => startResize(e, idx)}
          ></div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .editor-area {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: var(--surface);
  }
  .no-file {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    font-family: var(--font-serif);
    font-style: italic;
    font-size: 1.05rem;
  }
  .panes-container {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  /* ── Pane slot (drop target wrapper) ─────────────────────────────── */
  .pane-slot {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    position: relative;
    transition: background 0.1s;
  }
  .pane-slot.dragging {
    opacity: 0.4;
  }
  .pane-slot.drag-over {
    outline: 2px solid var(--accent);
    outline-offset: -2px;
    background: var(--accent-light);
  }

  /* ── Pane resizer (divider between panes) ─────────────────────────── */
  .pane-resizer {
    flex: 0 0 5px;
    background: var(--border);
    cursor: col-resize;
    position: relative;
    transition: background 0.12s;
  }
  .pane-resizer::before {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    left: -2px;
    right: -2px;
  }
  .pane-resizer:hover,
  .pane-resizer:active {
    background: var(--accent);
  }

  /* ── Shared toolbar ─────────────────────────────────────────────────── */
  .shared-toolbar {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-wrap: wrap;
    padding: 0.25rem 0.55rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    flex-shrink: 0;
  }
  .shared-toolbar.preview-only {
    padding: 0.2rem 0.55rem;
  }
  .fmt-btn {
    font-size: 0.72rem;
    padding: 0.22rem 0.42rem;
    border-radius: 4px;
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    color: var(--text);
    font-family: var(--font-ui);
    transition:
      background 0.1s,
      border-color 0.1s,
      color 0.1s;
    white-space: nowrap;
  }
  .fmt-btn:hover {
    background: var(--accent-light);
    border-color: var(--border);
    color: var(--accent);
  }
  .fmt-sep {
    width: 1px;
    height: 16px;
    background: var(--border);
    margin: 0 3px;
    flex-shrink: 0;
  }

  /* ── View toggle ───────────────────────────────────────────────────── */
  .view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 5px;
    overflow: hidden;
    flex-shrink: 0;
  }
  .vbtn {
    font-size: 0.68rem;
    padding: 0.2rem 0.5rem;
    border: none;
    background: transparent;
    cursor: pointer;
    color: var(--muted);
    transition: all 0.1s;
  }
  .vbtn:not(:last-child) {
    border-right: 1px solid var(--border);
  }
  .vbtn.active {
    background: var(--accent-light);
    color: var(--accent);
  }
  .vbtn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
</style>
