/**
 * Portfolio content loader.
 *
 * Vite's import.meta.glob bundles every .md file under /content/portfolio/
 * at build time. In dev, editing a file triggers HMR. Values are raw markdown
 * strings (frontmatter included).
 *
 * Public API:
 *   getAllPages()                → [{ routePath, slug, category, subSlug, title, images, body }]
 *   getPage(routePath)           → one entry or null
 *   getCategoryPages(category)   → sub-items for a category, sorted by title
 *   getCategoryLanding(category) → the category landing page itself, or null
 */

// Relative glob: resolves from this file, up out of src/ and src/renderer/
// to the repo-root content/ directory.
const modules = import.meta.glob('../../../../content/portfolio/**/*.md', {
  eager: true,
  query: '?raw',
  import: 'default',
})

// ── Frontmatter parser (minimal, matches what extract-content.mjs emits) ──
// Supported:
//   key: value          (scalar)
//   key: "quoted value" (JSON-style string)
//   key:                (followed by indented list items below)
//     - "/path/one"
//     - "/path/two"
function parseFrontmatter(raw) {
  if (!raw.startsWith('---\n')) return { frontmatter: {}, body: raw }
  const end = raw.indexOf('\n---\n', 4)
  if (end === -1) return { frontmatter: {}, body: raw }

  const fmText = raw.slice(4, end)
  const body = raw.slice(end + 5)

  const data = {}
  const lines = fmText.split('\n')
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) {
      i++
      continue
    }
    const m = line.match(/^([a-zA-Z_][\w-]*):\s*(.*)$/)
    if (!m) {
      i++
      continue
    }
    const [, key, rest] = m
    if (rest === '' || rest === undefined) {
      // Indented list items follow
      const items = []
      i++
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        const itemVal = lines[i].replace(/^\s+-\s+/, '')
        items.push(unquote(itemVal))
        i++
      }
      data[key] = items
      continue
    }
    data[key] = unquote(rest)
    i++
  }
  return { frontmatter: data, body: body.replace(/^\n+/, '') }
}

function unquote(s) {
  s = s.trim()
  if (
    (s.startsWith('"') && s.endsWith('"')) ||
    (s.startsWith("'") && s.endsWith("'"))
  ) {
    try {
      return JSON.parse(s.replace(/^'|'$/g, '"'))
    } catch {
      return s.slice(1, -1)
    }
  }
  return s
}

// ── Build the page catalog ────────────────────────────────────────────────
// File paths from Vite glob:
//   /content/portfolio/index.md               → /
//   /content/portfolio/about.md               → /about
//   /content/portfolio/fashion-editorial.md   → /fashion-editorial (category landing)
//   /content/portfolio/fashion-editorial/<x>.md → /fashion-editorial/<x> (piece)
function filePathToRoute(file) {
  // Strip any leading ../ segments and the /content/portfolio/ prefix
  const p = file
    .replace(/^(?:\.\.\/)+/, '')
    .replace(/^content\/portfolio\//, '')
    .replace(/\.md$/, '')
  if (p === 'index') return '/'
  // Keep multi-dash slugs intact — they came from the extractor (e.g. "clothing---an-exercise...")
  return '/' + p
}

function toEntry(file, raw) {
  const { frontmatter, body } = parseFrontmatter(raw)
  const routePath = filePathToRoute(file)
  const withoutLeading = routePath.replace(/^\//, '')
  const parts = withoutLeading.split('/').filter(Boolean)

  // Derive category/subSlug from route shape
  let category = null
  let subSlug = null
  if (parts.length === 0) {
    // home
  } else if (parts.length === 1) {
    // Could be a top-level page (/about) OR a category landing (/poetry)
    category = parts[0]
  } else if (parts.length === 2) {
    category = parts[0]
    subSlug = parts[1]
  }

  return {
    routePath,
    slug: frontmatter.slug || withoutLeading || 'home',
    title: frontmatter.title || 'Untitled',
    lede: frontmatter.lede || '',
    hero: frontmatter.hero || '',
    order: frontmatter.order ? Number(frontmatter.order) : 999,
    images: Array.isArray(frontmatter.images) ? frontmatter.images : [],
    body,
    category,
    subSlug,
    sourcePath: frontmatter.source_path || null,
  }
}

const catalog = Object.entries(modules).map(([file, raw]) => toEntry(file, raw))
const byRoute = new Map(catalog.map((e) => [e.routePath, e]))

// ── Public API ────────────────────────────────────────────────────────────

export function getAllPages() {
  return catalog
}

export function getPage(routePath) {
  // Normalize trailing slash
  const norm = routePath !== '/' ? routePath.replace(/\/$/, '') : routePath
  return byRoute.get(norm) || null
}

export function getCategoryPages(category) {
  return catalog
    .filter((e) => e.category === category && e.subSlug)
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.title.localeCompare(b.title)
    })
}

export function getCategoryLanding(category) {
  return byRoute.get('/' + category) || null
}

// Top-level category slugs that have at least one sub-item
export function getCategoriesWithItems() {
  const cats = new Set()
  for (const e of catalog) {
    if (e.category && e.subSlug) cats.add(e.category)
  }
  return [...cats].sort()
}
