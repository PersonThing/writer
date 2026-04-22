<script>
  let {
    data,
    characterFilter = null,
    onClearFilter,
    onOpenScene,
  } = $props()

  let charById = $derived.by(() => {
    const m = new Map()
    for (const c of data?.characters || []) m.set(c.id, c)
    return m
  })

  let scenes = $derived.by(() => {
    const all = [...(data?.scenes || [])].sort(
      (a, b) => (a.order ?? 0) - (b.order ?? 0),
    )
    if (!characterFilter) return all
    return all.filter((s) => (s.characterIds || []).includes(characterFilter))
  })

  function charName(id) {
    return charById.get(id)?.name || id
  }
</script>

<div class="timeline-wrap">
  {#if characterFilter}
    <div class="filter-bar">
      Showing scenes with <strong>{charName(characterFilter)}</strong>
      <button class="clear-btn" onclick={() => onClearFilter?.()}>Show all</button>
    </div>
  {/if}

  {#if !scenes.length}
    <div class="empty">No scenes to show.</div>
  {:else}
    <div class="timeline">
      {#each scenes as scene, i}
        <div class="scene-card">
          <div class="scene-order">Scene {i + 1}</div>
          <h3 class="scene-title">
            <button class="scene-title-btn" onclick={() => onOpenScene?.(scene)}>
              {scene.title}
            </button>
          </h3>
          {#if scene.location}
            <div class="scene-location">{scene.location}</div>
          {/if}
          {#if scene.summary}
            <p class="scene-summary">{scene.summary}</p>
          {/if}
          {#if (scene.characterIds || []).length}
            <div class="chips">
              {#each scene.characterIds as cid}
                <span class="chip" class:active={cid === characterFilter}>
                  {charName(cid)}
                </span>
              {/each}
            </div>
          {/if}
          <div class="scene-open">
            <button class="open-btn" onclick={() => onOpenScene?.(scene)}>
              Open chapter →
            </button>
          </div>
        </div>
        {#if i < scenes.length - 1}
          <div class="connector" aria-hidden="true"></div>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .timeline-wrap {
    padding: 1rem 1.2rem;
  }
  .filter-bar {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 0.8rem;
    color: var(--muted);
    padding: 0.4rem 0.65rem;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--surface);
    margin-bottom: 0.8rem;
  }
  .clear-btn {
    background: transparent;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 0.72rem;
    color: var(--text);
    cursor: pointer;
  }
  .clear-btn:hover {
    background: var(--accent-light);
    border-color: var(--accent);
    color: var(--accent);
  }
  .timeline {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }
  .scene-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 0.8rem 1rem;
  }
  .scene-order {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--muted);
  }
  .scene-title {
    margin: 0.15rem 0 0.2rem;
    font-family: var(--font-serif);
    font-size: 1.05rem;
    font-weight: 700;
  }
  .scene-title-btn {
    background: none;
    border: none;
    padding: 0;
    color: var(--text);
    cursor: pointer;
    font: inherit;
    text-align: left;
  }
  .scene-title-btn:hover { color: var(--accent); }
  .scene-location {
    font-size: 0.78rem;
    color: var(--muted);
    font-style: italic;
    margin-bottom: 0.4rem;
  }
  .scene-summary {
    font-family: var(--font-serif);
    font-size: 0.9rem;
    color: var(--text);
    line-height: 1.5;
    margin: 0.3rem 0;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 0.4rem 0;
  }
  .chip {
    font-size: 0.7rem;
    padding: 2px 8px;
    border-radius: 10px;
    border: 1px solid var(--border);
    color: var(--muted);
    background: var(--bg);
  }
  .chip.active {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .scene-open {
    margin-top: 0.3rem;
    display: flex;
    justify-content: flex-end;
  }
  .open-btn {
    background: transparent;
    border: none;
    color: var(--accent);
    cursor: pointer;
    font-size: 0.78rem;
    padding: 2px 4px;
  }
  .open-btn:hover { text-decoration: underline; }
  .connector {
    width: 2px;
    height: 18px;
    background: var(--border);
    margin-left: 1.4rem;
  }
  .empty {
    padding: 2.5rem;
    text-align: center;
    color: var(--muted);
    font-style: italic;
  }
</style>
