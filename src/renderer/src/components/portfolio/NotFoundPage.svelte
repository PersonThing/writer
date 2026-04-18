<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
</script>

<Layout>
  <article class="notfound">
    <h1>Not found</h1>
    <p>That page doesn't exist.</p>
    <Link href="/">Back to home</Link>
  </article>
</Layout>

<style>
  .notfound h1 {
    font-size: 2rem;
    font-weight: 500;
    margin-bottom: 1rem;
  }
  .notfound p {
    color: var(--p-muted);
    margin-bottom: 1.5rem;
  }
</style>
