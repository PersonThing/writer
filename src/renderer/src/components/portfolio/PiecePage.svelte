<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  let { category, slug } = $props()

  const piece = $derived(getPage(`/${category}/${slug}`))
  const rendered = $derived(piece ? parseMarkdown(piece.body) : '')
  const hero = $derived(piece?.images?.[0] || null)
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
      <nav class="breadcrumb">
        <Link href={`/${category}`}>← {categoryLabel}</Link>
      </nav>

      {#if hero}
        <figure class="hero">
          <img src={hero} alt={piece.title} />
        </figure>
      {/if}

      <div class="body">{@html rendered}</div>
    </article>
  {:else}
    <p>Piece not found.</p>
  {/if}
</Layout>

<style>
  .breadcrumb {
    font-size: 0.88rem;
    margin-bottom: 1.5rem;
    color: var(--p-muted);
  }
  .hero {
    margin: 0 0 2rem;
  }
  .hero img {
    width: 100%;
    height: auto;
    display: block;
  }

  .body :global(h1) {
    font-size: 2.2rem;
    font-weight: 500;
    margin: 0 0 0.75rem;
    line-height: 1.2;
  }
  .body :global(h2) {
    font-size: 1.3rem;
    font-weight: 500;
    margin: 2rem 0 0.5rem;
    color: var(--p-muted);
  }
  .body :global(h3) {
    font-size: 1.05rem;
    font-weight: 500;
    margin: 1.5rem 0 0.5rem;
  }
  .body :global(p) {
    margin-bottom: 1.1rem;
    font-size: 1.05rem;
  }
  .body :global(ul),
  .body :global(ol) {
    margin-bottom: 1.1rem;
    padding-left: 1.5rem;
  }
  .body :global(blockquote) {
    border-left: 3px solid var(--p-accent);
    margin-left: 0;
    padding-left: 1rem;
    color: var(--p-muted);
    font-style: italic;
  }
  .body :global(em) {
    font-style: italic;
  }
  .body :global(strong) {
    font-weight: 600;
  }
</style>
