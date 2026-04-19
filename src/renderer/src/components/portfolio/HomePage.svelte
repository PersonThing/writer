<script>
  // Home — editorial-masthead layout with a Ken-Burns portrait hero, a
  // rotating "I am a _____" headline, lead-per-category features, and
  // a centered "What editors say" pull-quote block.
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { onMount } from 'svelte'
  import { RECOMMENDATIONS } from '@content/portfolio/_recommendations.js'
  import { getHomeSections } from '@lib/content.js'
  import { asset } from '@lib/asset.js'

  const HERO = '/portfolio/images/663ee7_ce193cf08c5e4528a9c4c7c14414bd2c~mv2.jpg'
  // One lead piece plus up to three secondary pieces per category.
  const SECTIONS = getHomeSections(4)

  // Homepage tile subheadings. The full text stays on the piece detail
  // page — here we only want a one-line teaser. Truncate on a word
  // boundary so sentences don't cut mid-word.
  function teaser(text, max = 110) {
    if (!text) return ''
    const s = text.trim()
    if (s.length <= max) return s
    const slice = s.slice(0, max)
    const lastSpace = slice.lastIndexOf(' ')
    return (lastSpace > 40 ? slice.slice(0, lastSpace) : slice).replace(/[,;:.\s]+$/, '') + '…'
  }

  const ROLES = ['Fashion Editor.', 'Content Strategist.', 'Poet.']
  let roleIdx = $state(0)

  // Per-recommendation expand state. A quote gets a "Read more" toggle
  // only when clamped rendering would hide content (measured on mount).
  let clampable = $state(RECOMMENDATIONS.map(() => false))
  let expanded = $state(RECOMMENDATIONS.map(() => false))

  onMount(() => {
    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const timer = reduced
      ? null
      : setInterval(() => {
          roleIdx = (roleIdx + 1) % ROLES.length
        }, 2400)

    // Detect which quotes overflow the 6-line clamp. We compare the
    // clamped quote's scrollHeight to clientHeight — if greater, the
    // toggle is relevant.
    function measure() {
      clampable = RECOMMENDATIONS.map((_, i) => {
        const el = document.querySelector(`[data-rec="${i}"] .rec-quote`)
        if (!el) return false
        return el.scrollHeight - el.clientHeight > 2
      })
    }
    measure()
    window.addEventListener('resize', measure)

    return () => {
      if (timer) clearInterval(timer)
      window.removeEventListener('resize', measure)
    }
  })
</script>

