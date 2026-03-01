<script>
  import { editor } from '../lib/stores/editor.svelte.js'
  import { ui } from '../lib/stores/ui.svelte.js'
  import { iconLink, iconBroom } from '../lib/icons.js'
  import EditorPane from './EditorPane.svelte'

  // ── Derived ────────────────────────────────────────────────────────────
  let showEdit = $derived(editor.viewMode !== 'preview')

  // ── Formatting bar buttons ─────────────────────────────────────────────
  const fmtButtons = [
    { fmt: 'bold', label: '<b>B</b>', tip: 'Bold (Ctrl+B)' },
    { fmt: 'italic', label: '<i>I</i>', tip: 'Italic (Ctrl+I)' },
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
    <div class="no-file">&larr; Select a poem to read or edit</div>
  {:else}
    <!-- Shared toolbar -->
    {#if showEdit}
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

    <div class="panes-container">
      {#each editor.panes as pane (pane.id)}
        <EditorPane {pane} isActive={pane.id === editor.activePaneId} />
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
