<script>
  import { onMount } from 'svelte'
  import * as api from '../../lib/api.js'
  import { project } from '../../lib/stores/project.svelte.js'
  import { editor } from '../../lib/stores/editor.svelte.js'
  import {
    closeInsights,
    modalAlert,
  } from '../../lib/stores/ui.svelte.js'
  import InsightsGraph from './InsightsGraph.svelte'
  import InsightsTimeline from './InsightsTimeline.svelte'
  import InsightsProfiles from './InsightsProfiles.svelte'

  let { storyId } = $props()

  const DEFAULT_MODEL = 'claude-haiku-4-5-20251001'

  let loading = $state(true)
  let analyzing = $state(false)
  let data = $state(null)
  let generatedAt = $state(null)
  let generatedModel = $state(null)
  let stale = $state(false)
  let tab = $state('graph') // 'graph' | 'timeline' | 'profiles'
  let models = $state([])
  let selectedModel = $state(DEFAULT_MODEL)
  let story = $state(null)
  let errorMsg = $state(null)

  // Cross-tab selection (e.g. clicking a node in the graph focuses a
  // character in Profiles).
  let focusedCharacter = $state(null)
  let timelineCharacterFilter = $state(null)

  function storyName() {
    if (story?.name) return story.name
    // fallback to slug if metadata didn't load
    return story?.slug || 'Story'
  }

  async function load() {
    loading = true
    errorMsg = null
    try {
      const [metadata, modelList, insights] = await Promise.all([
        api.getStoryMetadata(),
        api.listModels().catch(() => []),
        api.getInsights(storyId),
      ])
      story = metadata.find((s) => s.id === storyId) || null
      models = modelList
      const initial =
        insights.preferredModel ||
        story?.preferredModel ||
        DEFAULT_MODEL
      selectedModel = initial
      if (insights.data) {
        data = insights.data
        generatedAt = insights.generatedAt
        generatedModel = insights.model
        stale = !!insights.stale
      } else {
        data = null
        generatedAt = null
        generatedModel = null
        stale = false
      }
    } catch (e) {
      errorMsg = e.message
    } finally {
      loading = false
    }
  }

  async function analyze() {
    if (analyzing) return
    analyzing = true
    errorMsg = null
    try {
      const result = await api.analyzeStory(storyId, { model: selectedModel })
      data = result.data
      generatedAt = result.generatedAt
      generatedModel = result.model
      stale = false
      // Persist the selection if it differs from what's saved.
      if (story?.preferredModel !== selectedModel) {
        try {
          await api.setStoryPreferredModel(storyId, selectedModel)
          story = { ...story, preferredModel: selectedModel }
        } catch {
          // best-effort; analysis still succeeded
        }
      }
    } catch (e) {
      errorMsg = e.message
      await modalAlert('Analysis failed: ' + e.message)
    } finally {
      analyzing = false
    }
  }

  function onModelChange(e) {
    selectedModel = e.target.value
  }

  function handleSelectCharacter(charId) {
    focusedCharacter = charId
    tab = 'profiles'
  }

  function handleScenesClickInProfile(charId) {
    timelineCharacterFilter = charId
    tab = 'timeline'
  }

  function handleSceneOpen(scene) {
    // The LLM may return a path or just a stem. Find the matching file.
    const stem = (scene.chapterPath || '').replace(/\.md$/, '').trim()
    if (!stem) return
    const files = project.getStoryFiles(story?.slug || '')
    const match =
      files.find((f) => f.path === stem) ||
      files.find((f) => f.path.endsWith('/' + stem + '.md')) ||
      files.find((f) => f.path.endsWith('/' + stem)) ||
      files.find((f) => f.path.split('/').pop().replace(/\.md$/, '') === stem)
    if (!match) return
    editor.openFile(match.path)
    closeInsights()
  }

  function formatTime(ts) {
    if (!ts) return ''
    const d = new Date(ts)
    return d.toLocaleString()
  }

  function modelLabel(id) {
    return models.find((m) => m.id === id)?.displayName || id
  }

  onMount(load)

  function onKey(e) {
    if (e.key === 'Escape') closeInsights()
  }
</script>

<svelte:window onkeydown={onKey} />

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  class="insights-overlay"
  role="presentation"
  onclick={(e) => { if (e.target === e.currentTarget) closeInsights() }}
