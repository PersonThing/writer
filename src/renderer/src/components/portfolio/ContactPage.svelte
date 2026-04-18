<script>
  import Layout from './Layout.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  const page = getPage('/contact')
  const rendered = page ? parseMarkdown(page.body) : ''
</script>

<Layout>
  <article class="contact">
    <h1>Contact</h1>
    {#if page}
      <div class="body">{@html rendered}</div>
    {/if}
    <div class="email">
      <a href="mailto:shigorika@gmail.com">shigorika@gmail.com</a>
    </div>
  </article>
</Layout>

<style>
  .contact h1 {
    font-size: 2rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }
  .body :global(p) {
    margin-bottom: 1rem;
  }
  .email {
    margin-top: 2rem;
    font-size: 1.1rem;
  }
</style>