<Layout>
  <section class="k-hero">
    <img class="k-bg" src={asset(HERO)} alt="" />
    <div class="k-hero-content">
      <h1 class="headline">
        I am a <span class="role-slot">
          <!-- Invisible sizer: the longest role keeps the slot width
               stable so the hero doesn't shift as roles cycle. -->
          <span class="role-sizer" aria-hidden="true">Content Strategist.</span>
          {#each ROLES as r, i}
            <span class="role" class:active={i === roleIdx}>{r}</span>
          {/each}
        </span>
      </h1>
      <p class="dek">
        She's interviewed a terrorist, run point for Amazon at India Fashion
        Week, written the lyrics of a Bollywood song… and rarely refers to
        herself in the third person.
      </p>
      <div class="hero-actions">
        <a href="#features" class="hero-cta hero-primary" onclick={(e) => {
          e.preventDefault()
          document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })
        }}>See the work ↓</a>
        <Link href="/about" class="hero-cta hero-ghost">About</Link>
      </div>
    </div>
  </section>

  <section class="stat-strip">
    <div><em>16+</em> years of experience</div>
    <div><em>20+</em> magazines written for</div>
    <div><em>200+</em> articles</div>
  </section>

  {#each SECTIONS as s, i}
    {@const hero = s.pieces[0]}
    {@const tail = s.pieces.slice(1, 4)}
    {@const compact = s.pieces.length < 4}
    {#if hero}
      <article
        class="feature"
        class:alt={i % 2 === 1}
        id={i === 0 ? 'features' : undefined}
      >
        <header class="feature-head">
          <h2 class="feature-section-title">{s.label}</h2>
        </header>

        <p class="feature-blurb">{s.blurb}</p>

        {#if compact}
          <!-- Sections with < 4 pieces render all of them equal-sized. -->
          <div
            class="feature-grid"
            class:grid-1={s.pieces.length === 1}
            class:grid-2={s.pieces.length === 2}
            class:grid-3={s.pieces.length === 3}
          >
            {#each s.pieces as p}
              <Link href={p.url} class="tail-card">
                <div class="tail-image">
                  {#if p.thumbnail}
                    <img src={asset(p.thumbnail)} alt={p.title} loading="lazy" />
                  {/if}
                </div>
                <div class="tail-meta">
                  <h4>{p.title}</h4>
                  {#if p.description}
                    <p>{teaser(p.description, 110)}</p>
                  {/if}
                </div>
              </Link>
            {/each}
          </div>
        {:else}
          <Link href={hero.url} class="feature-lead">
            <div class="feature-image">
              {#if hero.thumbnail}
                <img src={asset(hero.thumbnail)} alt={hero.title} loading="lazy" />
              {/if}
            </div>
            <div class="feature-text">
              <h3 class="feature-title">{hero.title}</h3>
              {#if hero.description}
                <p class="feature-dek">{teaser(hero.description, 180)}</p>
              {/if}
            </div>
          </Link>

          {#if tail.length}
            <div class="feature-tail" class:tail-2={tail.length === 2} class:tail-3={tail.length >= 3}>
              {#each tail as t}
                <Link href={t.url} class="tail-card">
                  <div class="tail-image">
                    {#if t.thumbnail}
                      <img src={asset(t.thumbnail)} alt={t.title} loading="lazy" />
                    {/if}
                  </div>
                  <div class="tail-meta">
                    <h4>{t.title}</h4>
                    {#if t.description}
                      <p>{teaser(t.description, 90)}</p>
                    {/if}
                  </div>
                </Link>
              {/each}
            </div>
          {/if}
        {/if}

        {#if s.viewMore}
          <div class="feature-foot">
            <Link href={s.viewMore} class="feature-more">
              All {s.label.toLowerCase()} →
            </Link>
          </div>
        {/if}
      </article>
    {/if}
  {/each}

  <section id="recommendations" class="press">
    <div class="press-head">
      <h2>Recommendations</h2>
    </div>
    <div class="press-grid">
      {#each RECOMMENDATIONS as r, i}
        <figure class="pull" data-rec={i}>
          <blockquote class="rec-quote" class:expanded={expanded[i]}>
            “{r.quote}”
          </blockquote>
          {#if clampable[i]}
            <button
              type="button"
              class="rec-toggle"
              onclick={() => (expanded[i] = !expanded[i])}
            >
              {expanded[i] ? 'Show less' : 'Read more'}
            </button>
          {/if}
          <figcaption>
            <strong>{r.author}</strong>
            <span>{r.role}</span>
          </figcaption>
        </figure>
      {/each}
    </div>
  </section>
</Layout>

<style>
  .k-hero {
    position: relative;
    /* Sized so the 16+/20+/200+ strip below peeks into the first screen. */
    min-height: 72vh;
    display: flex;
    align-items: center;
    overflow: hidden;
    border-bottom: 1px solid var(--p-border);
  }
  .k-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    transform: scale(1.08);
    animation: kenburns 24s ease-in-out infinite alternate;
    filter: brightness(0.55);
  }
  @keyframes kenburns {
    from { transform: scale(1.05) translateY(0); }
    to   { transform: scale(1.15) translateY(-2%); }
  }
  @media (prefers-reduced-motion: reduce) {
    .k-bg { animation: none; transform: none; }
  }
  .k-hero-content {
    position: relative;
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 0 var(--p-content-padding);
    width: 100%;
  }
  .headline {
    font-family: var(--p-font-display);
    font-weight: 500;
    font-size: clamp(2.6rem, 6.5vw, 5.5rem);
    line-height: 1.02;
    letter-spacing: -0.03em;
    margin: 0 0 1.6rem;
    color: var(--p-text);
    max-width: 32ch;
  }
  .role-slot {
    position: relative;
    display: inline-block;
    color: var(--p-accent);
    vertical-align: baseline;
  }
  .role-sizer {
    visibility: hidden;
    pointer-events: none;
    white-space: nowrap;
  }
  .role {
    position: absolute;
    left: 0;
    top: 0;
    opacity: 0;
    transform: translateY(0.3em);
    transition: opacity 0.45s ease, transform 0.45s ease;
    white-space: nowrap;
  }
  .role.active {
    opacity: 1;
    transform: translateY(0);
  }
  @media (prefers-reduced-motion: reduce) {
    .role {
      transition: none;
    }
  }
  .dek {
    font-size: 1.1rem;
    line-height: 1.55;
    max-width: 36rem;
    color: var(--p-text);
    margin: 0 0 1.8rem;
  }
  .hero-actions {
    display: flex;
    gap: 0.8rem;
    flex-wrap: wrap;
  }
  :global(.portfolio-root .hero-cta) {
    display: inline-block;
    font-family: var(--p-font-display);
    font-size: 0.95rem;
    letter-spacing: 0.02em;
    padding: 0.8rem 1.4rem;
    transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  :global(.portfolio-root .hero-primary) {
    background: var(--p-accent);
    color: #000;
  }
  :global(.portfolio-root .hero-primary:hover) {
    background: #fff;
  }
  :global(.portfolio-root .hero-ghost) {
    border: 1px solid rgba(255, 255, 255, 0.4);
    color: var(--p-text);
  }
  :global(.portfolio-root .hero-ghost:hover) {
    border-color: var(--p-accent);
    color: var(--p-accent);
  }

  .stat-strip {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 2rem var(--p-content-padding);
    display: flex;
    gap: 3rem;
    justify-content: center;
    border-bottom: 1px solid var(--p-border);
    font-family: var(--p-font-body);
    color: var(--p-muted);
    font-size: 0.95rem;
  }
  .stat-strip em {
    font-family: var(--p-font-display);
    font-style: normal;
    font-size: 1.8rem;
    color: var(--p-text);
    margin-right: 0.5rem;
    letter-spacing: -0.03em;
  }

  .feature {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 4rem var(--p-content-padding);
    border-bottom: 1px solid var(--p-border);
  }
  :global(.portfolio-root .feature-lead) {
    display: grid;
    grid-template-columns: 1.1fr 1fr;
    gap: 3.5rem;
    align-items: center;
    transition: opacity 0.15s;
  }
  :global(.portfolio-root .feature-lead:hover) {
    opacity: 0.9;
  }
  :global(.portfolio-root .feature.alt .feature-lead) {
    grid-template-columns: 1fr 1.1fr;
  }
  .feature.alt .feature-image {
    order: 2;
  }
  .feature-image {
    overflow: hidden;
  }
  .feature-image img {
    width: 100%;
    height: auto;
    display: block;
    transition: transform 0.5s ease;
  }
  .feature-image:hover img {
    transform: scale(1.02);
  }
  .feature-head {
    text-align: center;
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.6rem;
  }
  .feature-section-title {
    font-family: var(--p-font-body);
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    line-height: 1;
    margin: 0;
    color: var(--p-accent);
  }
  .feature-title {
    font-family: var(--p-font-display);
    font-size: 2.1rem;
    line-height: 1.1;
    letter-spacing: -0.03em;
    font-weight: 400;
    margin: 0 0 1rem;
  }
  :global(.portfolio-root .feature-title a:hover) {
    color: var(--p-accent);
  }
  .feature-dek {
    font-size: 1.05rem;
    line-height: 1.5;
    color: var(--p-text);
    margin: 0 0 1rem;
  }
  .feature-blurb {
    font-size: 0.95rem;
    color: var(--p-muted);
    line-height: 1.6;
    margin: 0 auto 2.5rem;
    max-width: 52rem;
    text-align: center;
  }
  .feature-foot {
    margin-top: 2rem;
    display: flex;
    justify-content: flex-end;
  }
  :global(.portfolio-root .feature-more) {
    display: inline-block;
    font-family: var(--p-font-display);
    font-size: 0.9rem;
    letter-spacing: 0.02em;
    color: var(--p-accent);
    border-bottom: 1px solid currentColor;
    padding-bottom: 2px;
  }

  .feature-tail {
    margin-top: 3rem;
    display: grid;
    gap: 2rem;
  }
  .feature-tail.tail-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  .feature-tail.tail-3 {
    grid-template-columns: repeat(3, 1fr);
  }

  /* Equal-sized layout for sections with <4 pieces. */
  .feature-grid {
    display: grid;
    gap: 2rem;
  }
  .feature-grid.grid-1 {
    grid-template-columns: minmax(0, 28rem);
    justify-content: center;
  }
  .feature-grid.grid-2 {
    grid-template-columns: repeat(2, 1fr);
  }
  .feature-grid.grid-3 {
    grid-template-columns: repeat(3, 1fr);
  }
  /* In compact mode the cards read as primary items, so give the title
     a touch more presence than the tail variant. */
  :global(.portfolio-root .feature-grid .tail-meta h4) {
    font-size: 1.15rem;
  }
  :global(.portfolio-root .tail-card) {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    transition: opacity 0.15s;
  }
  :global(.portfolio-root .tail-card:hover) {
    opacity: 0.85;
  }
  .tail-image {
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: #111;
  }
  .tail-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .tail-meta {
    display: flex;
    flex-direction: column;
  }
  .tail-meta h4 {
    font-family: var(--p-font-display);
    font-size: 1.05rem;
    font-weight: 400;
    letter-spacing: -0.02em;
    line-height: 1.25;
    margin: 0 0 0.35rem;
  }
  .tail-meta p {
    margin: 0;
    font-size: 0.82rem;
    color: var(--p-muted);
    line-height: 1.5;
    /* Keep secondary descriptions to a couple of lines. */
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .press {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 5rem var(--p-content-padding);
  }
  .press-head {
    text-align: center;
    margin-bottom: 3rem;
  }
  .press-head h2 {
    font-family: var(--p-font-display);
    font-size: 2.2rem;
    font-weight: 400;
    letter-spacing: -0.03em;
    margin: 0;
  }
  .press-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 3rem 4rem;
  }
  .pull {
    margin: 0;
  }
  .pull blockquote {
    font-family: var(--p-font-display);
    font-style: italic;
    font-size: 1.15rem;
    line-height: 1.45;
    letter-spacing: -0.01em;
    margin: 0 0 1rem;
    color: var(--p-text);
    /* Clamp to ~6 lines until the reader expands the quote. */
    display: -webkit-box;
    -webkit-line-clamp: 6;
    line-clamp: 6;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .pull blockquote.expanded {
    display: block;
    -webkit-line-clamp: unset;
    line-clamp: unset;
    overflow: visible;
  }
  .rec-toggle {
    background: none;
    border: none;
    padding: 0;
    margin: 0 0 0.9rem;
    cursor: pointer;
    font-family: var(--p-font-body);
    font-size: 0.82rem;
    letter-spacing: 0.04em;
    color: var(--p-accent);
    border-bottom: 1px solid currentColor;
    transition: opacity 0.15s;
  }
  .rec-toggle:hover {
    opacity: 0.8;
  }
  .pull figcaption strong {
    display: block;
    font-family: var(--p-font-body);
    font-size: 0.85rem;
    color: var(--p-text);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 0.15rem;
  }
  .pull figcaption span {
    font-size: 0.8rem;
    color: var(--p-muted);
  }

  @media (max-width: 900px) {
    .k-hero {
      min-height: 60vh;
    }
    .stat-strip {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }
    .feature {
      padding: 2.5rem var(--p-content-padding);
    }
    :global(.portfolio-root .feature-lead),
    :global(.portfolio-root .feature.alt .feature-lead) {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .feature.alt .feature-image {
      order: unset;
    }
    .feature-tail.tail-2,
    .feature-tail.tail-3,
    .feature-grid.grid-2,
    .feature-grid.grid-3 {
      grid-template-columns: 1fr;
      gap: 1.5rem;
      margin-top: 2rem;
    }
    :global(.portfolio-root .tail-card) {
      flex-direction: row;
      gap: 1rem;
    }
    :global(.portfolio-root .tail-card .tail-image) {
      flex: 0 0 120px;
      aspect-ratio: 4 / 3;
    }
    .press-grid {
      grid-template-columns: 1fr;
      gap: 2.5rem;
    }
  }
</style>
