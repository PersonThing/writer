<script>
  import Link from '../Link.svelte'
  import { onMount } from 'svelte'
  import { router } from '../../lib/router.svelte.js'

  let { children } = $props()

  let workOpen = $state(false)
  let mobileOpen = $state(false)

  const WORK_CATEGORIES = [
    { path: '/copywriting', label: 'Copywriting', hasLanding: false },
    { path: '/creative-direction', label: 'Creative Direction', hasLanding: true },
    { path: '/fashion-editorial', label: 'Fashion Editorial', hasLanding: true },
    { path: '/editorial', label: 'Editorial', hasLanding: true },
    { path: '/poetry', label: 'Poetry', hasLanding: true },
    { path: '/published-paper', label: 'Published Paper', hasLanding: true },
  ]

  const isWorkActive = $derived(
    WORK_CATEGORIES.some((c) => router.pathname.startsWith(c.path)),
  )

  onMount(() => {
    function onDocClick(e) {
      if (!e.target.closest('.work-menu')) workOpen = false
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  })
</script>

<div class="portfolio-root">
  <header class="top-nav">
    <Link href="/" class="wordmark">Shigorika</Link>

    <button
      class="hamburger"
      aria-label="Menu"
      onclick={() => (mobileOpen = !mobileOpen)}
    >
      <span></span>
      <span></span>
      <span></span>
    </button>

    <nav class:open={mobileOpen}>
      <div class="work-menu">
        <button
          class="nav-link work-trigger"
          class:active={isWorkActive}
          onclick={() => (workOpen = !workOpen)}
        >
          Work
          <span class="chevron">▾</span>
        </button>
        {#if workOpen}
          <div class="work-dropdown" role="menu">
            {#each WORK_CATEGORIES as { path, label }}
              <Link href={path} class="work-dropdown-item">{label}</Link>
            {/each}
          </div>
        {/if}
      </div>
      <Link href="/about" class="nav-link">About</Link>
      <Link href="/contact" class="nav-link">Contact</Link>
    </nav>
  </header>

  <main class="page-main">
    {@render children?.()}
  </main>

  <footer class="site-footer">
    <a class="footer-email" href="mailto:shigorika@gmail.com">
      <img class="footer-snail" src="/portfolio/chrome/snail.png" alt="" />
      <span class="footer-email-text">
        <span class="footer-email-lead">Email me at</span>
        <span class="footer-email-addr">shigorika@gmail.com</span>
      </span>
    </a>

    <nav class="footer-socials" aria-label="Social">
      <a href="https://www.linkedin.com/in/shigorika/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
        <img src="/portfolio/chrome/linkedin.png" alt="" />
      </a>
      <a href="https://www.instagram.com/schadenfreud" target="_blank" rel="noreferrer" aria-label="Instagram">
        <img src="/portfolio/chrome/instagram.png" alt="" />
      </a>
      <a href="https://thebluestocking.substack.com/" target="_blank" rel="noreferrer" aria-label="Substack">
        <img src="/portfolio/chrome/substack.png" alt="" />
      </a>
    </nav>

    <div class="footer-copy">© {new Date().getFullYear()} Shigorika. All rights reserved.</div>
  </footer>
</div>

<style>
  :global(html:has(.portfolio-root)),
  :global(body:has(.portfolio-root)) {
    background: #000;
    margin: 0;
    padding: 0;
    height: auto;
    overflow: auto;
  }

  .portfolio-root {
    --p-bg: #000;
    --p-text: #f3f1ec;
    --p-muted: #9c968a;
    --p-border: #2a2721;
    --p-accent: #d9b673;

    min-height: 100vh;
    background: var(--p-bg);
    color: var(--p-text);
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 300;
    line-height: 1.6;
    display: flex;
    flex-direction: column;
  }

  :global(.portfolio-root a) {
    color: inherit;
    text-decoration: none;
  }

  .top-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1.5rem 3rem;
    gap: 2rem;
    position: relative;
  }
  :global(.portfolio-root .wordmark) {
    font-size: 1.4rem;
    font-weight: 400;
    letter-spacing: 0.02em;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 2.5rem;
    font-size: 0.9rem;
  }
  :global(.portfolio-root .nav-link),
  .work-trigger {
    background: transparent;
    border: none;
    color: inherit;
    font: inherit;
    font-size: 0.9rem;
    cursor: pointer;
    padding: 0.4rem 0;
    opacity: 0.78;
    transition: opacity 0.15s;
  }
  :global(.portfolio-root .nav-link:hover),
  .work-trigger:hover,
  :global(.portfolio-root .nav-link.active),
  .work-trigger.active {
    opacity: 1;
  }
  .chevron {
    font-size: 0.7rem;
    margin-left: 0.3rem;
    opacity: 0.7;
  }

  .work-menu {
    position: relative;
  }
  .work-dropdown {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    background: #111;
    border: 1px solid var(--p-border);
    padding: 0.5rem 0;
    min-width: 200px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }
  :global(.portfolio-root .work-dropdown-item) {
    display: block;
    padding: 0.55rem 1.2rem;
    font-size: 0.88rem;
    opacity: 0.85;
    transition: background 0.12s, opacity 0.12s;
  }
  :global(.portfolio-root .work-dropdown-item:hover) {
    background: #1c1a15;
    opacity: 1;
  }

  .hamburger {
    display: none;
    background: none;
    border: none;
    flex-direction: column;
    gap: 4px;
    cursor: pointer;
    padding: 6px;
  }
  .hamburger span {
    width: 24px;
    height: 2px;
    background: currentColor;
    display: block;
  }

  .page-main {
    flex: 1;
  }

  .site-footer {
    border-top: 1px solid var(--p-border);
    padding: 2rem 3rem;
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2rem;
    font-size: 0.82rem;
    color: var(--p-muted);
    margin-top: 4rem;
  }
  .footer-email {
    display: flex;
    align-items: center;
    gap: 0.8rem;
    color: inherit;
    text-decoration: none;
  }
  .footer-email:hover {
    color: var(--p-text);
  }
  .footer-snail {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
  }
  .footer-email-text {
    display: flex;
    flex-direction: column;
    line-height: 1.4;
  }
  .footer-email-lead {
    font-size: 0.8rem;
    color: var(--p-muted);
  }
  .footer-email-addr {
    font-size: 0.85rem;
    color: var(--p-text);
  }

  .footer-socials {
    display: flex;
    gap: 1.2rem;
    justify-self: center;
  }
  .footer-socials a {
    display: inline-flex;
    width: 26px;
    height: 26px;
    transition: opacity 0.15s;
  }
  .footer-socials a:hover {
    opacity: 0.75;
  }
  .footer-socials img {
    width: 100%;
    height: 100%;
  }

  .footer-copy {
    justify-self: end;
    color: var(--p-muted);
  }

  @media (max-width: 800px) {
    .top-nav {
      padding: 1rem 1.25rem;
    }
    .hamburger {
      display: inline-flex;
    }
    nav {
      display: none;
      position: absolute;
      top: 100%;
      right: 0;
      left: 0;
      background: #0a0a0a;
      border-top: 1px solid var(--p-border);
      border-bottom: 1px solid var(--p-border);
      flex-direction: column;
      align-items: flex-start;
      padding: 1rem 1.25rem;
      z-index: 40;
    }
    nav.open {
      display: flex;
    }
    .work-dropdown {
      position: static;
      background: transparent;
      border: none;
      padding: 0 0 0 1rem;
      box-shadow: none;
      min-width: 0;
    }
    .site-footer {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
      padding: 2rem 1.25rem;
      gap: 1.2rem;
    }
    .footer-copy {
      justify-self: center;
    }
  }
</style>
