<script>
  import Link from '../Link.svelte'
  import { onMount } from 'svelte'
  import { router } from '../../lib/router.svelte.js'
  import { asset } from '../../lib/asset.js'

  let { children } = $props()

  let workOpen = $state(false)
  let mobileOpen = $state(false)
  // Auto-hide header: hidden when the user scrolls down past the hero,
  // revealed the moment they scroll up.
  let navHidden = $state(false)

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

  function handleRecsClick(e) {
    // If we're already on the home page, just scroll. Otherwise navigate to /
    // and scroll after the new page mounts.
    if (e.metaKey || e.ctrlKey || e.shiftKey) return
    e.preventDefault()
    mobileOpen = false
    if (router.pathname !== '/') {
      router.navigate('/')
      // Wait for HomePage to render, then scroll
      setTimeout(() => {
        document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })
      }, 50)
    } else {
      document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  onMount(() => {
    function onDocClick(e) {
      if (!e.target.closest('.work-menu')) workOpen = false
    }
    document.addEventListener('mousedown', onDocClick)

    // Auto-hide scroll logic. Keep the bar pinned when the user is at
    // the very top, when a dropdown is open, or when the mobile nav is
    // expanded; otherwise hide on downward scroll and reveal on upward.
    let lastY = window.scrollY
    let accumUp = 0
    let accumDown = 0
    let ticking = false
    const SHOW_TOP = 10            // always show above this scroll position
    const HIDE_AFTER = 160         // don't hide until past this far down
    const DOWN_DELTA = 8           // px of sustained downward scroll to trigger hide
    const UP_DELTA = 6             // px of upward scroll to trigger show

    function update() {
      ticking = false
      const y = window.scrollY
      const dy = y - lastY
      lastY = y

      if (y <= SHOW_TOP) { navHidden = false; accumUp = accumDown = 0; return }
      if (workOpen || mobileOpen) { navHidden = false; accumUp = accumDown = 0; return }

      if (dy > 0) {
        accumDown += dy; accumUp = 0
        if (accumDown > DOWN_DELTA && y > HIDE_AFTER) navHidden = true
      } else if (dy < 0) {
        accumUp += -dy; accumDown = 0
        if (accumUp > UP_DELTA) navHidden = false
      }
    }

    function onScroll() {
      if (!ticking) { requestAnimationFrame(update); ticking = true }
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      document.removeEventListener('mousedown', onDocClick)
      window.removeEventListener('scroll', onScroll)
    }
  })
</script>

<div class="portfolio-root">
  <header class="top-nav" class:top-nav-hidden={navHidden}>
    <div class="top-nav-inner">
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
        <Link href="/" class="nav-link">Home</Link>

        <div class="dropdown-menu work-menu">
          <button
            class="nav-link dropdown-trigger"
            class:active={isWorkActive}
            onclick={() => (workOpen = !workOpen)}
          >
            Work
            <span class="chevron">▾</span>
          </button>
          {#if workOpen}
            <div class="dropdown-panel" role="menu">
              {#each WORK_CATEGORIES as { path, label }}
                <Link href={path} class="dropdown-item">{label}</Link>
              {/each}
            </div>
          {/if}
        </div>

        <a href="/#recommendations" class="nav-link" onclick={handleRecsClick}>Recommendations</a>
        <Link href="/about" class="nav-link">About</Link>
        <Link href="/contact" class="nav-link">Contact</Link>
      </nav>
    </div>
  </header>

  <main class="page-main">
    {@render children?.()}
  </main>

  <footer class="site-footer">
    <div class="site-footer-inner">
      <a class="footer-email" href="mailto:shigorika@gmail.com">
        <img class="footer-snail" src={asset('/portfolio/chrome/snail.png')} alt="" />
        <span class="footer-email-text">
          <span class="footer-email-lead">Email me at</span>
          <span class="footer-email-addr">shigorika@gmail.com</span>
        </span>
      </a>

      <nav class="footer-socials" aria-label="Social">
        <a href="https://www.linkedin.com/in/shigorika/" target="_blank" rel="noreferrer" aria-label="LinkedIn">
          <img src={asset('/portfolio/chrome/linkedin.png')} alt="" />
        </a>
        <a href="https://www.instagram.com/schadenfreud" target="_blank" rel="noreferrer" aria-label="Instagram">
          <img src={asset('/portfolio/chrome/instagram.png')} alt="" />
        </a>
        <a href="https://thebluestocking.substack.com/" target="_blank" rel="noreferrer" aria-label="Substack">
          <img src={asset('/portfolio/chrome/substack.png')} alt="" />
        </a>
      </nav>

      <div class="footer-copy">© {new Date().getFullYear()} Shigorika. All rights reserved.</div>
    </div>
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
    --p-text: #ffffff;
    --p-muted: #b3b3b3;
    --p-border: #2a2721;
    --p-accent: #d9b673;

    /* Shared content dimensions. Backgrounds span the page; content
       inside these widths keeps left/right edges aligned. */
    --p-content-max: 78rem;
    --p-content-padding: 3rem;

    /* Type system mirrors the live Wix site. */
    --p-font-display: 'Syne', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    --p-font-body: 'Questrial', 'Helvetica Neue', Helvetica, Arial, sans-serif;

    min-height: 100vh;
    background: var(--p-bg);
    color: var(--p-text);
    font-family: var(--p-font-body);
    font-weight: 400;
    line-height: 1.6;
    display: flex;
    flex-direction: column;
  }

  :global(.portfolio-root a) {
    color: inherit;
    text-decoration: none;
  }

  .top-nav {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 50;
    padding: 1rem 0;
    background: var(--p-bg);
    transform: translate3d(0, 0, 0);
    transition: transform 0.28s ease;
    will-change: transform;
  }
  .top-nav-hidden {
    transform: translate3d(0, -100%, 0);
  }
  @media (prefers-reduced-motion: reduce) {
    .top-nav { transition: none; }
  }
  .top-nav-inner {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 0 var(--p-content-padding);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 2rem;
  }
  :global(.portfolio-root .wordmark) {
    font-family: var(--p-font-display);
    font-size: 1.7rem;
    font-weight: 500;
    letter-spacing: -0.02em;
  }

  nav {
    display: flex;
    align-items: center;
    gap: 2.5rem;
    font-size: 0.9rem;
  }
  :global(.portfolio-root .nav-link),
  .dropdown-trigger {
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
  .dropdown-trigger:hover,
  :global(.portfolio-root .nav-link.active),
  .dropdown-trigger.active {
    opacity: 1;
  }
  .chevron {
    font-size: 0.7rem;
    margin-left: 0.3rem;
    opacity: 0.7;
  }

  .dropdown-menu {
    position: relative;
  }
  .dropdown-panel {
    position: absolute;
    top: calc(100% + 0.5rem);
    left: 0;
    background: #111;
    border: 1px solid var(--p-border);
    padding: 0.5rem 0;
    min-width: 220px;
    z-index: 50;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
  }
  :global(.portfolio-root .dropdown-item) {
    display: block;
    padding: 0.55rem 1.2rem;
    font-size: 0.88rem;
    opacity: 0.85;
    white-space: nowrap;
    transition: background 0.12s, opacity 0.12s;
  }
  :global(.portfolio-root .dropdown-item:hover) {
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
    /* Reserve space under the fixed top nav so the first content
       block isn't covered. ~64px matches the nav's padding + line-box. */
    padding-top: 64px;
  }

  .site-footer {
    border-top: 1px solid var(--p-border);
    padding: 2rem 0;
    font-size: 0.82rem;
    color: var(--p-muted);
    margin-top: 4rem;
  }
  .site-footer-inner {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 0 var(--p-content-padding);
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    gap: 2rem;
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
    .top-nav-inner {
      padding: 0 1.25rem;
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
    .dropdown-panel {
      position: static;
      background: transparent;
      border: none;
      padding: 0 0 0 1rem;
      box-shadow: none;
      min-width: 0;
    }
    .site-footer-inner {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
      padding: 0 1.25rem;
      gap: 1.2rem;
    }
    .footer-copy {
      justify-self: center;
    }
  }
</style>
