<script>
  import Layout from './Layout.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  const page = getPage('/published-paper')
  const rendered = page ? parseMarkdown(page.body) : ''
  const images = page?.images || []
</script>

<Layout>
  <article class="published-paper">
    <h1>{page?.title || 'Published Paper'}</h1>
    {#if rendered}
      <div class="body">{@html rendered}</div>
    {/if}
    {#if images.length}
      <div class="gallery">
        {#each images as src}
          <img {src} alt="" loading="lazy" />
        {/each}
      </div>
    {/if}
  </article>
</Layout>

<style>
  .published-paper {
    max-width: 62rem;
    margin: 0 auto;
    padding: 3rem 2rem 4rem;
  }
  .published-paper h1 {
    font-size: 2rem;
    font-weight: 300;
    margin: 0 0 1.5rem;
  }
  :global(.portfolio-root .published-paper .body p) {
    color: var(--p-muted);
    margin: 0 0 1rem;
    line-height: 1.7;
  }
  .gallery {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.5rem;
    margin-top: 2rem;
  }
  .gallery img {
    width: 100%;
    height: auto;
    display: block;
  }

  @media (max-width: 600px) {
    .published-paper {
      padding: 2rem 1.25rem 3rem;
    }
  }
</style>
