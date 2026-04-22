/**
 * remark plugin for writer's inline color tokens.
 *
 * Parse only: scans mdast text nodes for `[red]foo[/red]` and
 * `[bg-red]foo[/bg-red]` (plus green/blue/yellow) and replaces them
 * with custom mdast nodes (`colorSpan` / `bgColorSpan`) carrying a
 * `color` attr. Milkdown's transformer maps these nodes to ProseMirror
 * marks (see color-mark.js), which own the to-markdown path.
 */

const COLORS = ['red', 'green', 'blue', 'yellow']

const TOKEN_RE = new RegExp(
  `\\[(bg-)?(${COLORS.join('|')})\\]([\\s\\S]*?)\\[/\\1?\\2\\]`,
  'g',
)

export function remarkColor() {
  return (tree) => visit(tree)
}

function visit(node) {
  if (!node || typeof node !== 'object') return
  if (!Array.isArray(node.children)) return
  const next = []
  for (const child of node.children) {
    if (child.type === 'text' && typeof child.value === 'string') {
      TOKEN_RE.lastIndex = 0
      if (TOKEN_RE.test(child.value)) {
        next.push(...splitText(child.value))
        continue
      }
    }
    visit(child)
    next.push(child)
  }
  node.children = next
}

function splitText(value) {
  const out = []
  let last = 0
  TOKEN_RE.lastIndex = 0
  let m
  while ((m = TOKEN_RE.exec(value)) !== null) {
    if (m.index > last) out.push({ type: 'text', value: value.slice(last, m.index) })
    const isBg = !!m[1]
    const color = m[2]
    const inner = m[3]
    out.push({
      type: isBg ? 'bgColorSpan' : 'colorSpan',
      color,
      children: [{ type: 'text', value: inner }],
    })
    last = m.index + m[0].length
  }
  if (last < value.length) out.push({ type: 'text', value: value.slice(last) })
  return out
}

export const COLOR_NAMES = COLORS
