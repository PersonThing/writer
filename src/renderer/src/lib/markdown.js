/**
 * Minimal markdown renderer — no external dependencies.
 * Handles: bold, italic, inline code, links, headings (h1-h3),
 * horizontal rules, paragraphs, and hard line breaks (trailing backslash).
 */
export function parseMarkdown(md) {
  if (!md) return '';

  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  const lines = escaped.split('\n');
  const out = [];
  let inPara = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      if (inPara) { out.push('</p>'); inPara = false; }
      out.push('<hr>');
      continue;
    }

    const hm = trimmed.match(/^(#{1,3})\s+(.+)/);
    if (hm) {
      if (inPara) { out.push('</p>'); inPara = false; }
      const lvl = hm[1].length;
      out.push(`<h${lvl}>${hm[2]}</h${lvl}>`);
      continue;
    }

    if (!trimmed) {
      if (inPara) { out.push('</p>'); inPara = false; }
      continue;
    }

    const hardBreak = trimmed.slice(-1) === '\\';
    const text = hardBreak ? trimmed.slice(0, -1).trimEnd() : trimmed;
    if (!inPara) { out.push('<p>'); inPara = true; }
    out.push(text + (hardBreak ? '<br>' : ' '));
  }

  if (inPara) out.push('</p>');
  return out.join('\n');
}
