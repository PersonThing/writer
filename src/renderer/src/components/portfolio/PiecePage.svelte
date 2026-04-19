<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  let { category, slug } = $props()

  const piece = $derived(getPage(`/${category}/${slug}`))
  const rendered = $derived(piece ? parseMarkdown(piece.body) : '')
  const hero = $derived(piece?.hero || null)
  const categoryLabel = $derived(
    category
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
  )
</script>

<Layout>
  {#if piece}
    <article class="piece">
      <div class="breadcrumb">
        <Link href={`/${category}`}>← {categoryLabel}</Link>
      </div>

      {#if hero}
        <figure class="hero">
          <img src={hero} alt={piece.title} />
        </figure>
      {/if}

      <header class="piece-head">
        <h1>{piece.title}</h1>
        {#if piece.lede}
          <p class="lede">{piece.lede}</p>
        {/if}
      </header>

      <div class="piece-body">{@html rendered}</div>
    </article>
  {:else}
    <div class="empty"><p>Piece not found.</p></div>
  {/if}
</Layout>

<style>
  .piece {
    max-width: 46rem;
    margin: 0 auto;
    padding: 2rem 2rem 4rem;
  }
  .breadcrumb {
    font-size: 0.85rem;
    color: var(--p-muted);
    margin-bottom: 2rem;
  }
  :global(.portfolio-root .breadcrumb a:hover) {
    color: var(--p-accent);
  }

  .hero {
    margin: 0 0 2rem;
  }
  .hero img {
    width: 100%;
    height: auto;
    display: block;
  }
  .piece-head {
    margin: 0 0 2rem;
  }
  .piece-head h1 {
    font-size: 2.1rem;
    font-weight: 400;
    margin: 0 0 0.75rem;
    line-height: 1.25;
  }
  .lede {
    font-size: 1.1rem;
    color: var(--p-muted);
    font-style: italic;
    margin: 0;
  }

  :global(.portfolio-root .piece-body .md-figure) {
    margin: 1.5rem 0;
  }
  :global(.portfolio-root .piece-body .md-figure img) {
    width: 100%;
    height: auto;
    display: block;
  }
  :global(.portfolio-root .piece-body .md-video) {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    display: block;
    margin: 1.5rem 0;
  }
  :global(.portfolio-root .piece-body .md-audio) {
    width: 100%;
    display: block;
    margin: 1rem 0;
  }

  :global(.portfolio-root .piece-body h1) {
    font-size: 2.1rem;
    font-weight: 400;
    margin: 0 0 0.75rem;
    line-height: 1.25;
  }
  :global(.portfolio-root .piece-body h2) {
    font-size: 1.2rem;
    font-weight: 400;
    color: var(--p-muted);
    margin: 1.8rem 0 0.6rem;
  }
  :global(.portfolio-root .piece-body h3) {
    font-size: 1.05rem;
    font-weight: 400;
    margin: 1.5rem 0 0.5rem;
  }
  :global(.portfolio-root .piece-body p) {
    margin: 0 0 1.1rem;
    font-size: 1rem;
    line-height: 1.75;
  }
  :global(.portfolio-root .piece-body ul),
  :global(.portfolio-root .piece-body ol) {
    margin: 0 0 1.1rem;
    padding-left: 1.5rem;
  }
  :global(.portfolio-root .piece-body li) {
    margin-bottom: 0.3rem;
  }
  :global(.portfolio-root .piece-body a) {
    color: var(--p-accent);
    border-bottom: 1px solid rgba(217, 182, 115, 0.4);
  }
  :global(.portfolio-root .piece-body blockquote) {
    border-left: 2px solid var(--p-accent);
    margin: 1.2rem 0;
    padding-left: 1rem;
    color: var(--p-muted);
    font-style: italic;
  }
  :global(.portfolio-root .piece-body em) {
    font-style: italic;
  }
  :global(.portfolio-root .piece-body strong) {
    font-weight: 500;
  }
  :global(.portfolio-root .piece-body code) {
    background: #1a1a1a;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    font-size: 0.92em;
  }

  .empty {
    text-align: center;
    padding: 5rem 2rem;
    color: var(--p-muted);
  }

  @media (max-width: 600px) {
    .piece {
      padding: 1.5rem 1.25rem 3rem;
    }
    :global(.portfolio-root .piece-body h1) {
      font-size: 1.75rem;
    }
  }
</style>
