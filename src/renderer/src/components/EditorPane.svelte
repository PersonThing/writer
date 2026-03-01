<script>
  import { parseMarkdown } from '../lib/markdown.js';
  import { project } from '../lib/stores/project.svelte.js';
  import { editor } from '../lib/stores/editor.svelte.js';
  import { ui, showToast } from '../lib/stores/ui.svelte.js';
  import { iconLink, iconBroom, iconShare } from '../lib/icons.js';

  let { pane, isActive = false } = $props();

  let textarea = $state(null);
  let headingEl = $state(null);
  let headingValue = $state('');
  let _undoTimer = 0;
  let _caseTimer = 0;
  let _caseCount = 0;

  // ── Derived ────────────────────────────────────────────────────────────
  let isSinglePane = $derived(editor.isSinglePane);
  let effectiveView = $derived(isSinglePane ? editor.viewMode : 'edit');
  let showEdit = $derived(effectiveView !== 'preview');
  let showPreview = $derived(effectiveView !== 'edit');
  let previewHtml = $derived(parseMarkdown(pane.content));
  let m = $derived(project.getMeta(pane.filePath));

  // ── Effects ────────────────────────────────────────────────────────────
  $effect(() => {
    headingValue = project.displayName(pane.filePath);
  });

  $effect(() => {
    function focusHeading() {
      if (headingEl && isActive) { headingEl.focus(); headingEl.select(); }
    }
    window.addEventListener('focus-heading', focusHeading);
    return () => window.removeEventListener('focus-heading', focusHeading);
  });

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
    { fmt: 'poetry-br', label: '&#8629;\\', tip: 'Poetry line break (Ctrl+Enter)' },
    { fmt: 'em-dash', label: '&#8212;', tip: 'Em dash (Ctrl+Shift+.)' },
    { fmt: 'dup-line', label: '&#10697;', tip: 'Duplicate line (Ctrl+D)' },
    null,
    { fmt: 'case', label: 'Aa', tip: 'Cycle case (Shift+F3)' },
  ];

  // ── Header actions ─────────────────────────────────────────────────────
  function handleHeadingInput() {
    editor.setPendingRename(pane.id, headingValue.trim());
  }

  function handleHeadingKeydown(e) {
    if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }
    if (e.key === 'Escape') {
      headingValue = project.displayName(pane.filePath);
      editor.setPendingRename(pane.id, null);
      e.target.blur();
    }
  }

  async function handleStatusChange(e) {
    await project.patchMeta(pane.filePath, { status: e.target.value });
  }

  async function handleStar(p) {
    const cur = m.quality || 0;
    await project.patchMeta(pane.filePath, { quality: cur === p ? 0 : p });
  }

  async function handleSocial() {
    await project.patchMeta(pane.filePath, { social: !m.social });
  }

  async function handleSave() {
    const ok = await editor.savePane(pane.id);
    if (ok) showToast();
  }

  function handleClose() {
    editor.closePane(pane.id);
  }

  function handleFocus() {
    editor.setActivePane(pane.id);
  }

  function handleInput(e) {
    editor.updateContent(pane.id, e.target.value);
  }

  // ── Formatting helpers ─────────────────────────────────────────────────
  function taInsert(before, after, placeholder) {
    const ta = textarea;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e) || placeholder || '';
    const rep = before + sel + after;
    ta.value = ta.value.slice(0, s) + rep + ta.value.slice(e);
    if (!ta.value.slice(s, e) && placeholder && sel === placeholder) {
      ta.selectionStart = s + before.length;
      ta.selectionEnd = s + before.length + sel.length;
    } else {
      ta.selectionStart = ta.selectionEnd = s + rep.length;
    }
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function getLineRange() {
    const ta = textarea;
    if (!ta) return null;
    const s = ta.selectionStart;
    const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1;
    let lineEnd = ta.value.indexOf('\n', s);
    if (lineEnd === -1) lineEnd = ta.value.length;
    return { lineStart, end: lineEnd, line: ta.value.slice(lineStart, lineEnd) };
  }

  function toggleHeading(level) {
    const ta = textarea;
    if (!ta) return;
    const r = getLineRange();
    if (!r) return;
    const prefix = '#'.repeat(level) + ' ';
    const stripped = r.line.replace(/^#{1,6}\s*/, '');
    const already = r.line.startsWith(prefix);
    const newLine = already ? stripped : prefix + stripped;
    ta.value = ta.value.slice(0, r.lineStart) + newLine + ta.value.slice(r.end);
    ta.selectionStart = ta.selectionEnd = r.lineStart + newLine.length;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function insertLink() {
    const ta = textarea;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = ta.value.slice(s, e);
    let rep, cursorStart, cursorEnd;
    if (sel) {
      rep = '[' + sel + '](url)';
      cursorStart = s + sel.length + 3;
      cursorEnd = s + sel.length + 6;
    } else {
      rep = '[link text](url)';
      cursorStart = s + 1;
      cursorEnd = s + 10;
    }
    ta.value = ta.value.slice(0, s) + rep + ta.value.slice(e);
    ta.selectionStart = cursorStart;
    ta.selectionEnd = cursorEnd;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function insertHR() {
    const ta = textarea;
    if (!ta) return;
    const s = ta.selectionStart;
    const before = ta.value.slice(0, s);
    const after = ta.value.slice(s);
    const nl = (before.length && !before.endsWith('\n')) ? '\n' : '';
    const insert = nl + '\n---\n\n';
    ta.value = before + insert + after;
    ta.selectionStart = ta.selectionEnd = s + insert.length;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function toggleBullet() {
    const ta = textarea;
    if (!ta) return;
    const r = getLineRange();
    if (!r) return;
    const newLine = r.line.startsWith('- ') ? r.line.slice(2) : '- ' + r.line;
    ta.value = ta.value.slice(0, r.lineStart) + newLine + ta.value.slice(r.end);
    ta.selectionStart = ta.selectionEnd = r.lineStart + newLine.length;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function insertPoetryLineBreak() {
    const ta = textarea;
    if (!ta) return;
    const r = getLineRange();
    if (!r) return;
    const trimmed = r.line.trimEnd();
    const newLine = trimmed.endsWith('\\') ? trimmed.slice(0, -1).trimEnd() : trimmed + '\\';
    ta.value = ta.value.slice(0, r.lineStart) + newLine + ta.value.slice(r.end);
    ta.selectionStart = ta.selectionEnd = r.lineStart + newLine.length;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function duplicateLine() {
    const ta = textarea;
    if (!ta) return;
    const r = getLineRange();
    if (!r) return;
    const insert = '\n' + r.line;
    ta.value = ta.value.slice(0, r.end) + insert + ta.value.slice(r.end);
    ta.selectionStart = ta.selectionEnd = r.end + insert.length;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function insertEmDash() {
    const ta = textarea;
    if (!ta) return;
    const s = ta.selectionStart;
    ta.value = ta.value.slice(0, s) + '\u2014' + ta.value.slice(ta.selectionEnd);
    ta.selectionStart = ta.selectionEnd = s + 1;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function cycleCase() {
    const ta = textarea;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    if (s === e) return;
    const now = Date.now();
    if (now - _caseTimer > 900) _caseCount = 0;
    _caseTimer = now;
    _caseCount = (_caseCount % 3) + 1;
    const sel = ta.value.slice(s, e);
    let t;
    if (_caseCount === 1) t = sel.toUpperCase();
    else if (_caseCount === 2) t = sel.replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    else t = sel.toLowerCase();
    ta.value = ta.value.slice(0, s) + t + ta.value.slice(e);
    ta.selectionStart = s;
    ta.selectionEnd = s + t.length;
    ta.focus();
    editor.updateContent(pane.id, ta.value);
  }

  function applyFmt(action) {
    if (!textarea) return;
    editor.pushUndo(pane.id, textarea.value, textarea.selectionStart, textarea.selectionEnd);
    switch (action) {
      case 'bold':       taInsert('**', '**', 'bold text'); break;
      case 'italic':     taInsert('*', '*', 'italic text'); break;
      case 'h1':         toggleHeading(1); break;
      case 'h2':         toggleHeading(2); break;
      case 'h3':         toggleHeading(3); break;
      case 'link':       insertLink(); break;
      case 'hr':         insertHR(); break;
      case 'bullet':     toggleBullet(); break;
      case 'poetry-br':  insertPoetryLineBreak(); break;
      case 'em-dash':    insertEmDash(); break;
      case 'dup-line':   duplicateLine(); break;
      case 'case':       cycleCase(); break;
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  function handleKeydown(e) {
    const ctrl = e.ctrlKey || e.metaKey;
    const ta = textarea;
    if (!ta) return;

    if (!ctrl && !e.altKey && e.key.length === 1) {
      const now = Date.now();
      if (now - _undoTimer > 500) editor.pushUndo(pane.id, ta.value, ta.selectionStart, ta.selectionEnd);
      _undoTimer = now;
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const now = Date.now();
      if (now - _undoTimer > 500) editor.pushUndo(pane.id, ta.value, ta.selectionStart, ta.selectionEnd);
      _undoTimer = now;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      editor.pushUndo(pane.id, ta.value, ta.selectionStart, ta.selectionEnd);
      const s = ta.selectionStart;
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd);
      ta.selectionStart = ta.selectionEnd = s + 2;
      editor.updateContent(pane.id, ta.value);
      return;
    }

    if (ctrl) {
      if (e.key === 'z' && !e.shiftKey) { e.preventDefault(); const snap = editor.doUndo(pane.id); if (snap && ta) { ta.value = snap.value; ta.selectionStart = snap.s; ta.selectionEnd = snap.e; } return; }
      if (e.key === 'z' && e.shiftKey)  { e.preventDefault(); const snap = editor.doRedo(pane.id); if (snap && ta) { ta.value = snap.value; ta.selectionStart = snap.s; ta.selectionEnd = snap.e; } return; }
      if (e.key === 'y')                { e.preventDefault(); const snap = editor.doRedo(pane.id); if (snap && ta) { ta.value = snap.value; ta.selectionStart = snap.s; ta.selectionEnd = snap.e; } return; }
      if (e.key === 's')                { e.preventDefault(); handleSave(); return; }
      if (e.key === 'b')                { e.preventDefault(); applyFmt('bold'); return; }
      if (e.key === 'i')                { e.preventDefault(); applyFmt('italic'); return; }
      if (e.key === '1')                { e.preventDefault(); applyFmt('h1'); return; }
      if (e.key === '2')                { e.preventDefault(); applyFmt('h2'); return; }
      if (e.key === '3')                { e.preventDefault(); applyFmt('h3'); return; }
      if (e.key === 'k')                { e.preventDefault(); applyFmt('link'); return; }
      if (e.key === 'Enter')            { e.preventDefault(); applyFmt('poetry-br'); return; }
      if (e.key === 'd')                { e.preventDefault(); applyFmt('dup-line'); return; }
      if (e.key === '\\')               { e.preventDefault(); applyFmt('hr'); return; }
      if (e.shiftKey && e.key === 'L')  { e.preventDefault(); applyFmt('bullet'); return; }
      if (e.shiftKey && e.key === '.')  { e.preventDefault(); applyFmt('em-dash'); return; }
    }

    if (e.shiftKey && e.key === 'F3') { e.preventDefault(); applyFmt('case'); return; }
  }

  // ── Paste URL → markdown link ──────────────────────────────────────────
  function handlePaste(e) {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text || !/^https?:\/\/\S+$/.test(text.trim())) return;
    const url = text.trim();
    const ta = textarea;
    if (!ta) return;
    const s = ta.selectionStart, end = ta.selectionEnd;
    const sel = ta.value.slice(s, end);
    e.preventDefault();
    editor.pushUndo(pane.id, ta.value, s, end);
    const label = sel.trim() || url;
    const rep = '[' + label + '](' + url + ')';
    ta.value = ta.value.slice(0, s) + rep + ta.value.slice(end);
    ta.selectionStart = ta.selectionEnd = s + rep.length;
    editor.updateContent(pane.id, ta.value);
  }
</script>

<div class="pane-wrapper" class:active={isActive} onclick={handleFocus} role="group">
  <!-- Header: always visible -->
  <div class="pane-header">
    <input
      type="text"
      class="file-heading"
      bind:this={headingEl}
      bind:value={headingValue}
      oninput={handleHeadingInput}
      onkeydown={handleHeadingKeydown}
      spellcheck="false"
    >

    <select class="status-sel" value={m.status || ''} onchange={handleStatusChange}>
      <option value="">—</option>
      {#each project.statuses as s}
        <option value={s.id}>{s.label}</option>
      {/each}
    </select>

    <div class="stars">
      {#each Array(5) as _, i}
        <span class="star" class:on={i < m.quality} onclick={() => handleStar(i + 1)}>&#9733;</span>
      {/each}
    </div>

    <button class="social-btn" class:on={m.social} onclick={handleSocial} title="Social media">
      {@html iconShare()}
    </button>

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

  <!-- Toolbar: only when pane is active -->
  {#if isActive && showEdit}
    <div class="pane-toolbar">
      {#each fmtButtons as btn}
        {#if btn === null}
          <span class="fmt-sep"></span>
        {:else}
          <button class="fmt-btn" data-tip={btn.tip} onclick={() => applyFmt(btn.fmt)}>
            {@html btn.label}
          </button>
        {/if}
      {/each}
      <span class="fmt-sep"></span>
      <button class="fmt-btn" onclick={() => ui.cleanupOpen = true} data-tip="Clean up formatting">
        {@html iconBroom()} Clean
      </button>
      {#if isSinglePane}
        <div style="flex:1"></div>
        <div class="view-toggle">
          <button class="vbtn" class:active={editor.viewMode === 'edit'} onclick={() => editor.viewMode = 'edit'}>Edit</button>
          <button class="vbtn" class:active={editor.viewMode === 'preview'} onclick={() => editor.viewMode = 'preview'}>Preview</button>
          <button class="vbtn" class:active={editor.viewMode === 'split'} onclick={() => editor.viewMode = 'split'}>Split</button>
        </div>
      {/if}
    </div>
  {/if}

  <!-- Editor body -->
  <div class="editor-body" class:split={showEdit && showPreview}>
    {#if showEdit}
      <div class="edit-pane">
        <textarea
          class="md-textarea"
          bind:this={textarea}
          value={pane.content}
          oninput={handleInput}
          onkeydown={handleKeydown}
          onpaste={handlePaste}
          onfocus={handleFocus}
          spellcheck="true"
          placeholder="Start writing..."
        ></textarea>
      </div>
    {/if}
    {#if showPreview}
      <div class="preview-pane">
        <div class="preview-content">{@html previewHtml}</div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Pane wrapper ──────────────────────────────────────────────────── */
  .pane-wrapper {
    flex: 1; display: flex; flex-direction: column;
    overflow: hidden; min-width: 0;
    border-right: 1px solid var(--border);
  }
  .pane-wrapper:last-child { border-right: none; }
  .pane-wrapper.active { box-shadow: inset 0 2px 0 var(--accent); }

  /* ── Header ────────────────────────────────────────────────────────── */
  .pane-header {
    display: flex; align-items: center; gap: .5rem;
    padding: .45rem .8rem; border-bottom: 1px solid var(--border);
    background: var(--surface); flex-shrink: 0;
  }
  .file-heading {
    font-family: var(--font-serif); font-size: .88rem; font-weight: bold;
    max-width: 180px; overflow: hidden; text-overflow: ellipsis;
    white-space: nowrap; color: var(--text);
    border: 1px solid transparent; border-radius: 4px;
    padding: 1px 4px; background: transparent; outline: none;
    flex-shrink: 1; min-width: 60px;
  }
  .file-heading:hover { border-color: var(--border); }
  .file-heading:focus { border-color: var(--accent); background: var(--surface); }

  .status-sel {
    font-size: .73rem; border: 1px solid var(--border); border-radius: 5px;
    padding: .2rem .4rem; background: var(--surface); cursor: pointer;
    color: var(--text); outline: none; flex-shrink: 0;
  }

  .stars { display: flex; gap: 1px; flex-shrink: 0; }
  .star {
    font-size: .85rem; cursor: pointer; color: #d0ccc6;
    transition: color .1s; line-height: 1; user-select: none;
  }
  .star.on { color: var(--accent); }

  .social-btn {
    font-size: .7rem; padding: .18rem .4rem; border-radius: 5px;
    border: 1px solid var(--border); background: var(--surface);
    cursor: pointer; color: var(--muted); transition: all .13s;
    flex-shrink: 0; line-height: 1;
  }
  .social-btn.on {
    border-color: #7c35d4; color: #7c35d4; background: #f5eeff;
  }
  :global(.dark) .social-btn.on { background: #2a1f3a; }

  .save-btn {
    margin-left: auto;
    background: var(--accent); color: #fff;
    border: none; border-radius: 5px; padding: .2rem .65rem;
    font-size: .73rem; cursor: pointer; transition: all .15s;
    flex-shrink: 0;
  }
  .save-btn:disabled { background: var(--border); color: var(--muted); cursor: default; }
  .save-btn.saved { background: #1e8a48; color: #fff; }

  .pane-close {
    background: none; border: none; font-size: 1rem; color: var(--muted);
    cursor: pointer; padding: 0 .2rem; line-height: 1; border-radius: 4px;
    flex-shrink: 0;
  }
  .pane-close:hover { color: var(--text); background: var(--accent-light); }

  /* ── Toolbar (formatting) ──────────────────────────────────────────── */
  .pane-toolbar {
    display: flex; align-items: center; gap: 2px; flex-wrap: wrap;
    padding: .25rem .55rem; border-bottom: 1px solid var(--border);
    background: var(--bg); flex-shrink: 0;
  }
  .fmt-btn {
    font-size: .72rem; padding: .22rem .42rem; border-radius: 4px;
    border: 1px solid transparent; background: transparent;
    cursor: pointer; color: var(--text); font-family: var(--font-ui);
    transition: background .1s, border-color .1s, color .1s;
    white-space: nowrap; position: relative;
  }
  .fmt-btn:hover {
    background: var(--accent-light); border-color: var(--border); color: var(--accent);
  }
  .fmt-btn[data-tip]:hover::after {
    content: attr(data-tip);
    position: absolute; bottom: calc(100% + 5px); left: 50%;
    transform: translateX(-50%);
    background: #2a2a2a; color: #f0f0f0; font-size: .65rem;
    padding: 3px 8px; border-radius: 4px; white-space: nowrap;
    pointer-events: none; z-index: 9999;
    box-shadow: 0 2px 6px rgba(0,0,0,.25);
  }
  .fmt-sep {
    width: 1px; height: 16px; background: var(--border); margin: 0 3px; flex-shrink: 0;
  }

  /* ── View toggle ───────────────────────────────────────────────────── */
  .view-toggle {
    display: flex; border: 1px solid var(--border); border-radius: 5px;
    overflow: hidden; flex-shrink: 0;
  }
  .vbtn {
    font-size: .68rem; padding: .2rem .5rem;
    border: none; background: transparent; cursor: pointer;
    color: var(--muted); transition: all .1s;
  }
  .vbtn:not(:last-child) { border-right: 1px solid var(--border); }
  .vbtn.active { background: var(--accent-light); color: var(--accent); }

  /* ── Editor body ───────────────────────────────────────────────────── */
  .editor-body {
    flex: 1; display: flex; overflow: hidden;
  }
  .edit-pane {
    flex: 1; display: flex; flex-direction: column; overflow: hidden;
  }
  .editor-body.split .edit-pane {
    border-right: 1px solid var(--border);
  }
  .md-textarea {
    flex: 1; width: 100%; padding: 1.75rem 2rem;
    font-family: var(--font-mono); font-size: .855rem; line-height: 1.75;
    border: none; outline: none; resize: none;
    color: var(--text); background: var(--surface); tab-size: 2;
  }
  .preview-pane {
    flex: 1; overflow-y: auto; padding: 2rem 2.5rem; background: var(--bg);
  }
  .preview-content {
    max-width: 66ch; margin: 0 auto;
    font-family: var(--font-serif); line-height: 1.85; color: var(--text);
  }
  .preview-content :global(h1) { font-size: 1.45rem; margin-bottom: .9rem; color: var(--accent); }
  .preview-content :global(h2) { font-size: 1.15rem; margin: 1.4rem 0 .5rem; }
  .preview-content :global(h3) { font-size: 1rem; margin: 1rem 0 .3rem; }
  .preview-content :global(p)  { margin-bottom: .9rem; }
  .preview-content :global(em) { font-style: italic; }
  .preview-content :global(strong) { font-weight: bold; }
  .preview-content :global(hr) { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }
  .preview-content :global(blockquote) {
    border-left: 3px solid var(--accent); margin-left: 0;
    padding-left: 1rem; color: var(--muted); font-style: italic;
  }
  .preview-content :global(code) {
    font-family: var(--font-mono); font-size: .85em;
    background: var(--bg); padding: 1px 5px; border-radius: 3px;
  }
  .preview-content :global(a) {
    color: var(--accent); text-decoration: underline;
  }
</style>
