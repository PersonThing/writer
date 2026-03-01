<script>
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { ui, showToast } from '../lib/stores/ui.svelte.js';

  let headingValue = $state('');

  // Sync heading value when active pane changes
  $effect(() => {
    if (editor.activePane) {
      headingValue = project.displayName(editor.activePane.filePath);
    }
  });

  function handleHeadingInput() {
    if (!editor.activePane) return;
    editor.setPendingRename(editor.activePane.id, headingValue.trim());
  }

  function handleHeadingKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape') {
      headingValue = project.displayName(editor.activePane.filePath);
      editor.setPendingRename(editor.activePane.id, null);
      e.target.blur();
    }
  }

  async function handleSave() {
    if (!editor.activePane) return;
    const ok = await editor.savePane(editor.activePane.id);
    if (ok) showToast();
  }

  async function handleStatusChange(e) {
    if (!editor.activePane) return;
    await project.patchMeta(editor.activePane.filePath, { status: e.target.value });
  }

  async function handleStar(p) {
    if (!editor.activePane) return;
    const cur = project.getMeta(editor.activePane.filePath).quality || 0;
    await project.patchMeta(editor.activePane.filePath, { quality: cur === p ? 0 : p });
  }

  async function handleSocial() {
    if (!editor.activePane) return;
    const was = project.getMeta(editor.activePane.filePath).social;
    await project.patchMeta(editor.activePane.filePath, { social: !was });
  }

  function handleClose() {
    if (editor.activePane) editor.closePane(editor.activePane.id);
  }

  function setViewMode(mode) {
    editor.viewMode = mode;
  }

  // Listen for rename focus request from context menu
  let headingEl = $state(null);
  $effect(() => {
    function focusHeading() {
      if (headingEl) { headingEl.focus(); headingEl.select(); }
    }
    window.addEventListener('focus-heading', focusHeading);
    return () => window.removeEventListener('focus-heading', focusHeading);
  });
</script>

{#if editor.activePane}
  {@const m = project.getMeta(editor.activePane.filePath)}
  <div class="toolbar">
    <input
      type="text"
      class="file-heading"
      bind:this={headingEl}
      bind:value={headingValue}
      oninput={handleHeadingInput}
      onkeydown={handleHeadingKeydown}
      spellcheck="false"
    >
    <button class="close-btn" title="Close file" onclick={handleClose}>&times;</button>
    <div class="toolbar-sep"></div>

    <select class="status-sel" value={m.status || ''} onchange={handleStatusChange}>
      <option value="">— No status</option>
      {#each project.statuses as s}
        <option value={s.id}>{s.label}</option>
      {/each}
    </select>

    <span class="quality-label">Quality</span>
    <div class="stars">
      {#each Array(5) as _, i}
        <span
          class="star"
          class:on={i < m.quality}
          onclick={() => handleStar(i + 1)}
        >&#9733;</span>
      {/each}
    </div>

    <button class="social-btn" class:on={m.social} onclick={handleSocial}>
      &#128241; Social
    </button>

    <div class="toolbar-sep"></div>

    <button class="cleanup-btn" title="Clean up formatting" onclick={() => ui.cleanupOpen = true}>
      &#128295; Clean
    </button>

    <div class="toolbar-sep"></div>

    <div class="view-btns">
      <button class="vbtn" class:active={editor.viewMode === 'split'} onclick={() => setViewMode('split')}>Split</button>
      <button class="vbtn" class:active={editor.viewMode === 'edit'} onclick={() => setViewMode('edit')}>Edit</button>
      <button class="vbtn" class:active={editor.viewMode === 'preview'} onclick={() => setViewMode('preview')}>Preview</button>
    </div>

    <button
      class="save-btn"
      class:saved={!editor.activePane.dirty}
      disabled={!editor.activePane.dirty}
      onclick={handleSave}
    >
      {editor.activePane.dirty ? 'Save' : 'Saved'}
    </button>
  </div>
{/if}

<style>
  .toolbar {
    display: flex; align-items: center; gap: .75rem; flex-wrap: wrap;
    padding: .6rem 1.1rem; border-bottom: 1px solid var(--border);
    background: var(--surface); flex-shrink: 0;
  }
  .file-heading {
    font-family: var(--font-serif); font-size: .95rem; font-weight: bold;
    max-width: 200px; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; color: var(--text);
    border: 1px solid transparent; border-radius: 4px;
    padding: 1px 4px; background: transparent; outline: none;
  }
  .file-heading:hover { border-color: var(--border); }
  .file-heading:focus { border-color: var(--accent); background: var(--surface); }

  .close-btn {
    background: none; border: none; font-size: 1.1rem; color: var(--muted);
    cursor: pointer; padding: 0 .3rem; line-height: 1; border-radius: 4px;
    transition: color .1s, background .1s;
  }
  .close-btn:hover { color: var(--text); background: var(--accent-light); }

  .toolbar-sep {
    width: 1px; height: 20px; background: var(--border); flex-shrink: 0;
  }

  .status-sel {
    font-size: .78rem; border: 1px solid var(--border); border-radius: 6px;
    padding: .28rem .5rem; background: var(--surface); cursor: pointer;
    color: var(--text); outline: none;
  }

  .quality-label { font-size: .72rem; color: var(--muted); }
  .stars { display: flex; gap: 2px; }
  .star {
    font-size: .95rem; cursor: pointer; color: #d0ccc6;
    transition: color .1s; line-height: 1; user-select: none;
  }
  .star.on { color: var(--accent); }

  .social-btn {
    font-size: .75rem; padding: .28rem .65rem; border-radius: 6px;
    border: 1px solid var(--border); background: var(--surface);
    cursor: pointer; color: var(--muted); transition: all .13s;
  }
  .social-btn.on {
    border-color: #7c35d4; color: #7c35d4;
    background: #f5eeff;
  }

  .cleanup-btn {
    font-size: .75rem; padding: .28rem .65rem; border-radius: 6px;
    border: 1px solid var(--border); background: var(--surface);
    cursor: pointer; color: var(--muted); transition: all .13s;
  }
  .cleanup-btn:hover { color: var(--accent); border-color: var(--accent); }

  .view-btns {
    display: flex; border: 1px solid var(--border); border-radius: 6px;
    overflow: hidden;
  }
  .vbtn {
    font-size: .73rem; padding: .28rem .6rem;
    border: none; background: transparent; cursor: pointer;
    color: var(--muted); transition: all .1s;
  }
  .vbtn:not(:last-child) { border-right: 1px solid var(--border); }
  .vbtn.active { background: var(--accent-light); color: var(--accent); }

  .save-btn {
    margin-left: auto; background: var(--accent); color: #fff;
    border: none; border-radius: 6px; padding: .3rem .9rem;
    font-size: .78rem; cursor: pointer; transition: all .15s;
    flex-shrink: 0;
  }
  .save-btn:disabled { background: var(--border); color: var(--muted); cursor: default; }
  .save-btn.saved { background: #1e8a48; color: #fff; }
</style>
