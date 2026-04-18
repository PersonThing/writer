<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage, getCategoryPages, getCategoriesWithItems } from '../../lib/content.js'

  const home = getPage('/')
  const rendered = home ? parseMarkdown(home.body) : ''

  const categories = getCategoriesWithItems().map((cat) => ({
    slug: cat,
    label: cat
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
    pieces: getCategoryPages(cat).slice(0, 3),
  }))
</script>

<Layout>
  <article class="home">
    {#if home}
      <h1 class="hero-title">{home.title}</h1>
      <div class="hero-body">{@html rendered}</div>
    {/if}

    <section class="work">
      <h2>Work</h2>
      {#each categories as cat}
        <div class="category-block">
          <h3><Link href={`/${cat.slug}`}>{cat.label}</Link></h3>
          <ul>
            {#each cat.pieces as piece}
              <li><Link href={piece.routePath}>{piece.title}</Link></li>
            {/each}
          </ul>
        </div>
      {/each}
    </section>
  </article>
</Layout>

<style>
  .home {
    font-size: 1.05rem;
  }
  .hero-title {
    font-size: 2.4rem;
    font-weight: 500;
    margin-bottom: 1rem;
    line-height: 1.2;
  }
  .hero-body :global(h1),
  .hero-body :global(h2),
  .hero-body :global(h3) {
    font-weight: 500;
    margin-top: 1.5rem;
  }
  .hero-body :global(p) {
    margin-bottom: 1rem;
  }

  .work {
    margin-top: 3.5rem;
    border-top: 1px solid var(--p-border);
    padding-top: 2rem;
  }
  .work h2 {
    font-size: 1.6rem;
    font-weight: 500;
    margin-bottom: 1.5rem;
  }
  .category-block {
    margin-bottom: 2rem;
  }
  .category-block h3 {
    font-size: 1.15rem;
    font-weight: 500;
    margin-bottom: 0.4rem;
  }
  .category-block ul {
    list-style: none;
    padding: 0;
    margin: 0;
  }
  .category-block li {
    padding: 0.2rem 0;
  }
</style>
