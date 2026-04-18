<script>
  import { project } from '../lib/stores/project.svelte.js'
  import { editor } from '../lib/stores/editor.svelte.js'
  import { ui, modalPrompt, modalConfirm, showContextMenu } from '../lib/stores/ui.svelte.js'
  import {
    iconPlus,
    iconChevronRight,
    iconChevronDown,
    iconTrash,
  } from '../lib/icons.js'

  async function newStory() {
    const name = await modalPrompt('Story name:')
    if (!name || !name.trim()) return
    await project.createStory(name.trim())
  }

  async function addChapter(storyName) {
    const name = await modalPrompt('Chapter name:')
    if (!name || !name.trim()) return
    await project.addChapter(storyName, name.trim())
  }

  function toggleStory(storyName) {
    project.activeStory = project.activeStory === storyName ? null : storyName
  }

  function openStoryFile(storyName, fileName) {
    const relPath = project.storyFilePath(storyName, fileName)
    editor.openFile(relPath)
  }

  function fileLabel(fileName) {
    if (fileName === '_plot.md') return 'Plot Board'
    if (fileName === '_bible.md') return 'Bible'
    return fileName.endsWith('.md') ? fileName.slice(0, -3) : fileName
  }

  function fileIcon(fileName) {
    if (fileName === '_plot.md') return '\u25A6' // grid/board icon
    if (fileName === '_bible.md') return '\u2630' // trigram/book icon
    return '\u2022' // bullet
  }

  async function deleteStory(storyName) {
    if (!(await modalConfirm(`Delete story "${storyName}" and all its files?`))) return
    await project.deleteStory(storyName)
  }

  function onStoryContext(e, storyName) {
    e.preventDefault()
    // Simple inline context for now — could be expanded later
  }
</script>

<div class="story-list">
  <div class="sl-header">
    <button class="sl-new-btn" onclick={newStory}>
      {@html iconPlus(14)} New Story
    </button>
  </div>

  {#if project.storyList.length === 0}
    <div class="sl-empty">No stories yet. Create one to get started.</div>
  {:else}
    {#each project.storyList as storyName}
      {@const expanded = project.activeStory === storyName}
      {@const meta = project.storyMeta[storyName] || {}}
      {@const statusColor = project.statusColor(meta.status || '')}
      <div class="story-group" class:expanded>
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="story-header"
          onclick={() => toggleStory(storyName)}
          oncontextmenu={(e) => onStoryContext(e, storyName)}
        >
          <span class="story-chevron">
            {@html expanded ? iconChevronDown(12) : iconChevronRight(12)}
          </span>
          <span class="story-dot" style="background: {statusColor}"></span>
          <span class="story-name">{storyName}</span>
          <span class="story-actions">
            <button
              class="story-action-btn"
              title="Add chapter"
              onclick={(e) => { e.stopPropagation(); addChapter(storyName) }}
            >{@html iconPlus(12)}</button>
            <button
              class="story-action-btn del"
              title="Delete story"
              onclick={(e) => { e.stopPropagation(); deleteStory(storyName) }}
            >{@html iconTrash(12)}</button>
          </span>
        </div>

        {#if expanded}
          <div class="story-files">
            {#each project.getStoryFiles(storyName) as fileName}
              {@const relPath = project.storyFilePath(storyName, fileName)}
              {@const isActive = editor.activePane?.filePath === relPath}
              <button
                class="story-file"
                class:active={isActive}
                class:special={fileName.startsWith('_')}
                onclick={() => openStoryFile(storyName, fileName)}
              >
                <span class="file-icon">{fileIcon(fileName)}</span>
                <span class="file-name">{fileLabel(fileName)}</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  {/if}
</div>

<style>
  .story-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .sl-header {
    padding: 0.6rem 0.75rem;
    border-bottom: 1px solid var(--sb-border);
  }

  .sl-new-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: none;
    border: 1px solid var(--sb-border);
    color: var(--sb-text);
    padding: 0.3rem 0.6rem;
    border-radius: 6px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: all 0.12s;
  }
  .sl-new-btn:hover {
    border-color: var(--accent);
    color: var(--accent);
  }

  .sl-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.78rem;
    font-style: italic;
  }

  .story-group {
    border-bottom: 1px solid var(--sb-border);
  }

  .story-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 0.5rem 0.6rem;
    background: none;
    border: none;
    color: var(--sb-text);
    cursor: pointer;
    font-size: 0.78rem;
    text-align: left;
    transition: background 0.1s;
  }
  .story-header:hover {
    background: var(--sb-hover);
  }

  .story-chevron {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: #555;
  }

  .story-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .story-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .story-actions {
    display: none;
    align-items: center;
    gap: 2px;
  }
  .story-header:hover .story-actions {
    display: flex;
  }

  .story-action-btn {
    background: none;
    border: none;
    color: #555;
    cursor: pointer;
    padding: 2px;
    border-radius: 3px;
    display: inline-flex;
    align-items: center;
  }
  .story-action-btn:hover {
    color: var(--accent);
  }
  .story-action-btn.del:hover {
    color: #e55;
  }

  .story-files {
    padding: 0.15rem 0 0.3rem;
  }

  .story-file {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 0.3rem 0.6rem 0.3rem 1.8rem;
    background: none;
    border: none;
    border-left: 2px solid transparent;
    color: var(--sb-text);
    cursor: pointer;
    font-size: 0.75rem;
    text-align: left;
    transition: background 0.1s;
  }
  .story-file:hover {
    background: var(--sb-hover);
  }
  .story-file.active {
    background: var(--sb-active);
    border-left-color: var(--accent);
  }
  .story-file.special .file-name {
    font-weight: 500;
  }

  .file-icon {
    flex-shrink: 0;
    font-size: 0.7rem;
    opacity: 0.6;
  }
  .file-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