>
  <div class="insights-panel" role="dialog" aria-label="Story Insights">
    <div class="ins-header">
      <div class="ins-title">
        <span class="ins-eyebrow">Insights</span>
        <h2>{storyName()}</h2>
      </div>

      <div class="ins-controls">
        {#if models.length}
          <label class="ins-model">
            <span>Model</span>
            <select
              value={selectedModel}
              onchange={onModelChange}
              disabled={analyzing}
            >
              {#each models as m}
                <option value={m.id}>{m.displayName}</option>
              {/each}
            </select>
          </label>
        {/if}

        <button
          class="ins-analyze"
          onclick={analyze}
          disabled={analyzing || loading}
        >
          {#if analyzing}Analyzing…{:else if data}Re-analyze{:else}Analyze{/if}
        </button>

        <button class="ins-close" onclick={closeInsights} title="Close">
          &times;
        </button>
      </div>
    </div>

    {#if generatedAt}
      <div class="ins-meta">
        <span>Last run {formatTime(generatedAt)}{#if generatedModel}
          · {modelLabel(generatedModel)}
        {/if}</span>
        {#if stale}
          <span class="ins-stale">Manuscript changed since this analysis</span>
        {/if}
      </div>
    {/if}

    <div class="ins-tabs">
      <button
        class="ins-tab"
        class:active={tab === 'graph'}
        onclick={() => (tab = 'graph')}
      >Graph</button>
      <button
        class="ins-tab"
        class:active={tab === 'timeline'}
        onclick={() => (tab = 'timeline')}
      >Timeline</button>
      <button
        class="ins-tab"
        class:active={tab === 'profiles'}
        onclick={() => (tab = 'profiles')}
      >Profiles</button>
    </div>

    <div class="ins-body">
      {#if loading}
        <div class="ins-empty">Loading…</div>
      {:else if errorMsg && !data}
        <div class="ins-empty ins-error">{errorMsg}</div>
      {:else if !data}
        <div class="ins-empty">
          <p>No analysis yet.</p>
          <p class="ins-empty-sub">
            Click <strong>Analyze</strong> to generate a character graph,
            scene timeline, and per-character profiles from your manuscript.
          </p>
        </div>
      {:else if tab === 'graph'}
        <InsightsGraph
          {data}
          onSelectCharacter={handleSelectCharacter}
        />
      {:else if tab === 'timeline'}
        <InsightsTimeline
          {data}
          characterFilter={timelineCharacterFilter}
          onClearFilter={() => (timelineCharacterFilter = null)}
          onOpenScene={handleSceneOpen}
        />
      {:else}
        <InsightsProfiles
          {data}
          focusedCharacter={focusedCharacter}
          onShowScenes={handleScenesClickInProfile}
        />
      {/if}
    </div>
  </div>
</div>

<style>
  .insights-overlay {
    position: fixed;
    inset: 0;
    z-index: 900;
    background: rgba(0, 0, 0, 0.45);
    display: flex;
    align-items: stretch;
    justify-content: stretch;
  }
  .insights-panel {
    flex: 1;
    margin: 2.5rem;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    min-height: 0;
  }
  .ins-header {
    display: flex;
    align-items: flex-end;
    gap: 1rem;
    padding: 0.9rem 1.2rem 0.8rem;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ins-title {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ins-eyebrow {
    font-size: 0.64rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: var(--muted);
  }
  .ins-title h2 {
    margin: 0;
    font-family: var(--font-serif);
    font-size: 1.35rem;
    color: var(--text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .ins-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  .ins-model {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--muted);
  }
  .ins-model select {
    background: var(--surface);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 6px;
    font-size: 0.78rem;
    font-family: var(--font-ui);
  }
  .ins-analyze {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 0.42rem 0.95rem;
    font-size: 0.82rem;
    cursor: pointer;
    transition: filter 0.12s;
  }
  .ins-analyze:hover:not(:disabled) { filter: brightness(1.1); }
  .ins-analyze:disabled { opacity: 0.6; cursor: progress; }
  .ins-close {
    background: transparent;
    border: none;
    color: var(--muted);
    font-size: 1.4rem;
    cursor: pointer;
    padding: 0 6px;
    line-height: 1;
  }
  .ins-close:hover { color: var(--text); }
  .ins-meta {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    padding: 0.35rem 1.2rem 0.55rem;
    font-size: 0.72rem;
    color: var(--muted);
    border-bottom: 1px solid var(--border);
  }
  .ins-stale {
    color: #c0392b;
  }
  .ins-tabs {
    display: flex;
    gap: 2px;
    padding: 0.5rem 1.2rem 0;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .ins-tab {
    background: transparent;
    border: 1px solid transparent;
    border-bottom: none;
    color: var(--muted);
    font-size: 0.82rem;
    padding: 0.38rem 0.9rem;
    border-radius: 5px 5px 0 0;
    cursor: pointer;
    transition: all 0.12s;
  }
  .ins-tab:hover {
    color: var(--text);
    background: var(--accent-light);
  }
  .ins-tab.active {
    color: var(--accent);
    background: var(--surface);
    border-color: var(--border);
    margin-bottom: -1px;
  }
  .ins-body {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }
  .ins-empty {
    padding: 3rem 1.5rem;
    text-align: center;
    color: var(--muted);
    font-family: var(--font-serif);
  }
  .ins-empty p { margin: 0.4rem 0; }
  .ins-empty-sub { font-size: 0.85rem; }
  .ins-error { color: #c0392b; }
</style>
