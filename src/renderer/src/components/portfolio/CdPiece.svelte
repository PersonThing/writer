<script>
  // Creative-direction variant A — Magazine Spread.
  // Sticky "direction notes" sidebar on the left, asymmetric image
  // column on the right (full / 2-up / full / 2-up …).
  import { asset } from '@lib/asset.js'

  let { notes = [], images = [], categoryLabel = '', title = '' } = $props()

  // Group images into an alternating rhythm: [full], [2-up], [full], [2-up]…
  const groups = (() => {
    const out = []
    let i = 0
    let full = true
    while (i < images.length) {
      if (full) {
        out.push({ kind: 'full', items: [images[i]] })
        i += 1
      } else {
        const pair = images.slice(i, i + 2)
        out.push({ kind: pair.length === 2 ? 'pair' : 'full', items: pair })
        i += pair.length
      }
      full = !full
    }
    return out
  })()
</script>

<div class="cd-a">
  <aside class="cd-a-side">
    <div class="cd-a-side-inner">
      <div class="cd-a-kicker">{categoryLabel}</div>
      <h2 class="cd-a-title">{title}</h2>
      {#if notes.length}
        <ol class="cd-a-notes">
          {#each notes as n, i}
            <li>
              <span class="cd-a-num">{String(i + 1).padStart(2, '0')}</span>
              <span class="cd-a-note">{n}</span>
            </li>
          {/each}
        </ol>
      {/if}
    </div>
  </aside>

  <div class="cd-a-gallery">
    {#each groups as g}
      <div class="cd-a-row" class:pair={g.kind === 'pair'}>
        {#each g.items as img}
          <figure class="cd-a-frame">
            <img src={asset(img.src)} alt={img.alt || title} loading="lazy" />
          </figure>
        {/each}
      </div>
    {/each}
  </div>
</div>

<style>
  .cd-a {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 1rem var(--p-content-padding) 5rem;
    display: grid;
    grid-template-columns: 22rem 1fr;
    gap: 4rem;
    align-items: start;
  }
  .cd-a-side {
    position: sticky;
    top: 4rem;
  }
  .cd-a-side-inner {
    border-top: 1px solid var(--p-border);
    border-bottom: 1px solid var(--p-border);
    padding: 2rem 0;
  }
  .cd-a-kicker {
    font-family: var(--p-font-body);
    font-size: 0.72rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--p-accent);
    margin-bottom: 1rem;
  }
  .cd-a-title {
    font-family: var(--p-font-display);
    font-size: 2.2rem;
    font-weight: 500;
    letter-spacing: -0.03em;
    line-height: 1.05;
    margin: 0 0 1.6rem;
  }
  .cd-a-notes {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 1.1rem;
  }
  .cd-a-notes li {
    display: grid;
    grid-template-columns: 2rem 1fr;
    gap: 0.75rem;
    align-items: baseline;
  }
  .cd-a-num {
    font-family: var(--p-font-display);
    color: var(--p-accent);
    font-size: 1rem;
    letter-spacing: -0.02em;
    font-variant-numeric: tabular-nums;
  }
  .cd-a-note {
    font-family: var(--p-font-body);
    font-size: 0.95rem;
    line-height: 1.55;
    color: var(--p-text);
  }

  .cd-a-gallery {
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .cd-a-row {
    display: grid;
    gap: 1.25rem;
  }
  .cd-a-row.pair {
    grid-template-columns: 1fr 1fr;
  }
  .cd-a-frame {
    margin: 0;
    overflow: hidden;
    background: #0a0a0a;
  }
  .cd-a-frame img {
    width: 100%;
    height: auto;
    display: block;
  }

  @media (max-width: 900px) {
    .cd-a {
      grid-template-columns: 1fr;
      gap: 2rem;
      padding: 1rem 1.25rem 3rem;
    }
    .cd-a-side { position: static; }
    .cd-a-row.pair { grid-template-columns: 1fr; }
  }
</style>
