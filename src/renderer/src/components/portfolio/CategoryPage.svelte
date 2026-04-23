<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getCategoryLanding, getCategoryCatalog } from '../../lib/content.js'
  import { asset } from '../../lib/asset.js'

  let { category } = $props()

  const landing = $derived(getCategoryLanding(category))
  const section = $derived(getCategoryCatalog(category))
  const pieces = $derived(section?.pieces || [])

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
</script>

<Layout>
  <article class="category">
    <header class="cat-header">
      <h1>{landing?.title || section?.label || category}</h1>
      {#if intro}
        <div class="intro">{@html intro}</div>
      {/if}
    </header>

    <ul class="cards">
      {#each pieces as piece}
        <li>
          <Link href={piece.url} class="card">
            {#if piece.thumbnail}
              <div class="card-thumb">
                <img src={asset(piece.thumbnail)} alt={piece.title} loading="lazy" />
              </div>
            {/if}
            {#if piece.publishedIn || piece.publishedAt}
              <p class="card-pub">
                {#if piece.publishedIn}<span>{piece.publishedIn}</span>{/if}
                {#if piece.publishedIn && piece.publishedAt}<span class="sep">·</span>{/if}
                {#if piece.publishedAt}<span>{piece.publishedAt}</span>{/if}
              </p>
            {/if}
            <h3>{piece.title}</h3>
          </Link>
        </li>
      {/each}
    </ul>
  </article>
</Layout>

<style>
  .category {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 3rem var(--p-content-padding) 4rem;
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

  .cards {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
    gap: 2.5rem 2rem;
  }
  .cards li {
    display: flex;
  }
  :global(.portfolio-root .card) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.5rem;
    margin: -0.5rem;
    border-radius: 4px;
    transition: background 200ms ease, transform 200ms ease;
    width: 100%;
  }
  :global(.portfolio-root .card:hover) {
    background: rgba(217, 182, 115, 0.02);
    transform: translateY(-2px);
  }
  .card-thumb {
    aspect-ratio: 16 / 9;
    overflow: hidden;
    background: #111;
    margin-bottom: 0.5rem;
  }
  .card-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 400ms ease;
  }
  :global(.portfolio-root .card:hover) .card-thumb img {
    transform: scale(1.03);
  }
  .card-pub {
    margin: 0;
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--p-accent);
  }
  .card-pub .sep {
    margin: 0 0.4rem;
    opacity: 0.6;
  }
  :global(.portfolio-root .card h3) {
    font-family: var(--p-font-display);
    font-size: 1.6rem;
    font-weight: 400;
    line-height: 1.15;
    letter-spacing: -0.01em;
    margin: 0;
    color: var(--p-text);
  }

  @media (max-width: 800px) {
    .category {
      padding: 2rem 1.25rem 3rem;
    }
  }
</style>
