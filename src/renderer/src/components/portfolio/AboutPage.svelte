<script>
  import Layout from './Layout.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  const page = getPage('/about')
  const rendered = page ? parseMarkdown(page.body) : ''
</script>

<Layout>
  <article class="about">
    <h1>{page?.title || 'About'}</h1>
    {#if rendered}
      <div class="body">{@html rendered}</div>
    {/if}
  </article>
</Layout>

<style>
  .about {
    max-width: 46rem;
    margin: 0 auto;
    padding: 3rem 2rem 4rem;
  }
  .about h1 {
    font-size: 2rem;
    font-weight: 300;
    margin: 0 0 1.5rem;
  }
  :global(.portfolio-root .about .body h2) {
    font-size: 1.1rem;
    font-weight: 500;
    margin: 2rem 0 0.5rem;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    color: var(--p-accent);
  }
  :global(.portfolio-root .about .body h3) {
    font-size: 1rem;
    font-weight: 500;
    margin: 1.8rem 0 0.5rem;
    padding-left: 1.5rem;
  }
  :global(.portfolio-root .about .body ul) {
    list-style: disc;
    padding-left: 3rem;
    margin: 0 0 1rem;
    color: var(--p-muted);
  }
  :global(.portfolio-root .about .body ul li) {
    margin: 0.2rem 0;
    line-height: 1.6;
  }
  :global(.portfolio-root .about .body p) {
    margin: 0 0 1rem;
    line-height: 1.7;
  }
  :global(.portfolio-root .about .body a) {
    color: var(--p-accent);
    border-bottom: 1px solid rgba(217, 182, 115, 0.4);
  }

  @media (max-width: 600px) {
    .about {
      padding: 2rem 1.25rem 3rem;
    }
  }
</style>
