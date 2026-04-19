<script>
  import Layout from './Layout.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'

  const page = getPage('/about')

  // Split the markdown on the top-level `## ` headings so we can render
  // Work Experience and Education side by side on wide screens.
  const sections = parseSections(page?.body || '')

  function parseSections(body) {
    const result = { intro: '', experience: null, education: null }
    if (!body) return result

    const lines = body.split('\n')
    let current = { heading: null, lines: [] }
    const chunks = [current]
    for (const line of lines) {
      const m = line.match(/^##\s+(.+)$/)
      if (m) {
        current = { heading: m[1].trim(), lines: [] }
        chunks.push(current)
      } else {
        current.lines.push(line)
      }
    }

    result.intro = parseMarkdown(chunks[0].lines.join('\n'))
    for (const c of chunks.slice(1)) {
      const html = parseMarkdown(c.lines.join('\n'))
      if (/experience/i.test(c.heading)) result.experience = { heading: c.heading, html }
      else if (/education/i.test(c.heading)) result.education = { heading: c.heading, html }
      else {
        // Unknown section — append to intro so we don't drop it.
        result.intro += `<h2>${c.heading}</h2>` + html
      }
    }
    return result
  }
</script>

<Layout>
  <article class="about">
    <div class="about-header">
      <img
        class="portrait"
        src="/portfolio/images/663ee7_b220f43509264034b686cd84c50d3835~mv2.png"
        alt="Shigorika"
      />
      <div class="intro">
        <h1>{page?.title || 'About'}</h1>
        {#if sections.intro}
          <div class="body">{@html sections.intro}</div>
        {/if}
      </div>
    </div>

    {#if sections.experience || sections.education}
      <div class="about-columns">
        {#if sections.experience}
          <section class="col body">
            <h2>{sections.experience.heading}</h2>
            {@html sections.experience.html}
          </section>
        {/if}
        {#if sections.education}
          <section class="col body">
            <h2>{sections.education.heading}</h2>
            {@html sections.education.html}
          </section>
        {/if}
      </div>
    {/if}
  </article>
</Layout>

<style>
  .about {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 3rem var(--p-content-padding) 4rem;
  }

  .about-header {
    display: grid;
    grid-template-columns: 260px 1fr;
    gap: 2.5rem;
    align-items: start;
    margin-bottom: 3rem;
  }
  .portrait {
    width: 100%;
    height: auto;
    display: block;
  }

  .about h1 {
    font-family: var(--p-font-display);
    font-size: 2.56rem;         /* 41px */
    font-weight: 400;
    line-height: 1;
    letter-spacing: -0.05em;
    margin: 0 0 1.5rem;
  }
  .about-header .intro {
    font-size: 1.125rem;         /* 18px — font_7 */
    line-height: 1.3;
    letter-spacing: -0.01em;
  }

  .about-columns {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3rem;
    align-items: start;
  }

  :global(.portfolio-root .about .body h2) {
    font-family: var(--p-font-display);
    font-size: 1.875rem;         /* 30px — font_2 */
    font-weight: 400;
    line-height: 1.1;
    letter-spacing: -0.03em;
    margin: 0 0 1.5rem;
    color: var(--p-text);
    text-transform: none;
  }
  :global(.portfolio-root .about .body h3) {
    font-family: var(--p-font-display);
    font-size: 1.625rem;         /* 26px — font_3 */
    font-weight: 400;
    line-height: 1.2;
    letter-spacing: -0.04em;
    margin: 1.75rem 0 0.4rem;
    color: var(--p-text);
  }
  :global(.portfolio-root .about .body ul) {
    list-style: none;
    padding-left: 0;
    margin: 0 0 1rem;
    color: var(--p-muted);
  }
  :global(.portfolio-root .about .body ul li) {
    font-size: 0.875rem;          /* 14px — font_9 */
    line-height: 1.45;
    letter-spacing: 0;
    margin: 0.1rem 0;
  }
  :global(.portfolio-root .about .body ul li em) {
    font-style: italic;
    color: var(--p-muted);
  }
  :global(.portfolio-root .about .body p) {
    margin: 0 0 1rem;
    line-height: 1.3;
  }
  :global(.portfolio-root .about .body p em) {
    font-style: italic;
    color: var(--p-muted);
  }
  :global(.portfolio-root .about .body a) {
    color: var(--p-text);
    border-bottom: 1px solid rgba(255, 255, 255, 0.35);
  }
  :global(.portfolio-root .about .body a:hover) {
    color: var(--p-accent);
    border-bottom-color: var(--p-accent);
  }

  @media (max-width: 800px) {
    .about {
      padding: 2rem 1.25rem 3rem;
    }
    .about-header {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
    .portrait {
      max-width: 260px;
    }
    .about-columns {
      grid-template-columns: 1fr;
      gap: 1.5rem;
    }
  }
</style>
