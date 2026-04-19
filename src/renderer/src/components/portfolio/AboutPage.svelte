<script>
  // About — editorial CV: giant Syne display heading, portrait on the
  // right with a © caption, two numbered columns (Work / Education)
  // rendered as editorial entries with large role titles and muted bylines.
  import Layout from './Layout.svelte'
  import { parseMarkdown } from '@lib/markdown.js'
  import { getPage } from '@lib/content.js'
  import { parseAbout } from '@lib/about-sections.js'

  const page = getPage('/about')
  const parsed = parseAbout(page?.body || '')

  // Strip the "Follow me on …" paragraph from the intro body — that line
  // is rendered below as a row of social logos instead of link text.
  const introMarkdown = (parsed.intro || '')
    .split(/\n{2,}/)
    .filter((p) => !/^\s*Follow me on\b/i.test(p))
    .join('\n\n')
  const introHtml = parseMarkdown(introMarkdown)

  const SOCIALS = [
    {
      href: 'https://www.instagram.com/schadenfreud',
      label: 'Instagram',
      icon: '/portfolio/chrome/instagram.png',
    },
    {
      href: 'https://www.linkedin.com/in/shigorika',
      label: 'LinkedIn',
      icon: '/portfolio/chrome/linkedin.png',
    },
    {
      href: 'https://thebluestocking.substack.com',
      label: 'Substack',
      icon: '/portfolio/chrome/substack.png',
    },
  ]
</script>

