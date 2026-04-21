/**
 * Minimal markdown renderer — no external dependencies.
 * Handles: bold, italic, strikethrough, inline code, links, headings (h1-h3),
 * horizontal rules, unordered lists, ordered lists, blockquotes,
 * paragraphs, hard line breaks (trailing backslash), and three block-level
 * media tokens used by portfolio pieces:
 *   ![alt](/path/to.jpg)              → <figure><img ...></figure>
 *   ::: video /path.mp4 poster=/p.jpg → <video controls ...>
 *   ::: audio /path.m4a               → <audio controls ...>
 */

import { asset } from './asset.js'

function escAttr(s) {
  return String(s).replace(/"/g, '&quot;')
}

function renderStandaloneImage(alt, src) {
  return `<figure class="md-figure"><img src="${escAttr(asset(src))}" alt="${escAttr(alt)}" loading="lazy"></figure>`
}

function parseDirective(line) {
  // ::: kind arg1 key=val key=val :::
  const m = line.match(/^::: (video|audio)\s+(\S+)\s*(.*?)\s*:::$/)
  if (!m) return null
  const [, kind, src, restRaw] = m
  const rest = {}
  for (const pair of restRaw.split(/\s+/).filter(Boolean)) {
    const eq = pair.indexOf('=')
    if (eq === -1) continue
    rest[pair.slice(0, eq)] = pair.slice(eq + 1)
  }
  return { kind, src, ...rest }
}

function renderVideo({ src, poster }) {
  const posterAttr = poster ? ` poster="${escAttr(asset(poster))}"` : ''
  return `<video class="md-video" controls playsinline preload="metadata" src="${escAttr(asset(src))}"${posterAttr}></video>`
}

function renderAudio({ src }) {
  return `<audio class="md-audio" controls preload="metadata" src="${escAttr(asset(src))}"></audio>`
}

export function parseMarkdown(md) {
  if (!md) return ''

  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const lines = escaped.split('\n')
  const out = []
  let inPara = false
  let inUl = false
  let inOl = false
  let inBlockquote = false

  function closePara() {
    if (inPara) { out.push('</p>'); inPara = false }
  }
  function closeUl() {
    if (inUl) { out.push('</ul>'); inUl = false }
  }
  function closeOl() {
    if (inOl) { out.push('</ol>'); inOl = false }
  }
  function closeBlockquote() {
    if (inBlockquote) { out.push('</blockquote>'); inBlockquote = false }
  }
  function closeAll() { closePara(); closeUl(); closeOl(); closeBlockquote() }

  function inline(text) {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/__(.+?)__/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/_(.+?)_/g, '<em>$1</em>')
      .replace(/~~(.+?)~~/g, '<del>$1</del>')
      .replace(/`(.+?)`/g, '<code>$1</code>')
      // Preset color spans: [red]text[/red], [green]…[/green], etc.
      // Deliberately restricted to a known palette so authors can't
      // inject arbitrary styles or tag attributes.
      .replace(
        /\[(red|green|blue|yellow)\]([\s\S]+?)\[\/\1\]/g,
        '<span class="md-color md-color-$1">$2</span>',
      )
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>',
      )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // ::: video / ::: audio directive (block-level)
    if (trimmed.startsWith('::: ')) {
      const dir = parseDirective(trimmed)
      if (dir) {
        closeAll()
        if (dir.kind === 'video') out.push(renderVideo(dir))
        else if (dir.kind === 'audio') out.push(renderAudio(dir))
        continue
      }
    }

    // Standalone image line: ![alt](src) on its own
    const imgM = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/)
    if (imgM) {
      closeAll()
      out.push(renderStandaloneImage(imgM[1], imgM[2]))
      continue
    }

    // Horizontal rule
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      closeAll()
      out.push(`<hr data-source-line="${i}">`)
      continue
    }

    // Heading
    const hm = trimmed.match(/^(#{1,3})\s+(.+)/)
    if (hm) {
      closeAll()
      const lvl = hm[1].length
      out.push(`<h${lvl} data-source-line="${i}">${inline(hm[2])}</h${lvl}>`)
      continue
    }

    // Unordered list item (- or *)
    const ulm = trimmed.match(/^[-*]\s+(.+)/)
    if (ulm) {
      closePara(); closeOl(); closeBlockquote()
      if (!inUl) { out.push(`<ul data-source-line="${i}">`); inUl = true }
      out.push(`<li>${inline(ulm[1])}</li>`)
      continue
    }

    // Ordered list item (1. 2. etc)
    const olm = trimmed.match(/^\d+\.\s+(.+)/)
    if (olm) {
      closePara(); closeUl(); closeBlockquote()
      if (!inOl) { out.push(`<ol data-source-line="${i}">`); inOl = true }
      out.push(`<li>${inline(olm[1])}</li>`)
      continue
    }

    // Blockquote. Input has already been HTML-escaped, so a literal
    // leading `>` from the source arrives here as `&gt;`.
    const bqm = trimmed.match(/^(?:>|&gt;)\s?(.*)/)
    if (bqm) {
      closePara(); closeUl(); closeOl()
      if (!inBlockquote) { out.push(`<blockquote data-source-line="${i}">`); inBlockquote = true }
      // Render an empty line inside a blockquote as a paragraph break
      // so author-crafted byline rows (`> quote` / `>` / `> — Name`) keep
      // their vertical spacing.
      const content = bqm[1]
      if (content.trim() === '') {
        out.push('<br><br>')
      } else {
        out.push(inline(content) + ' ')
      }
      continue
    }

    // Empty line
    if (!trimmed) {
      closeAll()
      continue
    }

    // Close lists/blockquote if we hit regular text
    closeUl(); closeOl(); closeBlockquote()

    // Paragraph text. A lone newline between two content lines becomes a
    // <br> so poetry can be authored one line per line with stanzas
    // separated by blank lines. Trailing `\` on a line is still honoured
    // as an explicit hard break.
    const hardBreak = trimmed.slice(-1) === '\\'
    const text = hardBreak ? trimmed.slice(0, -1).trimEnd() : trimmed
    const wasInPara = inPara
    if (!inPara) {
      out.push(`<p data-source-line="${i}">`)
      inPara = true
    }
    if (wasInPara) out.push('<br>')
    out.push(inline(text))
    if (hardBreak) out.push('<br>')
  }

  closeAll()
  return out.join('\n')
}
