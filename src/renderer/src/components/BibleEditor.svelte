<script>
  import { editor } from '../lib/stores/editor.svelte.js'
  import { project } from '../lib/stores/project.svelte.js'
  import { modalPrompt, modalConfirm, showToast } from '../lib/stores/ui.svelte.js'
  import { iconPlus, iconTrash, iconGripDots } from '../lib/icons.js'

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

  // Parse markdown into sections based on H2 headings
  let sections = $state([])
  let title = $state('')
  let activeSection = $state(0)

  function parseBible(content) {
    const lines = content.split('\n')
    const parsed = []
    let currentTitle = ''
    let sectionTitle = null
    let sectionBody = []

    for (const line of lines) {
      if (line.startsWith('# ') && !currentTitle) {
        currentTitle = line.slice(2).trim()
        continue
      }
      if (line.startsWith('## ')) {
        if (sectionTitle !== null) {
          parsed.push({ title: sectionTitle, body: sectionBody.join('\n').trim() })
        }
        sectionTitle = line.slice(3).trim()
        sectionBody = []
      } else if (sectionTitle !== null) {
        sectionBody.push(line)
      }
    }
    if (sectionTitle !== null) {
      parsed.push({ title: sectionTitle, body: sectionBody.join('\n').trim() })
    }

    title = currentTitle || 'Story Bible'
    sections = parsed
  }

  function serialize() {
    let md = `# ${title}\n`
    for (const s of sections) {
      md += `\n## ${s.title}\n\n${s.body}\n`
    }
    return md
  }

  function updateAndSync() {
    const content = serialize()
    editor.updateContent(pane.id, content)
  }

  // Parse on initial load and when content changes externally
  $effect(() => {
    if (pane.content !== undefined) {
      // Only re-parse if content matches saved (not during editing)
      if (!pane.dirty || sections.length === 0) {
        parseBible(pane.content)
      }
    }
  })

  function updateSectionBody(index, newBody) {
    sections[index] = { ...sections[index], body: newBody }
    sections = [...sections]
    updateAndSync()
  }

  async function addSection() {
    const name = await modalPrompt('Category name:')
    if (!name || !name.trim()) return
    sections = [...sections, { title: name.trim(), body: '' }]
    activeSection = sections.length - 1
    updateAndSync()
  }

  async function removeSection(index) {
    const s = sections[index]
    if (!(await modalConfirm(`Remove "${s.title}" section?`))) return
    sections = sections.filter((_, i) => i !== index)
    if (activeSection >= sections.length) activeSection = Math.max(0, sections.length - 1)
    updateAndSync()
  }

  async function renameSection(index) {
    const s = sections[index]
    const newName = await modalPrompt('Rename category:', { defaultValue: s.title })
    if (!newName || !newName.trim() || newName.trim() === s.title) return
    sections[index] = { ...sections[index], title: newName.trim() }
    sections = [...sections]
    updateAndSync()
  }

  async function save() {
    const ok = await editor.savePane(pane.id)
    if (ok) showToast('Saved')
  }

  function handleKeydown(e) {
    if (e.ctrlKey && e.key === 's') {
      e.preventDefault()
      save()
    }
  }

  // Auto-resize textareas
  function autoResize(el) {
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  class="bible-editor"
  class:active={isActive}
  onclick={() => editor.setActivePane(pane.id)}
  onkeydown={handleKeydown}
  role="article"
>
  <div class="bible-header">
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
    <span class="bible-title">{title}</span>
    <div class="bible-header-actions">
      {#if pane.dirty}
        <button class="save-btn" onclick={save}>Save</button>
      {:else}
        <span class="saved-label">Saved</span>
      {/if}
      <button class="close-btn" onclick={() => editor.closePane(pane.id)}>&times;</button>
    </div>
  </div>

  <div class="bible-body">
    <div class="bible-nav">
      {#each sections as s, i}
        <button
          class="nav-item"
          class:active={activeSection === i}
          onclick={() => (activeSection = i)}
          ondblclick={() => renameSection(i)}
        >
          {s.title}
        </button>
      {/each}
      <button class="nav-add" onclick={addSection} title="Add category">
        {@html iconPlus(12)} Add
      </button>
    </div>

    <div class="bible-content">
      {#if sections.length === 0}
        <div class="bible-empty">
          No categories yet. Click "Add" to create one.
        </div>
      {:else if sections[activeSection]}
        <div class="section-header">
          <h2>{sections[activeSection].title}</h2>
          <button
            class="section-del"
            onclick={() => removeSection(activeSection)}
            title="Remove this category"
          >{@html iconTrash(14)}</button>
        </div>
        <textarea
          class="section-textarea"
          value={sections[activeSection].body}
          oninput={(e) => {
            updateSectionBody(activeSection, e.target.value)
            autoResize(e.target)
          }}
          onfocus={(e) => autoResize(e.target)}
          placeholder="Write content for this category..."
          spellcheck="true"
        ></textarea>
      {/if}
    </div>
  </div>
</div>

<style>
  .bible-editor {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
    border-right: 1px solid var(--border);
    opacity: 0.85;
  }
  .bible-editor.active {
    opacity: 1;
  }

  .bible-header {
    display: flex;
    align-items: center;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid var(--border);
    background: var(--bg);
    gap: 8px;
    flex-shrink: 0;
  }
  .bible-title {
    flex: 1;
    font-family: var(--font-serif);
    font-size: 0.85rem;
    color: var(--accent);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
  .bible-header-actions {
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

  .bible-body {
    flex: 1;
    display: flex;
    overflow: hidden;
  }

  .bible-nav {
    width: 160px;
    flex-shrink: 0;
    border-right: 1px solid var(--border);
    overflow-y: auto;
    padding: 0.4rem 0;
    background: var(--bg);
  }
  .nav-item {
    display: block;
    width: 100%;
    padding: 0.35rem 0.75rem;
    font-size: 0.75rem;
    text-align: left;
    background: none;
    border: none;
    color: var(--text);
    cursor: pointer;
    transition: background 0.1s;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .nav-item:hover {
    background: var(--accent-light);
  }
  .nav-item.active {
    background: var(--accent-light);
    color: var(--accent);
    font-weight: 500;
  }
  .nav-add {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 0.35rem 0.75rem;
    font-size: 0.7rem;
    text-align: left;
    background: none;
    border: none;
    border-top: 1px solid var(--border);
    color: var(--muted);
    cursor: pointer;
    margin-top: 0.3rem;
    padding-top: 0.5rem;
  }
  .nav-add:hover {
    color: var(--accent);
  }

  .bible-content {
    flex: 1;
    padding: 1rem 1.2rem;
    overflow-y: auto;
  }
  .bible-empty {
    color: var(--muted);
    font-style: italic;
    font-size: 0.85rem;
    padding: 2rem 0;
    text-align: center;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 0.8rem;
  }
  .section-header h2 {
    font-family: var(--font-serif);
    font-size: 1.05rem;
    color: var(--accent);
    margin: 0;
    flex: 1;
  }
  .section-del {
    background: none;
    border: none;
    color: var(--muted);
    cursor: pointer;
    padding: 2px;
    opacity: 0.5;
    transition: opacity 0.15s, color 0.15s;
  }
  .section-del:hover {
    opacity: 1;
    color: #e55;
  }

  .section-textarea {
    width: 100%;
    min-height: 200px;
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0.8rem;
    font-family: var(--font-mono, 'Menlo', monospace);
    font-size: 0.82rem;
    color: var(--text);
    resize: vertical;
    outline: none;
    line-height: 1.6;
  }
  .section-textarea:focus {
    border-color: var(--accent);
  }
  .section-textarea::placeholder {
    color: var(--muted);
  }
</style>
