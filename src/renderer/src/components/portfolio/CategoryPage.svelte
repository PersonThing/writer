<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getCategoryLanding, getCategoryPages } from '../../lib/content.js'

  let { category } = $props()

  const landing = $derived(getCategoryLanding(category))
  const pieces = $derived(getCategoryPages(category))
  const intro = $derived(landing ? parseMarkdown(landing.body) : '')

  function excerpt(piece) {
    // Take the first paragraph of body as a short description. Strip leading
    // heading lines that match the title.
    const lines = piece.body.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      if (line.startsWith('#')) continue
      return line.slice(0, 200)
    }
    return ''
  }

  function heroImage(piece) {
    return piece.images.length ? piece.images[0] : null
  }
</script>

<Layout>
  <article class="category">
    <h1>{landing?.title || category}</h1>
    {#if intro}
      <div class="intro">{@html intro}</div>
    {/if}

    <div class="grid">
      {#each pieces as piece}
        <Link href={piece.routePath} class="card">
          {#if heroImage(piece)}
            <div class="card-image">
              <img src={heroImage(piece)} alt={piece.title} loading="lazy" />
            </div>
          {/if}
          <div class="card-body">
            <h3>{piece.title}</h3>
            <p>{excerpt(piece)}</p>
          </div>
        </Link>
      {/each}
    </div>
  </article>
</Layout>

<style>
  .category h1 {
    font-size: 2.1rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }
  .intro {
    margin-bottom: 2rem;
    color: var(--p-muted);
  }
  .intro :global(p) {
    margin-bottom: 1rem;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
  }
  :global(.portfolio-root .grid .card) {
    display: block;
    text-decoration: none;
    color: inherit;
  }
  .card-image {
    aspect-ratio: 4 / 3;
    overflow: hidden;
    background: #eee;
    margin-bottom: 0.6rem;
  }
  .card-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 0.25s;
  }
  :global(.portfolio-root .grid .card:hover .card-image img) {
    transform: scale(1.03);
  }
  .card-body h3 {
    font-size: 1.1rem;
    font-weight: 500;
    margin: 0 0 0.25rem;
  }
  .card-body p {
    font-size: 0.88rem;
    color: var(--p-muted);
    margin: 0;
    line-height: 1.5;
  }
</style>
