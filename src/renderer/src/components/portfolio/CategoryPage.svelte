<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getCategoryLanding, getCategoryPages } from '../../lib/content.js'

  let { category } = $props()

  const landing = $derived(getCategoryLanding(category))
  const pieces = $derived(getCategoryPages(category))

  // Show only the first non-heading paragraph of the landing body as the
  // intro — the rest is mostly a duplicate of the piece list.
  const intro = $derived.by(() => {
    if (!landing) return ''
    const paragraphs = landing.body
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p && !p.startsWith('#'))
    return paragraphs[0] ? parseMarkdown(paragraphs[0]) : ''
  })

  function subtitle(piece) {
    // First non-heading line of the body is usually a one-line caption
    const lines = piece.body.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('#')) continue
      return line.slice(0, 180)
    }
    return ''
  }
</script>

<Layout>
  <article class="category">
    <header class="cat-header">
      <h1>{landing?.title || category}</h1>
      {#if intro}
        <div class="intro">{@html intro}</div>
      {/if}
    </header>

    <ul class="piece-list">
      {#each pieces as piece}
        <li>
          <Link href={piece.routePath} class="piece-row">
            <div class="thumb">
              {#if piece.images[0]}
                <img src={piece.images[0]} alt={piece.title} loading="lazy" />
              {/if}
            </div>
            <div class="meta">
              <h3>{piece.title}</h3>
              <p>{subtitle(piece)}</p>
            </div>
          </Link>
        </li>
      {/each}
    </ul>
  </article>
</Layout>

<style>
  .category {
    max-width: 72rem;
    margin: 0 auto;
    padding: 3rem 3rem 4rem;
  }
  .cat-header {
    margin-bottom: 2.5rem;
  }
  .cat-header h1 {
    font-size: 2.2rem;
    font-weight: 300;
    margin: 0 0 0.75rem;
  }
  .intro {
    max-width: 52rem;
    color: var(--p-muted);
    font-size: 0.95rem;
  }
  .intro :global(p) {
    margin: 0 0 0.8rem;
  }

  .piece-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
  }
  .piece-list li {
    border-top: 1px solid var(--p-border);
  }
  .piece-list li:last-child {
    border-bottom: 1px solid var(--p-border);
  }

  :global(.portfolio-root .piece-row) {
    display: grid;
    grid-template-columns: 220px 1fr;
    gap: 2rem;
    padding: 1.5rem 0;
    align-items: center;
    transition: background 0.15s;
  }
  :global(.portfolio-root .piece-row:hover) {
    background: #0a0a0a;
  }

  .thumb {
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #111;
  }
  .thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .meta h3 {
    font-size: 1.15rem;
    font-weight: 400;
    margin: 0 0 0.4rem;
    color: var(--p-text);
  }
  .meta p {
    margin: 0;
    font-size: 0.88rem;
    color: var(--p-muted);
    line-height: 1.55;
  }

  @media (max-width: 800px) {
    .category {
      padding: 2rem 1.25rem 3rem;
    }
    :global(.portfolio-root .piece-row) {
      grid-template-columns: 120px 1fr;
      gap: 1rem;
      padding: 1rem 0;
    }
  }
</style>
