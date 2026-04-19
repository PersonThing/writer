<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { RECOMMENDATIONS } from '../../../../../content/portfolio/_recommendations.js'

  const IMG = (id) => `/portfolio/images/${id}`

  // Hero image from the live site (the red-wall portrait)
  const HERO = IMG('663ee7_ce193cf08c5e4528a9c4c7c14414bd2c~mv2.jpg')

  // Sections in the exact order and with the exact tile images used on shigorika.com.
  // Each tile's image is the prod thumbnail (via stable Wix media ID), NOT the
  // first image in the piece's markdown frontmatter.
  const SECTIONS = [
    {
      label: 'Copywriting',
      slug: 'copywriting',
      blurb:
        'Watches Of Switzerland collaborates with its brand partners Grand Seiko and Tag Heuer for its custom content program called Anytime Anywhere. I lead its distribution across the in-house social media pages and on-site copy presence.',
      viewMore: null, // no category landing page
      tiles: [
        { href: '/copywriting/grand-seiko-film', title: 'Grand Seiko Film',  img: IMG('663ee7_052cb7c61d0648339e38852fa79551af~mv2.jpg') },
        { href: '/copywriting/tag-heuer-film',   title: 'Tag Heuer Film',    img: IMG('663ee7_6ae55d6c83094ba2bc24b5e13ac87e29~mv2.jpg') },
      ],
    },
    {
      label: 'Creative Direction',
      slug: 'creative-direction',
      blurb:
        'End-to-end delivery from concept to shoot to merchandising in accordance with the themes of the annual content calendar to surface the high performing inventory across the 14 different product categories.',
      viewMore: '/creative-direction',
      tiles: [
        { href: '/creative-direction/ethnicwear-db',      title: 'Amazon Designer Boutique', img: IMG('663ee7_a5097ef05be94683bbb17a74fb7aaa03~mv2.jpg') },
        { href: '/creative-direction/style-in-the-city',  title: 'Style in the City',        img: IMG('663ee7_19c73452b3574e2096fb6f467db582a1~mv2.jpg') },
        { href: '/creative-direction/seasonal-campaigns', title: 'Seasonal Campaigns',       img: IMG('663ee7_9dabb2e6f8184452a79b5fbaeefeb474~mv2.jpg') },
      ],
    },
    {
      label: 'Fashion Editorial',
      slug: 'fashion-editorial',
      blurb:
        "Op-Eds and Columns written for The Hindu, the-Sunday-guardian, Harper's Bazaar on trends impacting the Indian sub-continent. Also includes Trend Forecasts for Amazon India with certain parts redacted for confidentiality.",
      viewMore: '/fashion-editorial',
      tiles: [
        { href: '/fashion-editorial/azzedine-alaia--master-and-maverick',                       title: 'Azzedine Alaia: Master & Maverick',                  img: IMG('663ee7_08f7f8e6db7e4d47a29dc73dbf8dfb84~mv2.png') },
        { href: '/fashion-editorial/you-dont-need-to-be-a-wizard-to-pull-off-a-cape-this-winter', title: "You don't need to be a wizard to pull off a cape this winter", img: IMG('663ee7_b10f3f0e1ba64995ad8a821ff939e429~mv2.png') },
        { href: '/fashion-editorial/fashion-weak-is-it',                                         title: 'Fashion Weak, Is It?',                               img: IMG('663ee7_a6798de174b647e78c6624988f6798fc~mv2.png') },
      ],
    },
    {
      label: 'Editorial',
      slug: 'editorial',
      blurb:
        'Cultural critique of the Indian zeitgeist, ranging from 2010s fashion weeks to more recent op-eds.',
      viewMore: '/editorial',
      tiles: [
        { href: '/editorial/weekend-watch-coming-of-rage-with-i-may-destroy-you',                        title: 'Coming-of-rage with I May Destroy You', img: IMG('663ee7_4af351a4600b45cf9db26f24e7d55327~mv2.png') },
        { href: '/editorial/as-news-gets-compromised-for-clicks-3-saviours-rise-to-the-challenge',       title: 'As news gets compromised for clicks, 3 saviours rise', img: IMG('663ee7_368c7b4d2d69484294d27c1d938d5f06~mv2.png') },
        { href: '/editorial/its-time-for-a-period-of-change-at-workplace',                               title: "It's time for a period of change at workplace", img: IMG('663ee7_f44e73db98c24a9f8ea420578c995067~mv2.png') },
      ],
    },
    {
      label: 'Poetry',
      slug: 'poetry',
      blurb:
        'Published in Outlook Magazine 2022 in New Delhi, and in Abobo Zine 2023 in New York, this is a growing section. You can also find them directly on my Substack.',
      viewMore: '/poetry',
      tiles: [
        { href: '/poetry/on-writing',              title: 'On Writing',              img: IMG('663ee7_46d6bfab8bcc4420bbb2bb75a795988a~mv2.png') },
        { href: '/poetry/hannah-banana',           title: 'Hannah Banana',           img: IMG('663ee7_987702b503f84824a810d95918c3b38a~mv2.png') },
        { href: '/poetry/my-dad-socks-and-gulzar', title: 'My Dad, Socks & Gulzar',  img: IMG('663ee7_4f807ce6e43a458193f2d4caaabe9359~mv2.png') },
      ],
    },
    {
      label: 'Paper',
      slug: 'published-paper',
      blurb: 'Published academic work.',
      viewMore: null,
      tiles: [
        { href: '/published-paper', title: 'The Evolution of the Fashion Image', img: IMG('663ee7_2d3cbdd7d9af4ada844a80785e538770~mv2.jpg') },
      ],
    },
  ]
</script>

<Layout>
  <section class="hero">
    <img src={HERO} alt="" class="hero-bg" />
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

  {#each SECTIONS as s}
    <section class="category-section">
      <h2 class="category-heading">{s.label}</h2>
      <div class="category-row">
        <div class="category-tiles tiles-{s.tiles.length}">
          {#each s.tiles as tile}
            <Link href={tile.href} class="tile">
              <div class="tile-image">
                <img src={tile.img} alt={tile.title} loading="lazy" />
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
    min-height: 420px;
    display: flex;
    align-items: center;
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
  .hero-inner {
    position: relative;
    max-width: 70rem;
    width: 100%;
    margin: 0 auto;
    padding: 3rem 3rem;
    background: rgba(0, 0, 0, 0.25);
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
    .hero-inner {
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
    display: grid;
    grid-template-columns: auto 1fr;
    column-gap: 1.25rem;
    margin: 0;
    padding: 0;
  }
  .rec-mark {
    font-family: Georgia, serif;
    font-size: 3.2rem;
    line-height: 1;
    color: var(--p-accent);
    transform: translateY(-0.2rem) scaleX(-1);
    grid-row: 1 / 3;
    align-self: start;
  }
  .rec-quote {
    margin: 0 0 1rem;
    font-size: 0.92rem;
    line-height: 1.6;
    color: var(--p-text);
  }
  .rec-author {
    font-size: 0.82rem;
    grid-column: 2;
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
