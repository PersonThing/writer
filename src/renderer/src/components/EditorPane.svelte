<script>
  import { parseMarkdown } from '../lib/markdown.js'
  import { project } from '../lib/stores/project.svelte.js'
  import { editor } from '../lib/stores/editor.svelte.js'
  import { showToast } from '../lib/stores/ui.svelte.js'
  import { iconShare } from '../lib/icons.js'
  import { social } from '../lib/stores/social.svelte.js'

  let { pane, isActive = false } = $props()

  let textarea = $state(null)
  let previewPaneEl = $state(null)
  let headingEl = $state(null)
  let headingValue = $state('')
  let _undoTimer = 0
  let _caseTimer = 0
  let _caseCount = 0
  let _syncRaf = 0

  // ── Derived ────────────────────────────────────────────────────────────
  let effectiveView = $derived(
    editor.isMultiPane && editor.viewMode === 'split'
      ? 'edit'
      : editor.viewMode,
  )
  let showEdit = $derived(effectiveView !== 'preview')
  let showPreview = $derived(effectiveView !== 'edit')
  let previewHtml = $derived(parseMarkdown(pane.content))
  let m = $derived(project.getMeta(pane.filePath))

  // ── Effects ────────────────────────────────────────────────────────────
  $effect(() => {
    headingValue = project.displayName(pane.filePath)
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
      if (isActive) applyFmt(e.detail)
    }
    window.addEventListener('apply-format', handleFormat)
    return () => window.removeEventListener('apply-format', handleFormat)
  })

  // ── Header actions ─────────────────────────────────────────────────────
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

  async function handleSocial() {
    await project.patchMeta(pane.filePath, { social: !m.social })
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
  }

  function handleInput(e) {
    editor.updateContent(pane.id, e.target.value)
  }

  // ── Formatting helpers ─────────────────────────────────────────────────
  function taInsert(before, after, placeholder) {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart,
      e = ta.selectionEnd
    const sel = ta.value.slice(s, e) || placeholder || ''
    const rep = before + sel + after
    ta.value = ta.value.slice(0, s) + rep + ta.value.slice(e)
    if (!ta.value.slice(s, e) && placeholder && sel === placeholder) {
      ta.selectionStart = s + before.length
      ta.selectionEnd = s + before.length + sel.length
    } else {
      ta.selectionStart = ta.selectionEnd = s + rep.length
    }
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function getLineRange() {
    const ta = textarea
    if (!ta) return null
    const s = ta.selectionStart
    const lineStart = ta.value.lastIndexOf('\n', s - 1) + 1
    let lineEnd = ta.value.indexOf('\n', s)
    if (lineEnd === -1) lineEnd = ta.value.length
    return { lineStart, end: lineEnd, line: ta.value.slice(lineStart, lineEnd) }
  }

  function toggleHeading(level) {
    const ta = textarea
    if (!ta) return
    const r = getLineRange()
    if (!r) return
    const prefix = '#'.repeat(level) + ' '
    const stripped = r.line.replace(/^#{1,6}\s*/, '')
    const already = r.line.startsWith(prefix)
    const newLine = already ? stripped : prefix + stripped
    ta.value = ta.value.slice(0, r.lineStart) + newLine + ta.value.slice(r.end)
    ta.selectionStart = ta.selectionEnd = r.lineStart + newLine.length
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function insertLink() {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart,
      e = ta.selectionEnd
    const sel = ta.value.slice(s, e)
    let rep, cursorStart, cursorEnd
    if (sel) {
      rep = '[' + sel + '](url)'
      cursorStart = s + sel.length + 3
      cursorEnd = s + sel.length + 6
    } else {
      rep = '[link text](url)'
      cursorStart = s + 1
      cursorEnd = s + 10
    }
    ta.value = ta.value.slice(0, s) + rep + ta.value.slice(e)
    ta.selectionStart = cursorStart
    ta.selectionEnd = cursorEnd
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function insertHR() {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart
    const before = ta.value.slice(0, s)
    const after = ta.value.slice(s)
    const nl = before.length && !before.endsWith('\n') ? '\n' : ''
    const insert = nl + '\n---\n\n'
    ta.value = before + insert + after
    ta.selectionStart = ta.selectionEnd = s + insert.length
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function toggleBullet() {
    const ta = textarea
    if (!ta) return
    const r = getLineRange()
    if (!r) return
    const newLine = r.line.startsWith('- ') ? r.line.slice(2) : '- ' + r.line
    ta.value = ta.value.slice(0, r.lineStart) + newLine + ta.value.slice(r.end)
    ta.selectionStart = ta.selectionEnd = r.lineStart + newLine.length
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function insertPoetryLineBreak() {
    const ta = textarea
    if (!ta) return
    const r = getLineRange()
    if (!r) return
    const trimmed = r.line.trimEnd()
    if (trimmed.endsWith('\\')) {
      // Toggle off: remove the backslash
      const newLine = trimmed.slice(0, -1).trimEnd()
      ta.value =
        ta.value.slice(0, r.lineStart) + newLine + ta.value.slice(r.end)
      ta.selectionStart = ta.selectionEnd = r.lineStart + newLine.length
    } else {
      // Append backslash and insert a new line
      const replacement = trimmed + '\\\n'
      ta.value =
        ta.value.slice(0, r.lineStart) + replacement + ta.value.slice(r.end)
      ta.selectionStart = ta.selectionEnd = r.lineStart + replacement.length
    }
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function duplicateLine() {
    const ta = textarea
    if (!ta) return
    const r = getLineRange()
    if (!r) return
    const insert = '\n' + r.line
    ta.value = ta.value.slice(0, r.end) + insert + ta.value.slice(r.end)
    ta.selectionStart = ta.selectionEnd = r.end + insert.length
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function insertEmDash() {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart
    ta.value = ta.value.slice(0, s) + '\u2014' + ta.value.slice(ta.selectionEnd)
    ta.selectionStart = ta.selectionEnd = s + 1
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function cycleCase() {
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart,
      e = ta.selectionEnd
    if (s === e) return
    const now = Date.now()
    if (now - _caseTimer > 900) _caseCount = 0
    _caseTimer = now
    _caseCount = (_caseCount % 3) + 1
    const sel = ta.value.slice(s, e)
    let t
    if (_caseCount === 1) t = sel.toUpperCase()
    else if (_caseCount === 2)
      t = sel.replace(
        /\S+/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      )
    else t = sel.toLowerCase()
    ta.value = ta.value.slice(0, s) + t + ta.value.slice(e)
    ta.selectionStart = s
    ta.selectionEnd = s + t.length
    ta.focus()
    editor.updateContent(pane.id, ta.value)
  }

  function applyFmt(action) {
    if (!textarea) return
    editor.pushUndo(
      pane.id,
      textarea.value,
      textarea.selectionStart,
      textarea.selectionEnd,
    )
    switch (action) {
      case 'bold':
        taInsert('**', '**', 'bold text')
        break
      case 'italic':
        taInsert('*', '*', 'italic text')
        break
      case 'h1':
        toggleHeading(1)
        break
      case 'h2':
        toggleHeading(2)
        break
      case 'h3':
        toggleHeading(3)
        break
      case 'link':
        insertLink()
        break
      case 'hr':
        insertHR()
        break
      case 'bullet':
        toggleBullet()
        break
      case 'poetry-br':
        insertPoetryLineBreak()
        break
      case 'em-dash':
        insertEmDash()
        break
      case 'dup-line':
        duplicateLine()
        break
      case 'case':
        cycleCase()
        break
    }
  }

  // ── Keyboard shortcuts ─────────────────────────────────────────────────
  function handleKeydown(e) {
    const ctrl = e.ctrlKey || e.metaKey
    const ta = textarea
    if (!ta) return

    if (!ctrl && !e.altKey && e.key.length === 1) {
      const now = Date.now()
      if (now - _undoTimer > 500)
        editor.pushUndo(pane.id, ta.value, ta.selectionStart, ta.selectionEnd)
      _undoTimer = now
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      const now = Date.now()
      if (now - _undoTimer > 500)
        editor.pushUndo(pane.id, ta.value, ta.selectionStart, ta.selectionEnd)
      _undoTimer = now
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      editor.pushUndo(pane.id, ta.value, ta.selectionStart, ta.selectionEnd)
      const s = ta.selectionStart
      ta.value = ta.value.slice(0, s) + '  ' + ta.value.slice(ta.selectionEnd)
      ta.selectionStart = ta.selectionEnd = s + 2
      editor.updateContent(pane.id, ta.value)
      return
    }

    if (ctrl) {
      if (e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        const snap = editor.doUndo(pane.id)
        if (snap && ta) {
          ta.value = snap.value
          ta.selectionStart = snap.s
          ta.selectionEnd = snap.e
        }
        return
      }
      if (e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        const snap = editor.doRedo(pane.id)
        if (snap && ta) {
          ta.value = snap.value
          ta.selectionStart = snap.s
          ta.selectionEnd = snap.e
        }
        return
      }
      if (e.key === 'y') {
        e.preventDefault()
        const snap = editor.doRedo(pane.id)
        if (snap && ta) {
          ta.value = snap.value
          ta.selectionStart = snap.s
          ta.selectionEnd = snap.e
        }
        return
      }
      if (e.key === 's') {
        e.preventDefault()
        handleSave()
        return
      }
      if (e.key === 'b') {
        e.preventDefault()
        applyFmt('bold')
        return
      }
      if (e.key === 'i') {
        e.preventDefault()
        applyFmt('italic')
        return
      }
      if (e.key === '1') {
        e.preventDefault()
        applyFmt('h1')
        return
      }
      if (e.key === '2') {
        e.preventDefault()
        applyFmt('h2')
        return
      }
      if (e.key === '3') {
        e.preventDefault()
        applyFmt('h3')
        return
      }
      if (e.key === 'k') {
        e.preventDefault()
        applyFmt('link')
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        applyFmt('poetry-br')
        return
      }
      if (e.key === 'd') {
        e.preventDefault()
        applyFmt('dup-line')
        return
      }
      if (e.key === '\\') {
        e.preventDefault()
        applyFmt('hr')
        return
      }
      if (e.shiftKey && e.key === 'L') {
        e.preventDefault()
        applyFmt('bullet')
        return
      }
      if (e.shiftKey && e.key === '.') {
        e.preventDefault()
        applyFmt('em-dash')
        return
      }
    }

    if (e.shiftKey && e.key === 'F3') {
      e.preventDefault()
      applyFmt('case')
      return
    }
  }

  // ── Paste URL → markdown link ──────────────────────────────────────────
  function handlePaste(e) {
    const text = (e.clipboardData || window.clipboardData).getData('text')
    if (!text || !/^https?:\/\/\S+$/.test(text.trim())) return
    const url = text.trim()
    const ta = textarea
    if (!ta) return
    const s = ta.selectionStart,
      end = ta.selectionEnd
    const sel = ta.value.slice(s, end)
    e.preventDefault()
    editor.pushUndo(pane.id, ta.value, s, end)
    const label = sel.trim() || url
    const rep = '[' + label + '](' + url + ')'
    ta.value = ta.value.slice(0, s) + rep + ta.value.slice(end)
    ta.selectionStart = ta.selectionEnd = s + rep.length
    editor.updateContent(pane.id, ta.value)
  }

  // ── Scroll sync (editor → preview) ──────────────────────────────────
  function getCursorLine(ta) {
    const text = ta.value.slice(0, ta.selectionStart)
    return text.split('\n').length - 1
  }

  function syncPreviewScroll() {
    const ta = textarea
    const preview = previewPaneEl
    if (!ta || !preview || !showEdit || !showPreview) return

    const maxScroll = ta.scrollHeight - ta.clientHeight
    if (maxScroll <= 0) {
      preview.scrollTop = 0
      return
    }

    // Base position: proportional scroll
    const frac = ta.scrollTop / maxScroll
    const previewMax = preview.scrollHeight - preview.clientHeight
    let targetScroll = frac * previewMax

    // Check if cursor is visible in the textarea viewport
    const cursorLine = getCursorLine(ta)
    const totalLines = ta.value.split('\n').length
    const lineHeight = ta.scrollHeight / totalLines
    const cursorY = cursorLine * lineHeight
    const cursorVisible =
      cursorY >= ta.scrollTop && cursorY <= ta.scrollTop + ta.clientHeight

    // If so, ensure the cursor's corresponding preview position is visible
    if (cursorVisible) {
      const els = preview.querySelectorAll('[data-source-line]')
      let cursorEl = null
      let nextEl = null
      for (const el of els) {
        const ln = parseInt(el.dataset.sourceLine, 10)
        if (ln <= cursorLine) cursorEl = el
        else { nextEl = el; break }
      }

      if (cursorEl) {
        const elStartLine = parseInt(cursorEl.dataset.sourceLine, 10)
        const elTop = cursorEl.offsetTop - preview.offsetTop

        // Interpolate within the element to find the cursor's approximate Y
        let cursorPreviewY
        if (nextEl) {
          const nextTop = nextEl.offsetTop - preview.offsetTop
          const nextLine = parseInt(nextEl.dataset.sourceLine, 10)
          const span = nextLine - elStartLine
          const frac2 = span > 0 ? (cursorLine - elStartLine) / span : 0
          cursorPreviewY = elTop + frac2 * (nextTop - elTop)
        } else {
          const elHeight = cursorEl.offsetHeight
          const endLine = totalLines - 1
          const span = endLine - elStartLine
          const frac2 = span > 0 ? (cursorLine - elStartLine) / span : 0
          cursorPreviewY = elTop + frac2 * elHeight
        }

        const viewTop = targetScroll
        const viewBottom = targetScroll + preview.clientHeight

        if (cursorPreviewY > viewBottom - 40) {
          targetScroll = cursorPreviewY - preview.clientHeight + 40
        } else if (cursorPreviewY < viewTop) {
          targetScroll = cursorPreviewY
        }
      }
    }

    preview.scrollTop = Math.max(0, Math.min(targetScroll, previewMax))
  }

  function scheduleSync() {
    if (!showPreview) return
    cancelAnimationFrame(_syncRaf)
    _syncRaf = requestAnimationFrame(syncPreviewScroll)
  }
</script>

<div
  class="pane-wrapper"
  class:active={isActive}
  onclick={handleFocus}
  role="group"
>
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
    />

    <div class="status-dots">
      {#each project.statuses as s}
        <button
          class="status-dot"
          class:active={m.status === s.id}
          style="--dot-color: {s.color}"
          data-tip={s.label}
          onclick={() => handleStatus(s.id)}
        ></button>
      {/each}
    </div>

    <div class="stars">
      {#each Array(5) as _, i}
        <span
          class="star"
          class:on={i < m.quality}
          onclick={() => handleStar(i + 1)}>&#9733;</span
        >
      {/each}
    </div>

    <button
      class="social-btn"
      class:on={m.social}
      onclick={handleSocial}
      title="Social media"
    >
      {@html iconShare()}
    </button>

    {#if m.social}
      <button
        class="compose-btn"
        onclick={() => social.open(pane.filePath, pane.content)}
      >
        Compose
      </button>
    {/if}

    <button
      class="save-btn"
      class:saved={!pane.dirty}
      disabled={!pane.dirty}
      onclick={handleSave}
    >
      {pane.dirty ? 'Save' : 'Saved'}
    </button>

    <button class="pane-close" title="Close file" onclick={handleClose}
      >&times;</button
    >
  </div>

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
          onscroll={scheduleSync}
          onkeyup={scheduleSync}
          onclick={scheduleSync}
          spellcheck="true"
          placeholder="Start writing..."
        ></textarea>
      </div>
    {/if}
    {#if showPreview}
      <div class="preview-pane" bind:this={previewPaneEl}>
        <div class="preview-content">{@html previewHtml}</div>
      </div>
    {/if}
  </div>
</div>

<style>
  /* ── Pane wrapper ──────────────────────────────────────────────────── */
  .pane-wrapper {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    border-right: 1px solid var(--border);
  }
  .pane-wrapper:last-child {
    border-right: none;
  }
  .pane-wrapper.active {
    box-shadow: inset 0 2px 0 var(--accent);
  }

  /* ── Header ────────────────────────────────────────────────────────── */
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
  .file-heading:hover {
    border-color: var(--border);
  }
  .file-heading:focus {
    border-color: var(--accent);
    background: var(--surface);
  }

  .status-dots {
    display: flex;
    gap: 0;
    flex-shrink: 0;
    align-items: center;
  }
  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    border: none;
    background: var(--dot-color);
    background-clip: content-box;
    cursor: pointer;
    padding: 4px;
    box-sizing: content-box;
    opacity: 0.4;
    transition:
      opacity 0.15s,
      box-shadow 0.15s;
  }
  .status-dot:hover {
    opacity: 0.8;
  }
  .status-dot.active {
    opacity: 1;
    box-shadow: 0 0 0 2px var(--dot-color);
  }

  .stars {
    display: flex;
    gap: 1px;
    flex-shrink: 0;
  }
  .star {
    font-size: 0.85rem;
    cursor: pointer;
    color: var(--star-off);
    transition: color 0.1s;
    line-height: 1;
    user-select: none;
  }
  .star.on {
    color: var(--accent);
  }

  .social-btn {
    font-size: 0.7rem;
    padding: 0.18rem 0.4rem;
    height: 1.45rem;
    border-radius: 5px;
    border: 1px solid var(--border);
    background: var(--surface);
    cursor: pointer;
    color: var(--muted);
    transition: all 0.13s;
    flex-shrink: 0;
    line-height: 1;
    display: inline-flex;
    align-items: center;
  }
  .social-btn.on {
    border-color: #7c35d4;
    color: #7c35d4;
    background: #f5eeff;
  }
  :global(.dark) .social-btn.on {
    background: #2a1f3a;
  }

  .compose-btn {
    font-size: 0.68rem;
    padding: 0.18rem 0.5rem;
    height: 1.45rem;
    border-radius: 5px;
    border: 1px solid #7c35d4;
    background: #f5eeff;
    color: #7c35d4;
    cursor: pointer;
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    font-weight: 600;
    transition: all 0.13s;
  }
  .compose-btn:hover {
    background: #ede0ff;
  }
  :global(.dark) .compose-btn {
    background: #2a1f3a;
  }
  :global(.dark) .compose-btn:hover {
    background: #3a2d4f;
  }

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
  .save-btn:disabled {
    background: var(--border);
    color: var(--muted);
    cursor: default;
  }
  .save-btn.saved {
    background: #1e8a48;
    color: #fff;
  }

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
  .pane-close:hover {
    color: var(--text);
    background: var(--accent-light);
  }

  /* ── Editor body ───────────────────────────────────────────────────── */
  .editor-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
  .edit-pane {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .editor-body.split .edit-pane {
    border-right: 1px solid var(--border);
  }
  .md-textarea {
    flex: 1;
    width: 100%;
    padding: 1.75rem 2rem;
    font-family: var(--font-mono);
    font-size: 0.855rem;
    line-height: 1.75;
    border: none;
    outline: none;
    resize: none;
    color: var(--text);
    background: var(--surface);
    tab-size: 2;
  }
  .preview-pane {
    flex: 1;
    overflow-y: auto;
    padding: 2rem 2.5rem;
    background: var(--bg);
  }
  .preview-content {
    max-width: 66ch;
    margin: 0 auto;
    font-family: var(--font-serif);
    line-height: 1.85;
    color: var(--text);
  }
  .preview-content :global(h1) {
    font-size: 1.45rem;
    margin-bottom: 0.9rem;
    color: var(--accent);
  }
  .preview-content :global(h2) {
    font-size: 1.15rem;
    margin: 1.4rem 0 0.5rem;
  }
  .preview-content :global(h3) {
    font-size: 1rem;
    margin: 1rem 0 0.3rem;
  }
  .preview-content :global(p) {
    margin-bottom: 0.9rem;
  }
  .preview-content :global(em) {
    font-style: italic;
  }
  .preview-content :global(strong) {
    font-weight: bold;
  }
  .preview-content :global(hr) {
    border: none;
    border-top: 1px solid var(--border);
    margin: 1.5rem 0;
  }
  .preview-content :global(blockquote) {
    border-left: 3px solid var(--accent);
    margin-left: 0;
    padding-left: 1rem;
    color: var(--muted);
    font-style: italic;
  }
  .preview-content :global(code) {
    font-family: var(--font-mono);
    font-size: 0.85em;
    background: var(--bg);
    padding: 1px 5px;
    border-radius: 3px;
  }
  .preview-content :global(a) {
    color: var(--accent);
    text-decoration: underline;
  }
</style>
