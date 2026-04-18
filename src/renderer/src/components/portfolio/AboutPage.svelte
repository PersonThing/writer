<script>
  import Layout from './Layout.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  const page = getPage('/about')
  const rendered = page ? parseMarkdown(page.body) : ''
</script>

<Layout>
  <article class="about">
    {#if page}
      <h1>{page.title}</h1>
      <div class="body">{@html rendered}</div>
    {/if}
  </article>
</Layout>

<style>
  .about h1 {
    font-size: 2rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }
  .body :global(h2),
  .body :global(h3) {
    font-weight: 500;
    margin: 2rem 0 0.5rem;
  }
  .body :global(p) {
    margin-bottom: 1rem;
  }
  .body :global(ul) {
    margin-bottom: 1rem;
    padding-left: 1.5rem;
  }
</style>