<Layout>
  <article class="ed">
    <header class="ed-head">
      <div class="ed-head-text">
        <h1>Hi, I am<br /><em>Shigorika.</em></h1>
        <div class="intro body">{@html introHtml}</div>
        <nav class="ed-socials" aria-label="Social links">
          {#each SOCIALS as s}
            <a href={s.href} target="_blank" rel="noreferrer" aria-label={s.label}>
              <img src={s.icon} alt="" />
            </a>
          {/each}
        </nav>
      </div>
      <figure class="ed-portrait">
        <img
          src="/portfolio/images/663ee7_b220f43509264034b686cd84c50d3835~mv2.png"
          alt="Portrait of Shigorika"
        />
        <figcaption>© Sarah Morris</figcaption>
      </figure>
    </header>

    <div class="ed-rule">
      <span>Curriculum</span>
      <span>Vol. XVI</span>
      <span>New York · Paris · New Delhi</span>
      <span>2007 —</span>
    </div>

    <div class="ed-cols">
      {#if parsed.experience}
        <section class="ed-col">
          <header class="col-head">
            <h2>{parsed.experience.heading}</h2>
          </header>
          <ol class="entries">
            {#each parsed.experience.entries as e}
              <li class="entry">
                {#if e.dates}<div class="entry-dates">{e.dates}</div>{/if}
                <h3 class="entry-title">{e.title}</h3>
                {#if e.lines.length}
                  <p class="entry-body">
                    {#each e.lines as l, i}
                      {@html parseMarkdown(l)}
                      {#if i < e.lines.length - 1}<span class="dotted"> · </span>{/if}
                    {/each}
                  </p>
                {/if}
              </li>
            {/each}
          </ol>
        </section>
      {/if}

      {#if parsed.education}
        <section class="ed-col">
          <header class="col-head">
            <h2>{parsed.education.heading}</h2>
          </header>
          <ol class="entries">
            {#each parsed.education.entries as e}
              <li class="entry">
                {#if e.dates}<div class="entry-dates">{e.dates}</div>{/if}
                <h3 class="entry-title">{e.title}</h3>
                {#if e.description}<p class="entry-descr"><em>{e.description}</em></p>{/if}
                {#if e.lines.length}
                  <p class="entry-body">{e.lines.join(' ')}</p>
                {/if}
              </li>
            {/each}
          </ol>
        </section>
      {/if}
    </div>
  </article>
</Layout>

<style>
  .ed {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 3rem var(--p-content-padding) 5rem;
  }

  .ed-head {
    display: grid;
    grid-template-columns: 1.4fr 1fr;
    gap: 3.5rem;
    align-items: start;
    margin-bottom: 2.5rem;
  }
  .ed-head h1 {
    font-family: var(--p-font-display);
    font-size: clamp(3rem, 8vw, 6.5rem);
    line-height: 0.95;
    letter-spacing: -0.05em;
    font-weight: 400;
    margin: 0 0 1.5rem;
  }
  .ed-head h1 em {
    font-style: italic;
    color: var(--p-accent);
  }
  .intro {
    font-size: 1.05rem;
    line-height: 1.6;
    max-width: 34rem;
    color: var(--p-text);
  }
  :global(.portfolio-root .ed .intro p) {
    margin: 0 0 1rem;
  }
  :global(.portfolio-root .ed .intro a) {
    color: var(--p-accent);
    border-bottom: 1px solid rgba(217, 182, 115, 0.4);
  }

  .ed-socials {
    display: flex;
    gap: 1.1rem;
    margin-top: 1.2rem;
  }
  .ed-socials a {
    display: inline-flex;
    width: 28px;
    height: 28px;
    transition: opacity 0.15s;
  }
  .ed-socials a:hover {
    opacity: 0.7;
  }
  .ed-socials img {
    width: 100%;
    height: 100%;
    display: block;
  }

  .ed-portrait {
    margin: 0;
  }
  .ed-portrait img {
    width: 100%;
    height: auto;
    display: block;
  }
  .ed-portrait figcaption {
    margin-top: 0.8rem;
    font-size: 0.78rem;
    line-height: 1.45;
    color: var(--p-muted);
    letter-spacing: 0.02em;
  }

  .ed-rule {
    display: flex;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
    padding: 0.75rem 0;
    border-top: 1px solid var(--p-border);
    border-bottom: 1px solid var(--p-border);
    font-family: var(--p-font-body);
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--p-muted);
    margin-bottom: 3rem;
  }

  .ed-cols {
    display: grid;
    grid-template-columns: 1.3fr 1fr;
    gap: 4rem;
  }

  .col-head {
    display: flex;
    align-items: baseline;
    gap: 1rem;
    margin-bottom: 2rem;
    padding-bottom: 0.7rem;
    border-bottom: 1px solid var(--p-border);
  }
  .col-head h2 {
    font-family: var(--p-font-display);
    font-size: 1.6rem;
    font-weight: 400;
    letter-spacing: -0.02em;
    margin: 0;
  }

  .entries {
    list-style: none;
    padding: 0;
    margin: 0;
    counter-reset: entry;
  }
  .entry {
    padding: 1.3rem 0;
    border-bottom: 1px solid var(--p-border);
  }
  .entry-dates {
    font-family: var(--p-font-body);
    font-size: 0.72rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--p-muted);
    margin-bottom: 0.4rem;
  }
  .entry-title {
    font-family: var(--p-font-display);
    font-size: 1.35rem;
    font-weight: 400;
    letter-spacing: -0.02em;
    margin: 0 0 0.4rem;
    line-height: 1.2;
  }
  .entry-body {
    margin: 0;
    font-size: 0.92rem;
    color: var(--p-muted);
    line-height: 1.55;
  }
  .entry-descr {
    margin: 0 0 0.4rem;
    font-size: 0.9rem;
    color: var(--p-muted);
  }
  :global(.portfolio-root .entry-body p) {
    display: inline;
    margin: 0;
  }
  :global(.portfolio-root .entry-body em) {
    font-style: italic;
    color: var(--p-muted);
  }
  .dotted { color: var(--p-accent); }

  @media (max-width: 900px) {
    .ed-head {
      grid-template-columns: 1fr;
      gap: 2rem;
    }
    .ed-cols {
      grid-template-columns: 1fr;
      gap: 2.5rem;
    }
  }
</style>
