<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { RECOMMENDATIONS } from '@content/portfolio/_recommendations.js'
  import { getHomeSections } from '@lib/content.js'

  // Hero image from the live site (the red-wall portrait)
  const HERO = '/portfolio/images/663ee7_ce193cf08c5e4528a9c4c7c14414bd2c~mv2.jpg'

  // Homepage sections come from the catalog: each category contributes its
  // top N pieces with their metadata (thumbnail, title, description).
  const SECTIONS = getHomeSections(3)
</script>

<Layout>
  <section class="hero">
    <img src={HERO} alt="" class="hero-bg" />
    <div class="hero-content">
      <div class="hero-inner">
        <h1 class="hero-title">Fashion Editor · Content Strategist · Poet</h1>
        <p class="hero-sub">
          She's interviewed a terrorist, run point for Amazon at India Fashion Week,
          written the lyrics of a Bollywood song… and rarely refers to herself in
          the third person.
        </p>
        <Link href="/about" class="hero-cta">More about my journey</Link>
      </div>
    </div>
  </section>

  <section class="stats">
    <div><strong>16+</strong><span>Years of experience</span></div>
    <div><strong>20+</strong><span>Magazines written for</span></div>
    <div><strong>200+</strong><span>Articles</span></div>
  </section>

  {#each SECTIONS as s}
    <section class="category-section">
      <h2 class="category-heading">{s.label}</h2>
      <div class="category-row">
        <div class="category-tiles tiles-{s.pieces.length}">
          {#each s.pieces as tile}
            <Link href={tile.url} class="tile">
              <div class="tile-image">
                {#if tile.thumbnail}
                  <img src={tile.thumbnail} alt={tile.title} loading="lazy" />
                {/if}
              </div>
              <div class="tile-title">{tile.title}</div>
            </Link>
          {/each}
        </div>
        <div class="category-desc">
          <p>{s.blurb}</p>
          {#if s.viewMore}
            <Link href={s.viewMore} class="view-more">View More →</Link>
          {/if}
        </div>
      </div>
    </section>
  {/each}

  <section id="recommendations" class="category-section recommendations">
    <h2 class="category-heading">Recommendations</h2>
    <div class="recs-grid">
      {#each RECOMMENDATIONS as r}
        <blockquote class="rec">
          <div class="rec-mark">”</div>
          <p class="rec-quote">{r.quote}</p>
          <footer class="rec-author">
            <div class="rec-name">{r.author}</div>
            <div class="rec-role">{r.role}</div>
          </footer>
        </blockquote>
      {/each}
    </div>
  </section>
</Layout>

<style>
  .hero {
    position: relative;
    min-height: 560px;
    display: flex;
    align-items: stretch;
    overflow: hidden;
    border-bottom: 1px solid var(--p-border);
  }
  .hero-bg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.9;
  }
  .hero-content {
    position: relative;
    width: 100%;
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 0 var(--p-content-padding);
    display: flex;
    align-items: stretch;
  }
  .hero-inner {
    max-width: 32rem;
    width: 100%;
    padding: 3rem;
    background: rgba(0, 0, 0, 0.35);
    display: flex;
    flex-direction: column;
    justify-content: center;
  }
  .hero-title {
    font-size: 2rem;
    font-weight: 300;
    letter-spacing: 0.01em;
    margin: 0 0 1rem;
    line-height: 1.25;
    max-width: 40rem;
  }
  .hero-sub {
    max-width: 36rem;
    font-size: 1rem;
    margin: 0 0 1.4rem;
  }
  :global(.portfolio-root .hero-cta) {
    display: inline-block;
    font-size: 0.88rem;
    border-bottom: 1px solid var(--p-accent);
    padding-bottom: 2px;
    color: var(--p-text);
  }
  :global(.portfolio-root .hero-cta:hover) {
    color: var(--p-accent);
  }

  .stats {
    max-width: var(--p-content-max);
    margin: 0 auto;
    display: flex;
    justify-content: center;
    gap: 4rem;
    padding: 3rem var(--p-content-padding) 4rem;
    flex-wrap: wrap;
  }
  .stats div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
  }
  .stats strong {
    font-size: 3rem;
    font-weight: 300;
    letter-spacing: -0.01em;
  }
  .stats span {
    font-size: 0.82rem;
    color: var(--p-muted);
  }

  .category-section {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 2.5rem var(--p-content-padding);
  }
  .category-heading {
    font-size: 1.3rem;
    font-weight: 400;
    margin: 0 0 1.2rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--p-border);
  }

  .category-row {
    display: grid;
    grid-template-columns: 1fr 340px;
    gap: 2.5rem;
    align-items: start;
  }
  .category-tiles {
    display: grid;
    gap: 1.2rem;
  }
  .tiles-1 { grid-template-columns: 1fr; max-width: 24rem; }
  .tiles-2 { grid-template-columns: repeat(2, 1fr); }
  .tiles-3 { grid-template-columns: repeat(3, 1fr); }

  :global(.portfolio-root .tile) {
    display: block;
    transition: opacity 0.15s;
  }
  :global(.portfolio-root .tile:hover) {
    opacity: 0.85;
  }
  .tile-image {
    aspect-ratio: 16 / 10;
    overflow: hidden;
    background: #111;
    margin-bottom: 0.55rem;
  }
  .tile-image img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .tile-title {
    font-size: 0.88rem;
    color: var(--p-text);
  }

  .category-desc p {
    font-size: 0.88rem;
    color: var(--p-muted);
    margin: 0 0 1rem;
    line-height: 1.65;
  }
  :global(.portfolio-root .view-more) {
    display: inline-block;
    font-size: 0.82rem;
    padding: 0.5rem 1rem;
    border: 1px solid var(--p-accent);
    color: var(--p-accent);
    transition: background 0.15s, color 0.15s;
  }
  :global(.portfolio-root .view-more:hover) {
    background: var(--p-accent);
    color: #000;
  }

  @media (max-width: 900px) {
    .hero {
      min-height: 420px;
    }
    .hero-content {
      padding: 0;
    }
    .hero-inner {
      max-width: 100%;
      padding: 2rem 1.25rem;
    }
    .stats,
    .category-section {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
    .stats {
      gap: 2rem;
    }
    .stats strong {
      font-size: 2.2rem;
    }
    .category-row {
      grid-template-columns: 1fr;
    }
    .tiles-3 { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 540px) {
    .tiles-2,
    .tiles-3 {
      grid-template-columns: 1fr;
    }
  }

  .recommendations {
    scroll-margin-top: 2rem;
  }
  .recs-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 2rem 3rem;
    margin-top: 1rem;
  }
  .rec {
    position: relative;
    margin: 0;
    padding: 0 0 0 3.4rem;
  }
  .rec-mark {
    position: absolute;
    top: 0;
    left: 0;
    font-family: Georgia, serif;
    font-size: 3.2rem;
    line-height: 1;
    color: var(--p-accent);
    transform: translateY(-0.2rem) scaleX(-1);
  }
  .rec-quote {
    margin: 0 0 1rem;
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--p-text);
  }
  .rec-author {
    font-size: 0.82rem;
  }
  .rec-name {
    font-weight: 500;
    color: var(--p-text);
    margin-bottom: 0.15rem;
  }
  .rec-role {
    color: var(--p-muted);
    line-height: 1.4;
  }

  @media (max-width: 900px) {
    .recs-grid {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
  }
</style>
