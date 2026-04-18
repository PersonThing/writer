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
  h1 {
    font-size: 2rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }
  .body :global(p) {
    margin-bottom: 1rem;
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
</style>
