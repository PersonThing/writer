<script>
  import Link from '../Link.svelte'

  let { children } = $props()

  const CATEGORIES = [
    { path: '/fashion-editorial', label: 'Fashion Editorial' },
    { path: '/editorial', label: 'Editorial' },
    { path: '/creative-direction', label: 'Creative Direction' },
    { path: '/poetry', label: 'Poetry' },
    { path: '/published-paper', label: 'Published Paper' },
  ]
</script>

<div class="portfolio-root">
  <header class="top-nav">
    <Link href="/" class="wordmark">Shigorika</Link>
    <nav>
      {#each CATEGORIES as { path, label }}
        <Link href={path}>{label}</Link>
      {/each}
      <Link href="/about">About</Link>
      <Link href="/contact">Contact</Link>
    </nav>
  </header>

  <main class="page-main">
    {@render children?.()}
  </main>

  <footer class="site-footer">
    <div>
      <a href="mailto:shigorika@gmail.com">shigorika@gmail.com</a>
    </div>
    <div class="socials">
      <a href="https://www.linkedin.com/in/shigorika" target="_blank" rel="noreferrer">LinkedIn</a>
      <a href="https://www.instagram.com/schadenfreud" target="_blank" rel="noreferrer">Instagram</a>
      <a href="https://thebluestocking.substack.com" target="_blank" rel="noreferrer">Substack</a>
    </div>
  </footer>
</div>

<style>
  :global(.portfolio-root) {
    --p-bg: #faf7f0;
    --p-text: #1a1a1a;
    --p-muted: #6b6b6b;
    --p-border: #d8d3c4;
    --p-accent: #8a6d2a;
    --p-max-width: 42rem;

    min-height: 100vh;
    background: var(--p-bg);
    color: var(--p-text);
    font-family: Georgia, 'Times New Roman', serif;
    line-height: 1.7;
  }

  :global(.portfolio-root a) {
    color: inherit;
    text-decoration: none;
  }
  :global(.portfolio-root .page-main a) {
    color: var(--p-accent);
    text-decoration: underline;
  }

  .top-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 2rem;
    border-bottom: 1px solid var(--p-border);
    flex-wrap: wrap;
    gap: 1rem;
  }
  .top-nav :global(.wordmark) {
    font-size: 1.5rem;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
  .top-nav nav {
    display: flex;
    gap: 1.4rem;
    flex-wrap: wrap;
    font-size: 0.9rem;
  }
  .top-nav nav :global(a:hover) {
    color: var(--p-accent);
  }

  .page-main {
    max-width: var(--p-max-width);
    margin: 0 auto;
    padding: 3rem 2rem 4rem;
  }

  .site-footer {
    border-top: 1px solid var(--p-border);
    padding: 2rem;
    display: flex;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.85rem;
    color: var(--p-muted);
    flex-wrap: wrap;
  }
  .site-footer a:hover {
    color: var(--p-accent);
  }
  .socials {
    display: flex;
    gap: 1.2rem;
  }

  @media (max-width: 640px) {
    .top-nav {
      flex-direction: column;
      align-items: flex-start;
    }
    .top-nav nav {
      gap: 0.9rem;
      font-size: 0.82rem;
    }
    .page-main {
      padding: 2rem 1.25rem 3rem;
    }
  }
</style>
