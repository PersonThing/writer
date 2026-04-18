/**
 * Minimal markdown renderer — no external dependencies.
 * Handles: bold, italic, strikethrough, inline code, links, headings (h1-h3),
 * horizontal rules, unordered lists, ordered lists, blockquotes,
 * paragraphs, and hard line breaks (trailing backslash).
 */
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
      .replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" target="_blank" rel="noopener">$1</a>',
      )
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

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

    // Blockquote
    const bqm = trimmed.match(/^>\s?(.*)/)
    if (bqm) {
      closePara(); closeUl(); closeOl()
      if (!inBlockquote) { out.push(`<blockquote data-source-line="${i}">`); inBlockquote = true }
      out.push(inline(bqm[1]) + ' ')
      continue
    }

    // Empty line
    if (!trimmed) {
      closeAll()
      continue
    }

    // Close lists/blockquote if we hit regular text
    closeUl(); closeOl(); closeBlockquote()

    // Paragraph text
    const hardBreak = trimmed.slice(-1) === '\\'
    const text = hardBreak ? trimmed.slice(0, -1).trimEnd() : trimmed
    if (!inPara) {
      out.push(`<p data-source-line="${i}">`)
      inPara = true
    }
    out.push(inline(text) + (hardBreak ? '<br>' : ' '))
  }

  closeAll()
  return out.join('\n')
}
