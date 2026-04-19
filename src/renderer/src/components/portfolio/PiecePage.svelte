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
    if (!piece) return { media: '', copy: '', rest: '' }
    const body = piece.body || ''
    if (category !== 'copywriting') return { media: '', copy: '', rest: parseMarkdown(body) }

    const briefIdx = body.search(/^##\s/m)
    const top = briefIdx === -1 ? body : body.slice(0, briefIdx)
    const rest = briefIdx === -1 ? '' : body.slice(briefIdx)

    // Lift a leading media directive (video/image) out of the copy block.
    const mediaMatch = top.match(/^(\s*(?:::: [^\n]+? :::|!\[[^\]]*\]\([^)]+\))\s*\n+)/)
    const media = mediaMatch ? mediaMatch[1] : ''
    // Trim zero-width-space / whitespace-only trailing "paragraphs" left
    // over from the Wix export so the copy block ends tight.
    const copyRaw = mediaMatch ? top.slice(mediaMatch[0].length) : top
    const copy = copyRaw.replace(/(?:^|\n)[\s\u200B\u200C\u200D\uFEFF\u00A0]+(?=\n|$)/g, '').replace(/\s+$/, '')

    return {
      media: parseMarkdown(media),
      copy: parseMarkdown(copy),
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
    {:else}
      <article class="piece" class:piece-copywriting={category === 'copywriting'}>
        <div class="breadcrumb">
          <Link href={`/${category}`}>← {categoryLabel}</Link>
        </div>

        {#if hero}
          <figure class="hero">
            <img src={asset(hero)} alt={piece.title} />
          </figure>
        {/if}

        <header class="piece-head">
          <h1>{piece.title}</h1>
          {#if piece.lede}
            <p class="lede">{piece.lede}</p>
          {/if}
        </header>

        {#if category === 'copywriting'}
          {#if split.media}
            <div class="piece-body">{@html split.media}</div>
          {/if}
          <aside class="copy-block">
            <span class="copy-eyebrow">Copy</span>
            <div class="copy-text">{@html split.copy}</div>
          </aside>
          {#if split.rest}
            <div class="piece-body">{@html split.rest}</div>
          {/if}
        {:else}
          <div class="piece-body">{@html split.rest}</div>
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

  /* Copywriting pieces: dramatize the verse that forms the actual "copy". */
  .copy-block {
    position: relative;
    margin: 2.5rem 0;
    padding: 2.5rem 2.5rem 2.5rem 3.25rem;
    background: linear-gradient(
      180deg,
      rgba(217, 182, 115, 0.04),
      rgba(217, 182, 115, 0) 70%
    );
    border-left: 2px solid var(--p-accent);
  }
  .copy-eyebrow {
    position: absolute;
    top: 1rem;
    left: 3.25rem;
    font-family: var(--p-font-body);
    font-size: 0.7rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--p-accent);
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
</style>
