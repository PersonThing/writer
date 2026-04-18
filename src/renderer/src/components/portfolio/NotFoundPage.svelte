<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
</script>

<Layout>
  <article class="notfound">
    <h1>Not found</h1>
    <p>That page doesn't exist.</p>
    <Link href="/" class="home-link">Back to home</Link>
  </article>
</Layout>

<style>
  .notfound {
    max-width: 40rem;
    margin: 0 auto;
    padding: 6rem 2rem;
    text-align: center;
  }
  .notfound h1 {
    font-size: 2rem;
    font-weight: 300;
    margin: 0 0 1rem;
  }
  .notfound p {
    color: var(--p-muted);
    margin-bottom: 1.5rem;
  }
  :global(.portfolio-root .home-link) {
    color: var(--p-accent);
    border-bottom: 1px solid var(--p-accent);
    padding-bottom: 2px;
  }
</style>
