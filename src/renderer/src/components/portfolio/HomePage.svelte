<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { getPage, getCategoryPages, getCategoriesWithItems } from '../../lib/content.js'

  const CATEGORY_LABELS = {
    copywriting: 'Copywriting',
    'creative-direction': 'Creative Direction',
    'fashion-editorial': 'Fashion Editorial',
    editorial: 'Editorial',
    poetry: 'Poetry',
    'published-paper': 'Published Paper',
  }

  const CATEGORY_BLURBS = {
    copywriting:
      'Watches Of Switzerland collaborates with its brand partners Grand Seiko and Tag Heuer for its custom content program Anytime Anywhere. I lead its distribution across the in-house social media pages and on-site copy.',
    'creative-direction':
      'End-to-end delivery from concept to shoot to merchandising in accordance with the themes of the annual content calendar, surfacing high-performing inventory across 14 product categories.',
    'fashion-editorial':
      "Op-Eds and Columns written for The Hindu, The Sunday Guardian, and Harper's Bazaar on trends impacting the Indian sub-continent. Also includes Trend Forecasts for Amazon India.",
    editorial:
      'Cultural critique of the Indian zeitgeist, ranging from 2010s fashion weeks to more recent op-eds.',
    poetry:
      'Published in Outlook Magazine and Abobo Zine. A growing section — more on Substack.',
  }

  const categories = getCategoriesWithItems().map((cat) => ({
    slug: cat,
    label: CATEGORY_LABELS[cat] || cat,
    blurb: CATEGORY_BLURBS[cat] || '',
    pieces: getCategoryPages(cat).slice(0, 3),
  }))

  // Published paper is a single page, not a category — surface it separately
  const publishedPaper = getPage('/published-paper')
</script>

<Layout>
  <section class="hero">
    <div class="hero-inner">
      <h1 class="hero-title">Fashion Editor · Content Strategist · Poet</h1>
      <p class="hero-sub">
        She's interviewed a terrorist, run point for Amazon at India Fashion Week,
        written the lyrics of a Bollywood song… and rarely refers to herself in
        the third person.
      </p>
      <Link href="/about" class="hero-cta">More about my journey</Link>
    </div>
  </section>

  <section class="stats">
    <div><strong>16+</strong><span>Years of experience</span></div>
    <div><strong>20+</strong><span>Magazines written for</span></div>
    <div><strong>200+</strong><span>Articles</span></div>
  </section>

  {#each categories as cat}
    <section class="category-section">
      <h2 class="category-heading">{cat.label}</h2>
      <div class="category-row">
        <div class="category-tiles">
          {#each cat.pieces as piece}
            <Link href={piece.routePath} class="tile">
              {#if piece.images[0]}
                <div class="tile-image">
                  <img src={piece.images[0]} alt={piece.title} loading="lazy" />
                </div>
              {/if}
              <div class="tile-title">{piece.title}</div>
            </Link>
          {/each}
        </div>
        <div class="category-desc">
          <p>{cat.blurb}</p>
          <Link href={`/${cat.slug}`} class="view-more">View More →</Link>
        </div>
      </div>
    </section>
  {/each}

  {#if publishedPaper}
    <section class="category-section">
      <h2 class="category-heading">Paper</h2>
      <div class="category-row">
        <div class="category-tiles">
          <Link href="/published-paper" class="tile">
            {#if publishedPaper.images[0]}
              <div class="tile-image">
                <img
                  src={publishedPaper.images[0]}
                  alt={publishedPaper.title}
                  loading="lazy"
                />
              </div>
            {/if}
            <div class="tile-title">{publishedPaper.title}</div>
          </Link>
        </div>
        <div class="category-desc">
          <p>Published academic work.</p>
          <Link href="/published-paper" class="view-more">View →</Link>
        </div>
      </div>
    </section>
  {/if}
</Layout>

<style>
  .hero {
    padding: 3rem 3rem 2rem;
    border-bottom: 1px solid var(--p-border);
  }
  .hero-inner {
    max-width: 70rem;
    margin: 0 auto;
  }
  .hero-title {
    font-size: 2rem;
    font-weight: 300;
    letter-spacing: 0.01em;
    margin: 0 0 1rem;
    line-height: 1.25;
  }
  .hero-sub {
    max-width: 40rem;
    font-size: 1rem;
    color: var(--p-muted);
    margin: 0 0 1.2rem;
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
    display: flex;
    justify-content: center;
    gap: 4rem;
    padding: 3rem 3rem 4rem;
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
    max-width: 78rem;
    margin: 0 auto;
    padding: 2.5rem 3rem;
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
    grid-template-columns: repeat(3, 1fr);
    gap: 1.2rem;
  }
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
    .hero,
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
    .category-tiles {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 540px) {
    .category-tiles {
      grid-template-columns: 1fr;
    }
  }
</style>
