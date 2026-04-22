<script>
  import { onMount } from 'svelte'
  import { project } from '../../lib/stores/project.svelte.js'
  import { editor } from '../../lib/stores/editor.svelte.js'
  import {
    modalPrompt,
    modalConfirm,
    modalAlert,
    openInsights,
  } from '../../lib/stores/ui.svelte.js'
  import {
    iconPlus,
    iconChevronRight,
    iconChevronDown,
    iconTrash,
  } from '../../lib/icons.js'
  import * as api from '../../lib/api.js'
  import FolderTree from './FolderTree.svelte'

  let dragOverStory = $state(null)
  let storyInfo = $state([]) // [{ id, name, slug }]

  // `project.stories` is keyed by slug; we need the story id to run the
  // move-to-story endpoint on drop. Pull the metadata once on mount and
  // again whenever the slug set changes.
  $effect(() => {
    const slugs = project.storyList
    void slugs
    refreshStoryInfo()
  })

  async function refreshStoryInfo() {
    try {
      storyInfo = await api.getStoryMetadata()
    } catch {
      storyInfo = []
    }
  }

  onMount(refreshStoryInfo)

  function showInsights(slug) {
    const info = storyInfo.find((s) => s.slug === slug)
    if (!info) {
      modalAlert('Loading story data… try again in a moment.')
      return
    }
    openInsights(info.id)
  }

  async function newStory() {
    const name = await modalPrompt('Story name:')
    if (!name || !name.trim()) return
    await project.createStory(name.trim())
    await refreshStoryInfo()
  }

  async function addChapter(storySlug) {
    const name = await modalPrompt('Chapter name:')
    if (!name || !name.trim()) return
    await project.addChapter(storySlug, name.trim())
  }

  async function addFolder(storySlug) {
    const name = await modalPrompt('Folder name:')
    if (!name || !name.trim()) return
    try {
      await api.createFolder(name.trim(), '_stories/' + storySlug)
    } catch (e) {
      await modalAlert('Folder create failed: ' + e.message)
      return
    }
    await project.scanStories()
  }

  function toggleStory(storySlug) {
    project.activeStory = project.activeStory === storySlug ? null : storySlug
  }

  async function deleteStory(storySlug) {
    const info = storyInfo.find((s) => s.slug === storySlug)
    const label = info ? info.name : storySlug
    if (!(await modalConfirm(`Delete story "${label}" and all its files?`))) return
    await project.deleteStory(storySlug)
    await refreshStoryInfo()
  }

  function storyLabel(slug) {
    return storyInfo.find((s) => s.slug === slug)?.name || slug
  }

  // ── Cross-tab drag drops ───────────────────────────────────────────────
  function hasWriterPayload(e) {
    const types = Array.from(e.dataTransfer?.types || [])
    return (
      types.includes('application/x-writer-poem-path') ||
      types.includes('application/x-writer-file-path')
    )
  }

  function handleStoryDragOver(e, slug) {
    if (!hasWriterPayload(e)) return
    e.preventDefault()
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'move'
    dragOverStory = slug
  }

  function handleStoryDragLeave(slug) {
    if (dragOverStory === slug) dragOverStory = null
  }

  async function handleStoryDrop(e, slug) {
    if (!hasWriterPayload(e)) return
    e.preventDefault()
    e.stopPropagation()
    dragOverStory = null

    const sourcePath =
      e.dataTransfer.getData('application/x-writer-poem-path') ||
      e.dataTransfer.getData('application/x-writer-file-path') ||
      e.dataTransfer.getData('text/plain')
    if (!sourcePath) return
    // Drop from within the same story is a no-op — let FolderTree handle
    // intra-story moves.
    if (sourcePath.startsWith('_stories/' + slug + '/')) return

    const info = storyInfo.find((s) => s.slug === slug)
    if (!info) return
    try {
      const newPath = await api.moveToStory(sourcePath, info.id)
      editor.panes = editor.panes.map((p) =>
        p.filePath === sourcePath ? { ...p, filePath: newPath } : p,
      )
      await project.scanAll()
      await project.scanStories()
    } catch (err) {
      await modalAlert('Move failed: ' + err.message)
    }
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
    {#each project.storyList as slug}
      {@const expanded = project.activeStory === slug}
      {@const items = project.getStoryFiles(slug)}
      {@const emptyDirs = project.getStoryDirs(slug)}
      <div class="story-group" class:expanded>
        <!-- svelte-ignore a11y_no_static_element_interactions a11y_no_noninteractive_element_interactions -->
        <div
          class="story-header"
          class:drag-over={dragOverStory === slug}
          role="button"
          tabindex="0"
          onclick={() => toggleStory(slug)}
          onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleStory(slug) } }}
          ondragover={(e) => handleStoryDragOver(e, slug)}
          ondragleave={() => handleStoryDragLeave(slug)}
          ondrop={(e) => handleStoryDrop(e, slug)}
        >
          <span class="story-chevron">
            {@html expanded ? iconChevronDown(12) : iconChevronRight(12)}
          </span>
          <span class="story-name">{storyLabel(slug)}</span>
          <span class="story-actions">
            <button
              class="story-action-btn"
              title="AI Insights"
              onclick={(e) => { e.stopPropagation(); showInsights(slug) }}
            >&#9728;</button>
            <button
              class="story-action-btn"
              title="Add chapter"
              onclick={(e) => { e.stopPropagation(); addChapter(slug) }}
            >{@html iconPlus(12)}</button>
            <button
              class="story-action-btn"
              title="Add folder"
              onclick={(e) => { e.stopPropagation(); addFolder(slug) }}
            >&#10753;</button>
            <button
              class="story-action-btn del"
              title="Delete story"
              onclick={(e) => { e.stopPropagation(); deleteStory(slug) }}
            >{@html iconTrash(12)}</button>
          </span>
        </div>

        {#if expanded}
          <div class="story-tree-wrap">
            <FolderTree
              items={items}
              emptyDirs={emptyDirs}
              scopeRoot={'_stories/' + slug}
              showBadges={false}
              canReorder={true}
              allowExternalDrops={true}
              dragType="application/x-writer-file-path"
            />
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
  .sl-new-btn:hover { border-color: var(--accent); color: var(--accent); }

  .sl-empty {
    padding: 2rem 1rem;
    text-align: center;
    color: var(--muted);
    font-size: 0.78rem;
    font-style: italic;
  }

  .story-group { border-bottom: 1px solid var(--sb-border); }

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
  .story-header:hover { background: var(--sb-hover); }
  .story-header.drag-over {
    background: rgba(196, 160, 0, 0.18);
    outline: 2px solid var(--accent);
    outline-offset: -2px;
  }

  .story-chevron {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    color: #555;
  }
  .story-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .story-actions { display: none; align-items: center; gap: 2px; }
  .story-header:hover .story-actions { display: flex; }
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
  .story-action-btn:hover { color: var(--accent); }
  .story-action-btn.del:hover { color: #e55; }

  .story-tree-wrap { padding-bottom: 0.3rem; }
</style>
