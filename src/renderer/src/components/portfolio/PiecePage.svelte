<script>
  import Layout from './Layout.svelte'
  import Link from '../Link.svelte'
  import { parseMarkdown } from '../../lib/markdown.js'
  import { getPage } from '../../lib/content.js'
  import { asset } from '../../lib/asset.js'
  import { parseCreativeDirection } from '../../lib/cd-parse.js'
  import CdPiece from './CdPiece.svelte'

  let { category, slug } = $props()

  const piece = $derived(getPage(`/${category}/${slug}`))
  const hero = $derived(piece?.hero || null)
  const categoryLabel = $derived(
    category
      .split('-')
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' '),
  )

  // Creative-direction pieces have a distinct layout (brief notes +
  // asymmetric image column). Parse once and render via CdPiece.
  const cdParsed = $derived(
    category === 'creative-direction' && piece
      ? parseCreativeDirection(piece.body || '')
      : null,
  )

  // Copywriting pieces have a distinct shape: media + verse (the "copy")
  // first, then a `## Brief` section. Split them so the verse can be
  // typeset as a pull-quote while the brief renders as normal prose.
  // Also pull any leading `::: video :::` / `![]()` block out of the copy
  // so the media sits full-width above, not inside the quoted copy.
  const split = $derived.by(() => {
    if (!piece) return { media: '', copy: '', credit: '', rest: '' }
    const body = piece.body || ''
    if (category !== 'copywriting') return { media: '', copy: '', credit: '', rest: parseMarkdown(body) }

    const briefIdx = body.search(/^##\s/m)
    const top = briefIdx === -1 ? body : body.slice(0, briefIdx)
    const rest = briefIdx === -1 ? '' : body.slice(briefIdx)

    // Lift a leading media directive (video/image) out of the copy block.
    const mediaMatch = top.match(/^(\s*(?:::: [^\n]+? :::|!\[[^\]]*\]\([^)]+\))\s*\n+)/)
    const media = mediaMatch ? mediaMatch[1] : ''
    // Trim zero-width-space / whitespace-only trailing "paragraphs" left
    // over from the Wix export so the copy block ends tight.
    const copyRaw = mediaMatch ? top.slice(mediaMatch[0].length) : top
    let copy = copyRaw.replace(/(?:^|\n)[\s\u200B\u200C\u200D\uFEFF\u00A0]+(?=\n|$)/g, '').replace(/\s+$/, '')

    // Peel off a trailing attribution paragraph (e.g. `Excerpted from …`,
    // `Featured in …`) so it renders as a credit line rather than verse.
    let credit = ''
    const creditMatch = copy.match(/\n\n(?<line>(?:Excerpted|Featured|From|Adapted|Originally)\b[^\n]*)\s*$/i)
    if (creditMatch) {
      credit = creditMatch.groups.line.trim()
      copy = copy.slice(0, creditMatch.index).replace(/\s+$/, '')
    }

    return {
      media: parseMarkdown(media),
      copy: parseMarkdown(copy),
      credit,
      rest: parseMarkdown(rest),
    }
  })
</script>

