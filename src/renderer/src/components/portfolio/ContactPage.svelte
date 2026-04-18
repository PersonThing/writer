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
    {#if rendered}
      <div class="body">{@html rendered}</div>
    {/if}
    <div class="email">
      <a href="mailto:shigorika@gmail.com">shigorika@gmail.com</a>
    </div>
  </article>
</Layout>

<style>
  .contact {
    max-width: 40rem;
    margin: 0 auto;
    padding: 4rem 2rem;
    text-align: center;
  }
  .contact h1 {
    font-size: 2rem;
    font-weight: 300;
    margin: 0 0 1rem;
  }
  :global(.portfolio-root .contact .body p) {
    color: var(--p-muted);
    margin: 0 0 1rem;
  }
  .email {
    margin-top: 2rem;
    font-size: 1.2rem;
  }
  :global(.portfolio-root .contact .email a) {
    color: var(--p-accent);
    border-bottom: 1px solid var(--p-accent);
    padding-bottom: 2px;
  }
</style>
