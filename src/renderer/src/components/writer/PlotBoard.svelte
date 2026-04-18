<script>
  import yaml from 'js-yaml'
  import { tick } from 'svelte'
  import { editor } from '../../lib/stores/editor.svelte.js'
  import { project } from '../../lib/stores/project.svelte.js'
  import { showToast, modalPrompt } from '../../lib/stores/ui.svelte.js'
  import { iconPlus, iconGripDots } from '../../lib/icons.js'
  import PlotNote from './PlotNote.svelte'

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

  let { pane, isActive } = $props()

  // ── State ─────────────────────────────────────────────────────────────────
  let notes = $state([])
  let connections = $state([])
  let bodyText = $state('')
  let selectedNote = $state(null)

  // Port-based connecting: { noteId, side } or null
  let connectingFrom = $state(null)
  // For drag-connecting: mouse position while dragging from a port
  let dragLine = $state(null)

  let canvasEl = $state(null)
  // Bumped after DOM updates that change card sizes (e.g. selection showing color picker)
  // so that connection paths re-read the actual element dimensions.
  let layoutGen = $state(0)

  $effect(() => {
    // Track selectedNote — when it changes, cards resize (color picker appears/disappears).
    // After the DOM updates, bump layoutGen to force connection path recalculation.
    selectedNote;  // subscribe
    tick().then(() => { layoutGen++ })
  })

  // Note width (must match PlotNote CSS)
  const NOTE_W = 180

  // ── Parse YAML front matter ────────────────────────────────────────────────
  function parsePlot(content) {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
    if (!match) {
      notes = []
      connections = []
      bodyText = content
      return
    }

    try {
      const data = yaml.load(match[1]) || {}
      notes = (data.notes || []).map((n) => ({
        id: n.id || crypto.randomUUID().slice(0, 8),
        text: n.text || n.title || '',
        x: n.x || 0,
        y: n.y || 0,
        color: n.color || '#fef08a',
        file: n.file || '',
      }))
      connections = (data.connections || []).map((c) => ({
        from: c.from,
        fromSide: c.fromSide || 'right',
        to: c.to,
        toSide: c.toSide || 'left',
        label: c.label || '',
      }))
    } catch {
      notes = []
      connections = []
    }
    bodyText = match[2].trim()
  }

  function serialize() {
    const data = {
      notes: notes.map((n) => {
        const obj = {
          id: n.id,
          text: n.text,
          x: Math.round(n.x),
          y: Math.round(n.y),
          color: n.color,
        }
        if (n.file) obj.file = n.file
        return obj
      }),
      connections: connections.map((c) => {
        const obj = { from: c.from, fromSide: c.fromSide, to: c.to, toSide: c.toSide }
        if (c.label) obj.label = c.label
        return obj
      }),
    }

    const yamlStr = yaml.dump(data, { flowLevel: -1, lineWidth: 120 })
    return `---\n${yamlStr}---\n\n${bodyText}\n`
  }

  function updateAndSync() {
    const content = serialize()
    editor.updateContent(pane.id, content)
  }

  // Parse on load
  $effect(() => {
    if (pane.content !== undefined && !pane.dirty) {
      parsePlot(pane.content)
    }
  })

  // ── Note operations ────────────────────────────────────────────────────────

  const NOTE_COLORS = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fecaca', '#e9d5ff', '#fed7aa']

  function addNote() {
    const scrollX = canvasEl?.scrollLeft || 0
    const scrollY = canvasEl?.scrollTop || 0
    const x = scrollX + 100 + Math.random() * 200
    const y = scrollY + 80 + Math.random() * 150

    const newNote = {
      id: crypto.randomUUID().slice(0, 8),
      text: '',
      x: Math.round(x),
      y: Math.round(y),
      color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
      file: '',
    }
    notes = [...notes, newNote]
    selectedNote = newNote.id
    updateAndSync()
  }

  function moveNote(id, x, y) {
    notes = notes.map((n) => (n.id === id ? { ...n, x, y } : n))
    updateAndSync()
  }

  function updateNote(id, patch) {
    notes = notes.map((n) => (n.id === id ? { ...n, ...patch } : n))
    updateAndSync()
  }

  function deleteNote(id) {
    notes = notes.filter((n) => n.id !== id)
    connections = connections.filter((c) => c.from !== id && c.to !== id)
    if (selectedNote === id) selectedNote = null
    updateAndSync()
  }

  function selectNote(id) {
    selectedNote = id
  }

  // ── Port positions ───────────────────────────────────────────────────────

  function getPortPos(noteId, side) {
    void layoutGen // reactive dependency — re-read DOM when layout changes
    const n = notes.find((n) => n.id === noteId)
    if (!n) return { x: 0, y: 0 }
    // Read actual rendered height from DOM, fall back to reasonable default
    const el = canvasEl?.querySelector(`[data-note-id="${noteId}"]`)
    const h = el ? el.offsetHeight : 90
    const w = el ? el.offsetWidth : NOTE_W
    switch (side) {
      case 'top': return { x: n.x + w / 2, y: n.y }
      case 'bottom': return { x: n.x + w / 2, y: n.y + h }
      case 'left': return { x: n.x, y: n.y + h / 2 }
      case 'right': return { x: n.x + w, y: n.y + h / 2 }
      default: return { x: n.x + w / 2, y: n.y + h / 2 }
    }
  }

  function bezierPath(from, fromSide, to, toSide) {
    const offset = 60
    const dirs = { top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }
    const fd = dirs[fromSide] || dirs.right
    const td = dirs[toSide] || dirs.left
    const c1x = from.x + fd.x * offset
    const c1y = from.y + fd.y * offset
    const c2x = to.x + td.x * offset
    const c2y = to.y + td.y * offset
    return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`
  }

  // ── Connection operations ──────────────────────────────────────────────────

  function handlePortClick(noteId, side) {
    if (!connectingFrom) {
      connectingFrom = { noteId, side }
    } else {
      if (connectingFrom.noteId === noteId) {
        connectingFrom = null
        return
      }
      // Don't add duplicate
      const exists = connections.some(
        (c) =>
          (c.from === connectingFrom.noteId && c.to === noteId) ||
          (c.from === noteId && c.to === connectingFrom.noteId),
      )
      if (!exists) {
        connections = [...connections, {
          from: connectingFrom.noteId,
          fromSide: connectingFrom.side,
          to: noteId,
          toSide: side,
          label: '',
        }]
        updateAndSync()
      }
      connectingFrom = null
    }
    dragLine = null
  }

  function handlePortDragStart(noteId, side, e) {
    e.stopPropagation()
    e.preventDefault()

    // If already connecting from a previous click, complete the connection
    if (connectingFrom && connectingFrom.noteId !== noteId) {
      const exists = connections.some(
        (c) =>
          (c.from === connectingFrom.noteId && c.to === noteId) ||
          (c.from === noteId && c.to === connectingFrom.noteId),
      )
      if (!exists) {
        connections = [...connections, {
          from: connectingFrom.noteId,
          fromSide: connectingFrom.side,
          to: noteId,
          toSide: side,
          label: '',
        }]
        updateAndSync()
      }
      connectingFrom = null
      dragLine = null
      return
    }

    connectingFrom = { noteId, side }
    const pos = getPortPos(noteId, side)
    dragLine = { from: pos, fromSide: side, to: { x: pos.x, y: pos.y }, toSide: oppositeSide(side) }
    let didDrag = false

    function onMove(e) {
      didDrag = true
      if (!canvasEl) return
      const rect = canvasEl.getBoundingClientRect()
      dragLine = {
        ...dragLine,
        to: {
          x: e.clientX - rect.left + canvasEl.scrollLeft,
          y: e.clientY - rect.top + canvasEl.scrollTop,
        },
      }
    }

    function onUp(e) {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)

      if (!didDrag) {
        // No drag happened — this was a click. Leave connectingFrom set
        // so the next port click completes the connection.
        dragLine = null
        return
      }

      // Check if we dropped on a port
      const target = document.elementFromPoint(e.clientX, e.clientY)
      const portEl = target?.closest?.('[data-port]')
      if (portEl) {
        const targetNoteId = portEl.dataset.noteId
        const targetSide = portEl.dataset.port
        if (targetNoteId && targetNoteId !== noteId) {
          const exists = connections.some(
            (c) =>
              (c.from === noteId && c.to === targetNoteId) ||
              (c.from === targetNoteId && c.to === noteId),
          )
          if (!exists) {
            connections = [...connections, {
              from: noteId,
              fromSide: side,
              to: targetNoteId,
              toSide: targetSide,
              label: '',
            }]
            updateAndSync()
          }
        }
      }
      connectingFrom = null
      dragLine = null
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function oppositeSide(side) {
    return { top: 'bottom', bottom: 'top', left: 'right', right: 'left' }[side] || 'left'
  }

  function deleteConnection(index) {
    connections = connections.filter((_, i) => i !== index)
    updateAndSync()
  }

  function cancelConnect() {
    connectingFrom = null
    dragLine = null
  }

  // ── Check if a note has connections on a given side ─────────────────────

  function noteHasConnectionOnSide(noteId, side) {
    return connections.some(
      (c) => (c.from === noteId && c.fromSide === side) || (c.to === noteId && c.toSide === side),
    )
  }

  // ── Link note to file ──────────────────────────────────────────────────────

  async function linkNoteToFile() {
    if (!selectedNote) return
    const note = notes.find((n) => n.id === selectedNote)
    if (!note) return

    const parts = pane.filePath.split('/')
    const storyIdx = parts.indexOf('_stories')
    if (storyIdx === -1 || storyIdx + 1 >= parts.length) return
    const storyName = parts[storyIdx + 1]

    const chapters = project.getStoryChapters(storyName)
    if (chapters.length === 0) {
      showToast('No chapters to link')
      return
    }

    const fileName = await modalPrompt(
      `Link to file:\n${chapters.join(', ')}`,
      { defaultValue: note.file || chapters[0] },
    )
    if (fileName === null) return
    updateNote(selectedNote, { file: fileName })
  }

  // ── Note color ─────────────────────────────────────────────────────────────

  function changeColor(id, color) {
    updateNote(id, { color })
  }

  // Pre-compute connection paths reactively so they update when layout changes
  let connPaths = $derived.by(() => {
    void layoutGen // re-derive when card sizes change
    return connections.map((conn) => {
      const from = getPortPos(conn.from, conn.fromSide)
      const to = getPortPos(conn.to, conn.toSide)
      const d = bezierPath(from, conn.fromSide, to, conn.toSide)
      return { from, to, d }
    })
  })

  // Compute canvas extent for SVG sizing
  let canvasExtent = $derived.by(() => {
    let maxX = 800
    let maxY = 600
    for (const n of notes) {
      maxX = Math.max(maxX, n.x + 250)
      maxY = Math.max(maxY, n.y + 150)
    }
    return { width: maxX, height: maxY }
  })

  // ── Open linked file ─────────────────────────────────────────────────────

  function openLinkedFile(fileName) {
    const parts = pane.filePath.split('/')
    const storyIdx = parts.indexOf('_stories')
    if (storyIdx === -1 || storyIdx + 1 >= parts.length) return
    const storyName = parts[storyIdx + 1]
    const relPath = project.storyFilePath(storyName, fileName)
    editor.openFile(relPath, { newPane: true })
  }

  // ── Save ───────────────────────────────────────────────────────────────────

  async function save() {
    const ok = await editor.savePane(pane.id)
    if (ok) showToast('Saved')
  }

  function handleKeydown(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      save()
    }
    if (e.key === 'Escape') {
      cancelConnect()
      selectedNote = null
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      if (selectedNote && !e.target.closest('input, textarea')) {
        deleteNote(selectedNote)
      }
    }
  }

  function handleCanvasClick(e) {
    if (e.target === canvasEl || e.target.tagName === 'svg' || e.target.tagName === 'path') {
      selectedNote = null
      cancelConnect()
    }
  }

  function handleCanvasDblClick(e) {
    if (e.target !== canvasEl && e.target.tagName !== 'svg') return
    const rect = canvasEl.getBoundingClientRect()
    const x = e.clientX - rect.left + canvasEl.scrollLeft
    const y = e.clientY - rect.top + canvasEl.scrollTop
    const newNote = {
      id: crypto.randomUUID().slice(0, 8),
      text: '',
      x: Math.round(x - 90),
      y: Math.round(y - 30),
      color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
      file: '',
    }
    notes = [...notes, newNote]
    selectedNote = newNote.id
    updateAndSync()
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="plot-board"
  class:active={isActive}
  onclick={() => editor.setActivePane(pane.id)}
  onkeydown={handleKeydown}
  role="article"
  tabindex="-1"
>
  <div class="plot-header">
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
    <span class="plot-title">Plot Board</span>

    <div class="plot-toolbar">
      <button class="tool-btn" onclick={addNote} title="Add note">
        {@html iconPlus(14)} Note
      </button>
      <button
        class="tool-btn"
        onclick={linkNoteToFile}
        disabled={!selectedNote}
        title="Link note to chapter file"
      >
        &#128279; Link
      </button>
    </div>

    <div class="plot-header-actions">
      {#if pane.dirty}
        <button class="save-btn" onclick={save}>Save</button>
      {:else}
        <span class="saved-label">Saved</span>
      {/if}
      <button class="close-btn" onclick={() => editor.closePane(pane.id)}>&times;</button>
    </div>
  </div>

  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div class="plot-canvas" bind:this={canvasEl} onclick={handleCanvasClick} ondblclick={handleCanvasDblClick}>
    <!-- SVG connections layer (behind notes) -->
    <svg class="connections-svg" width={canvasExtent.width} height={canvasExtent.height}>
      {#each connPaths as cp, i}
        <!-- Thick invisible hit area -->
        <path
          d={cp.d}
          stroke="transparent"
          stroke-width="12"
          fill="none"
          onclick={(e) => { e.stopPropagation(); deleteConnection(i) }}
          class="conn-hit"
        />
        <!-- Visible line -->
        <path
          d={cp.d}
          stroke="var(--accent, #8b7355)"
          stroke-width="2"
          fill="none"
          class="conn-line"
          pointer-events="none"
        />
      {/each}

      <!-- Drag preview line -->
      {#if dragLine}
        {@const d = bezierPath(dragLine.from, dragLine.fromSide, dragLine.to, dragLine.toSide)}
        <path
          d={d}
          stroke="var(--accent, #8b7355)"
          stroke-width="2"
          stroke-dasharray="6,3"
          fill="none"
          pointer-events="none"
        />
      {/if}
    </svg>

    <!-- Notes layer -->
    {#each notes as note (note.id)}
      <PlotNote
        {note}
        selected={selectedNote === note.id}
        connecting={connectingFrom !== null}
        connectedSides={{
          top: noteHasConnectionOnSide(note.id, 'top'),
          bottom: noteHasConnectionOnSide(note.id, 'bottom'),
          left: noteHasConnectionOnSide(note.id, 'left'),
          right: noteHasConnectionOnSide(note.id, 'right'),
        }}
        onmove={moveNote}
        onselect={selectNote}
        onupdate={updateNote}
        ondelete={deleteNote}
        onopenfile={openLinkedFile}
        oncolorchange={changeColor}
        onportclick={handlePortClick}
        onportdragstart={handlePortDragStart}
      />
    {/each}
  </div>
</div>

<style>
  .plot-board {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-right: 1px solid var(--border);
    opacity: 0.85;
    outline: none;
  }
  .plot-board.active {
    opacity: 1;
  }

  .plot-header {
    display: flex;
    align-items: center;
    padding: 0.4rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    gap: 8px;
    flex-shrink: 0;
    flex-wrap: wrap;
  }
  .plot-title {
    font-family: var(--font-serif);
    font-size: 0.85rem;
    color: var(--accent);
  }
  .drag-grip {
    display: inline-flex;
    align-items: center;
    color: var(--muted);
    cursor: grab;
    padding: 2px;
    border-radius: 3px;
    flex-shrink: 0;
    user-select: none;
  }
  .drag-grip:hover {
    color: var(--text);
    background: var(--accent-light);
  }
  .drag-grip:active {
    cursor: grabbing;
  }
  .drag-grip.dragging {
    opacity: 0.5;
  }

  .plot-toolbar {
    display: flex;
    align-items: center;
    gap: 4px;
    flex: 1;
  }
  .tool-btn {
    font-size: 0.7rem;
    padding: 0.2rem 0.5rem;
    border-radius: 4px;
    border: 1px solid var(--border);
    background: transparent;
    cursor: pointer;
    color: var(--text);
    transition: all 0.12s;
    white-space: nowrap;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .tool-btn:hover:not(:disabled) {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
  }
  .tool-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .plot-header-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .save-btn {
    font-size: 0.7rem;
    padding: 0.18rem 0.5rem;
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 4px;
    cursor: pointer;
  }
  .saved-label {
    font-size: 0.68rem;
    color: var(--muted);
  }
  .close-btn {
    background: none;
    border: none;
    color: var(--muted);
    font-size: 1.1rem;
    cursor: pointer;
    padding: 0 4px;
    line-height: 1;
  }
  .close-btn:hover {
    color: var(--text);
  }

  .plot-canvas {
    flex: 1;
    position: relative;
    overflow: auto;
    background:
      radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px);
    background-size: 24px 24px;
  }

  .connections-svg {
    position: absolute;
    top: 0;
    left: 0;
    pointer-events: none;
    z-index: 0;
  }
  .conn-hit {
    pointer-events: stroke;
    cursor: pointer;
  }
  .conn-hit:hover + .conn-line {
    stroke: #e55;
    stroke-width: 3;
  }
  .conn-line {
    transition: stroke 0.12s;
  }
</style>
