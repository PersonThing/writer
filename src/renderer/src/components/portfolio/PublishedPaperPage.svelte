<script>
  import Layout from './Layout.svelte'
  import { getPage } from '../../lib/content.js'
  import { asset } from '../../lib/asset.js'
  import { onMount } from 'svelte'

  const page = getPage('/published-paper')

  let manifest = $state(null)
  let index = $state(0)
  let loaded = $state(new Set([0]))

  onMount(async () => {
    const res = await fetch(asset('/portfolio/paper/manifest.json'))
    manifest = await res.json()
  })

  const pages = $derived(manifest?.pages || [])
  const total = $derived(pages.length)

  function go(delta) {
    if (!total) return
    index = Math.min(total - 1, Math.max(0, index + delta))
    // Eagerly mark the neighbours as "loaded" so we preload them.
    loaded = new Set([...loaded, index, index + 1, index - 1].filter((n) => n >= 0 && n < total))
  }

  function jumpTo(i) {
    index = Math.min(total - 1, Math.max(0, i))
    loaded = new Set([...loaded, index, index + 1, index - 1].filter((n) => n >= 0 && n < total))
  }

  function onKey(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
    if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
      e.preventDefault()
      go(1)
    } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
      e.preventDefault()
      go(-1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      jumpTo(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      jumpTo(total - 1)
    }
  }

  $effect(() => {
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  function onStageClick(e) {
    // Click on left half → prev, right half → next. Ignore clicks on the
    // button overlays (they stop propagation).
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    if (x < rect.width / 2) go(-1)
    else go(1)
  }
</script>

<Layout>
  <article class="paper">
    <header class="head">
      <h1>{page?.title || 'The Evolution of the Fashion Image'}</h1>
      {#if page?.byline}<p class="byline">{page.byline}</p>{/if}
      {#if page?.lede}<p class="lede">{page.lede}</p>{/if}
    </header>

    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div class="stage" onclick={onStageClick}>
      {#if !manifest}
        <div class="stage-loading">Loading slides…</div>
      {:else}
        <div class="slides">
          {#each pages as p, i}
            {#if loaded.has(i) || i === index}
              <img
                class="slide"
                class:active={i === index}
                src={asset(p.src)}
                alt={`Slide ${i + 1}`}
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
              />
            {/if}
          {/each}
        </div>

        <button
          class="nav nav-prev"
          type="button"
          aria-label="Previous slide"
          disabled={index === 0}
          onclick={(e) => { e.stopPropagation(); go(-1) }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
        <button
          class="nav nav-next"
          type="button"
          aria-label="Next slide"
          disabled={index === total - 1}
          onclick={(e) => { e.stopPropagation(); go(1) }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </button>
      {/if}
    </div>

    {#if manifest}
      <div class="controls">
        <button
          type="button"
          class="step"
          onclick={() => go(-1)}
          disabled={index === 0}
          aria-label="Previous slide"
        >← Prev</button>
        <div class="counter" aria-live="polite">
          <span class="counter-current">{index + 1}</span>
          <span class="counter-sep">/</span>
          <span class="counter-total">{total}</span>
        </div>
        <button
          type="button"
          class="step"
          onclick={() => go(1)}
          disabled={index === total - 1}
          aria-label="Next slide"
        >Next →</button>
      </div>

      <div class="scrubber" aria-label="Slide progress">
        <input
          type="range"
          min="0"
          max={total - 1}
          value={index}
          oninput={(e) => jumpTo(Number(e.currentTarget.value))}
          aria-label="Jump to slide"
        />
      </div>
    {/if}
  </article>
</Layout>

<style>
  .paper {
    max-width: 80rem;
    margin: 0 auto;
    padding: 3rem 2rem 4rem;
  }
  .head {
    margin-bottom: 2rem;
  }
  .head h1 {
    font-family: var(--p-font-display);
    font-size: clamp(1.8rem, 3.5vw, 2.6rem);
    font-weight: 400;
    line-height: 1.15;
    letter-spacing: -0.01em;
    margin: 0 0 0.75rem;
  }
  .byline {
    font-size: 0.95rem;
    color: var(--p-muted);
    font-style: italic;
    margin: 0 0 0.6rem;
  }
  .lede {
    font-size: 1rem;
    color: var(--p-text);
    line-height: 1.55;
    margin: 0 0 1rem;
    max-width: 42rem;
  }
  .stage {
    position: relative;
    width: 100%;
    aspect-ratio: 1400 / 875;
    max-height: calc(100vh - 220px);
    background: #fff;
    overflow: hidden;
    cursor: pointer;
    box-shadow: 0 40px 80px -30px rgba(0, 0, 0, 0.5);
    user-select: none;
  }
  .stage-loading {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #888;
    font-size: 0.9rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .slides {
    position: absolute;
    inset: 0;
  }
  .slide {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
    background: #fff;
    opacity: 0;
    transition: opacity 200ms ease;
    pointer-events: none;
  }
  .slide.active {
    opacity: 1;
  }

  .nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 50%;
    border: 1px solid rgba(0, 0, 0, 0.1);
    background: rgba(255, 255, 255, 0.92);
    color: #111;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 8px 24px -6px rgba(0, 0, 0, 0.25);
    transition: background 150ms ease, transform 150ms ease, opacity 150ms ease;
    z-index: 2;
  }
  .nav:hover:not(:disabled) {
    background: #fff;
    transform: translateY(-50%) scale(1.05);
  }
  .nav:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .nav svg {
    width: 1.4rem;
    height: 1.4rem;
  }
  .nav-prev {
    left: 1rem;
  }
  .nav-next {
    right: 1rem;
  }

  .controls {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    margin-top: 1.5rem;
  }
  .step {
    appearance: none;
    background: transparent;
    border: 1px solid var(--p-border);
    color: var(--p-text);
    font-family: var(--p-font-body);
    font-size: 0.8rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    padding: 0.6rem 1.2rem;
    cursor: pointer;
    transition: background 150ms ease, color 150ms ease, border-color 150ms ease;
  }
  .step:hover:not(:disabled) {
    background: var(--p-accent);
    color: #0a0a0a;
    border-color: var(--p-accent);
  }
  .step:disabled {
    opacity: 0.3;
    cursor: default;
  }
  .counter {
    font-family: var(--p-font-display);
    font-size: 1.15rem;
    min-width: 5rem;
    text-align: center;
    color: var(--p-text);
  }
  .counter-current {
    color: var(--p-accent);
  }
  .counter-sep {
    margin: 0 0.4rem;
    color: var(--p-muted);
  }
  .counter-total {
    color: var(--p-muted);
  }

  .scrubber {
    margin-top: 1rem;
    padding: 0 0.5rem;
  }
  .scrubber input[type='range'] {
    width: 100%;
    appearance: none;
    -webkit-appearance: none;
    height: 2px;
    background: var(--p-border);
    outline: none;
    cursor: pointer;
  }
  .scrubber input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--p-accent);
    border: none;
    cursor: pointer;
  }
  .scrubber input[type='range']::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--p-accent);
    border: none;
    cursor: pointer;
  }

  @media (max-width: 600px) {
    .paper {
      padding: 2rem 1rem 3rem;
    }
    .nav {
      width: 2.5rem;
      height: 2.5rem;
    }
    .nav-prev { left: 0.5rem; }
    .nav-next { right: 0.5rem; }
    .controls {
      gap: 1rem;
    }
  }
</style>