<Layout>
  {#if piece}
    {#if category === 'creative-direction' && cdParsed}
      <div class="cd-shell-head">
        <div class="breadcrumb">
          <Link href={`/${category}`}>← {categoryLabel}</Link>
        </div>
      </div>
      <CdPiece
        notes={cdParsed.notes}
        images={cdParsed.images}
        title={piece.title}
        {categoryLabel}
      />
    {:else if category === 'copywriting'}
      <div class="cw-shell">
        <div class="cw-shell-head">
          <div class="breadcrumb">
            <Link href={`/${category}`}>← {categoryLabel}</Link>
          </div>
        </div>
        <article class="cw-split">
          <div class="cw-split-stage">
            {#if split.media}
              <div class="cw-split-media">{@html split.media}</div>
            {/if}
            <div class="cw-split-right">
              <div class="cw-split-text">
                <span class="cw-split-eyebrow">{categoryLabel}</span>
                <h1>{piece.title}</h1>
                {#if piece.lede}<p class="lede">{piece.lede}</p>{/if}
                <div class="copy-text">{@html split.copy}</div>
                {#if split.credit}
                  <p class="copy-credit">{split.credit}</p>
                {/if}
                {#if split.rest}
                  <div class="cw-split-brief">
                    <div class="piece-body">{@html split.rest}</div>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </article>
      </div>
    {:else}
      <article class="piece">
        <div class="breadcrumb">
          <Link href={`/${category}`}>← {categoryLabel}</Link>
        </div>
        {#if hero}
          <figure class="hero"><img src={asset(hero)} alt={piece.title} /></figure>
        {/if}
        <header class="piece-head">
          <h1>{piece.title}</h1>
          {#if piece.lede}<p class="lede">{piece.lede}</p>{/if}
        </header>
        <div class="piece-body">{@html split.rest}</div>
        {#if piece.publishedIn || piece.publishedAt}
          <footer class="piece-pub">
            Published
            {#if piece.publishedIn}in <span class="piece-pub-venue">{piece.publishedIn}</span>{/if}
            {#if piece.publishedAt}
              {#if piece.publishedIn} · {/if}{piece.publishedAt}
            {/if}
          </footer>
        {/if}
      </article>
    {/if}
  {:else}
    <div class="empty"><p>Piece not found.</p></div>
  {/if}
</Layout>

<style>
  .piece {
    max-width: 46rem;
    margin: 0 auto;
    padding: 2rem 2rem 4rem;
  }
  .breadcrumb {
    font-size: 0.85rem;
    color: var(--p-muted);
    margin-bottom: 2rem;
  }
  :global(.portfolio-root .breadcrumb a:hover) {
    color: var(--p-accent);
  }

  .hero {
    margin: 0 0 2rem;
  }
  .hero img {
    width: 100%;
    height: auto;
    display: block;
  }
  .piece-head {
    margin: 0 0 2rem;
  }
  .piece-head h1 {
    font-size: 2.1rem;
    font-weight: 400;
    margin: 0 0 0.75rem;
    line-height: 1.25;
  }
  .lede {
    font-size: 1.1rem;
    color: var(--p-muted);
    font-style: italic;
    margin: 0;
  }
  .piece-pub {
    margin-top: 3rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--p-border);
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--p-muted);
  }
  .piece-pub-venue {
    color: var(--p-accent);
  }

  :global(.portfolio-root .piece-body .md-figure) {
    margin: 1.5rem 0;
  }
  :global(.portfolio-root .piece-body .md-figure img) {
    width: 100%;
    height: auto;
    display: block;
  }
  :global(.portfolio-root .piece-body .md-video) {
    width: 100%;
    aspect-ratio: 16 / 9;
    background: #000;
    display: block;
    margin: 1.5rem 0;
  }
  :global(.portfolio-root .piece-body .md-audio) {
    width: 100%;
    display: block;
    margin: 1.5rem 0;
    /* Tell browser native controls to render in dark mode — Chrome/Safari
       use this to draw light buttons over a transparent background. */
    color-scheme: dark;
    background: transparent;
  }
  /* In Chromium, override the default filled background so our page
     shows through the control. */
  :global(.portfolio-root .piece-body .md-audio::-webkit-media-controls-enclosure) {
    background: transparent;
    border-radius: 0;
  }
  :global(.portfolio-root .piece-body .md-audio::-webkit-media-controls-panel) {
    background: transparent;
  }

  :global(.portfolio-root .piece-body h1) {
    font-size: 2.1rem;
    font-weight: 400;
    margin: 0 0 0.75rem;
    line-height: 1.25;
  }
  :global(.portfolio-root .piece-body h2) {
    font-size: 1.2rem;
    font-weight: 400;
    color: var(--p-muted);
    margin: 1.8rem 0 0.6rem;
  }
  :global(.portfolio-root .piece-body h3) {
    font-size: 1.05rem;
    font-weight: 400;
    margin: 1.5rem 0 0.5rem;
  }
  :global(.portfolio-root .piece-body p) {
    margin: 0 0 1.1rem;
    font-size: 1rem;
    line-height: 1.75;
  }
  :global(.portfolio-root .piece-body ul),
  :global(.portfolio-root .piece-body ol) {
    margin: 0 0 1.1rem;
    padding-left: 1.5rem;
  }
  :global(.portfolio-root .piece-body li) {
    margin-bottom: 0.3rem;
  }
  :global(.portfolio-root .piece-body a) {
    color: var(--p-accent);
    border-bottom: 1px solid rgba(217, 182, 115, 0.4);
  }
  :global(.portfolio-root .piece-body blockquote) {
    border-left: 2px solid var(--p-accent);
    margin: 1.2rem 0;
    padding-left: 1rem;
    color: var(--p-muted);
    font-style: italic;
  }
  :global(.portfolio-root .piece-body em) {
    font-style: italic;
  }
  :global(.portfolio-root .piece-body strong) {
    font-weight: 500;
  }
  :global(.portfolio-root .piece-body code) {
    background: #1a1a1a;
    padding: 0.1rem 0.3rem;
    border-radius: 2px;
    font-size: 0.92em;
  }

  .copy-text {
    margin-top: 0.75rem;
  }
  :global(.portfolio-root .copy-text p) {
    font-family: var(--p-font-display);
    font-size: 1.6rem;
    line-height: 1.35;
    letter-spacing: -0.02em;
    margin: 0 0 0.6rem;
    color: var(--p-text);
  }
  :global(.portfolio-root .copy-text p:last-child) {
    margin-bottom: 0;
  }
  /* Wix paragraphs with a stray zero-width joiner render as empty p's —
     preserve the spacing but keep them invisible. */
  :global(.portfolio-root .copy-text p:empty) {
    min-height: 0.6rem;
  }
  .copy-credit {
    margin: -1.25rem 0 2.5rem 0;
    font-size: 0.85rem;
    color: var(--p-muted);
    font-style: italic;
    letter-spacing: 0.01em;
  }

  /* Creative-direction shell: breadcrumb bar above the piece body. */
  .cd-shell-head {
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 2rem var(--p-content-padding) 0.5rem;
  }
  .cd-shell-head .breadcrumb {
    margin: 0;
    font-size: 0.85rem;
    color: var(--p-muted);
  }

  .empty {
    text-align: center;
    padding: 5rem 2rem;
    color: var(--p-muted);
  }

  @media (max-width: 600px) {
    .piece {
      padding: 1.5rem 1.25rem 3rem;
    }
    :global(.portfolio-root .piece-body h1) {
      font-size: 1.75rem;
    }
  }

  /* Copywriting variation shell: shared toggle bar + per-variant shells. */
  .cw-shell {
    color: var(--p-text);
  }
  .cw-shell-head {
    max-width: var(--p-content-max, 72rem);
    margin: 0 auto;
    padding: 1.5rem var(--p-content-padding, 2rem) 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }
  .cw-shell-head .breadcrumb {
    margin: 0;
    font-size: 0.85rem;
    color: var(--p-muted);
  }
  /* Copywriting piece: 50/50 viewport split with a full-height vertical video. */
  .cw-split {
    margin: 0;
    padding: 0;
  }
  .cw-split-stage {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    height: calc(100vh - 140px);
    max-width: var(--p-content-max);
    margin: 0 auto;
    padding: 0 var(--p-content-padding);
  }
  .cw-split-media {
    position: relative;
    background: #000;
    overflow: hidden;
    height: 100%;
    display: flex;
    align-items: stretch;
  }
  :global(.cw-split-media .md-video) {
    height: 100%;
    width: auto;
    aspect-ratio: 9 / 16;
    margin: 0;
    object-fit: cover;
    display: block;
  }
  .cw-split-right {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding: 4rem 3rem;
    height: 100%;
    overflow-y: auto;
    position: relative;
  }
  .cw-split-right::before {
    content: '';
    position: absolute;
    top: 2rem;
    bottom: 2rem;
    left: 0;
    width: 1px;
    background: linear-gradient(
      180deg,
      transparent,
      rgba(217, 182, 115, 0.35),
      transparent
    );
  }
  .cw-split-text {
    width: 100%;
    max-width: 44rem;
  }
  .cw-split-eyebrow {
    display: block;
    font-size: 0.7rem;
    letter-spacing: 0.3em;
    text-transform: uppercase;
    color: var(--p-accent);
    margin-bottom: 1rem;
  }
  .cw-split-text h1 {
    font-family: var(--p-font-display);
    font-size: clamp(2rem, 3.5vw, 3rem);
    font-weight: 400;
    line-height: 1.05;
    letter-spacing: -0.02em;
    margin: 0 0 2.5rem;
  }
  .cw-split-text .lede {
    font-size: 1rem;
    color: var(--p-muted);
    font-style: italic;
    margin: -1.75rem 0 2.5rem;
  }
  :global(.cw-split-text .copy-text p) {
    font-family: var(--p-font-display);
    font-size: clamp(1.05rem, 1.35vw, 1.4rem);
    line-height: 1.4;
    letter-spacing: -0.01em;
    margin: 0 0 0.7rem;
  }
  /* Reset the global copy-credit negative top margin — split lays the
     credit directly under the last copy line, no overlap. */
  :global(.cw-split-text .copy-credit) {
    margin: 1.5rem 0 0;
    font-size: 1rem;
  }
  .cw-split-brief {
    margin-top: 3rem;
    padding-top: 2rem;
    border-top: 1px solid rgba(217, 182, 115, 0.2);
    color: var(--p-muted);
  }
  :global(.cw-split-brief .piece-body h2) {
    font-size: 0.75rem;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--p-accent);
    margin: 0 0 0.9rem;
  }
  :global(.cw-split-brief .piece-body p) {
    font-size: 1.05rem;
    line-height: 1.65;
    margin: 0 0 1rem;
  }
  @media (max-width: 760px) {
    .cw-split-stage {
      grid-template-columns: 1fr;
      height: auto;
    }
    .cw-split-media {
      height: auto;
      justify-content: center;
    }
    :global(.cw-split-media .md-video) {
      width: 100%;
      height: auto;
      max-height: 80vh;
    }
    .cw-split-right {
      height: auto;
      overflow: visible;
    }
    .cw-split-right::before { display: none; }
  }

</style>
