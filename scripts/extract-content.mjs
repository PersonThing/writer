#!/usr/bin/env node
/**
 * Convert crawled HTML into structured markdown under content/portfolio/.
 *
 * Strategy:
 *   - Each raw HTML file in scripts/crawl/raw/ has a predictable Wix DOM.
 *   - Find the main content container (`<main>`), strip chrome (nav, header,
 *     footer), then walk visible text blocks in order and emit them as
 *     paragraphs separated by blank lines.
 *   - Headings come from elements with heading semantics (`h1..h6`) or
 *     Wix's data-hook conventions.
 *   - Images pulled from the manifest (authoritative list of local filenames).
 *   - Output shape:
 *       content/portfolio/
 *         index.md                  (home)
 *         about.md
 *         contact.md
 *         published-paper.md
 *         <category>/
 *           _category.md            (landing page description + item index)
 *           <slug>.md               (individual piece)
 */
import { parse } from 'node-html-parser'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const RAW_DIR = path.join(ROOT, 'scripts/crawl/raw')
const CONTENT_DIR = path.join(ROOT, 'content/portfolio')
const MANIFEST = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts/crawl/manifest.json'), 'utf-8'),
)

// ── Slug mapping ──────────────────────────────────────────────────────────
// Manifest keys use "--" to flatten paths into filenames. Reverse that here
// when writing the output structure.
function outPathFor(slug) {
  if (slug === 'home') return 'index.md'
  if (!slug.includes('--')) return `${slug}.md`
  const [category, ...rest] = slug.split('--')
  return `${category}/${rest.join('--')}.md`
}

// ── DOM to plain-text-with-headings ───────────────────────────────────────

function isVisibleTextNode(node) {
  if (!node) return false
  if (node.nodeType === 3) return node.rawText?.trim().length > 0
  return false
}

// Walk the DOM collecting text blocks. Wix uses <h1>/<h2> for titles and
// <p> / rich-text divs for body paragraphs. We preserve order.
function extractBlocks(root) {
  const blocks = []
  const seen = new Set()

  // Remove obvious chrome
  const chromeSelectors = [
    'header',
    'footer',
    '[data-mesh-id*="HEADER"]',
    '[data-mesh-id*="FOOTER"]',
    '[id*="SITE_HEADER"]',
    '[id*="SITE_FOOTER"]',
    '[data-hook="social-links"]',
    'nav',
  ]
  for (const sel of chromeSelectors) {
    for (const el of root.querySelectorAll(sel)) el.remove()
  }

  // Collect in document order
  const walker = root.querySelectorAll('h1, h2, h3, h4, p, li')
  for (const el of walker) {
    const raw = el.structuredText?.trim() || el.innerText?.trim() || ''
    if (!raw) continue
    if (seen.has(raw)) continue
    seen.add(raw)
    const tag = el.rawTagName?.toLowerCase()
    blocks.push({ tag, text: raw })
  }

  return blocks
}

// Collapse repeated Wix nav + footer content by finding lines that appear
// across multiple pages — those are chrome.
function buildChromePhraseFilter(allBlocks) {
  const counts = new Map()
  for (const blocks of Object.values(allBlocks)) {
    const uniq = new Set(blocks.map((b) => b.text))
    for (const t of uniq) counts.set(t, (counts.get(t) || 0) + 1)
  }
  const totalPages = Object.keys(allBlocks).length
  // If a line shows up on ≥60% of pages, it's chrome (nav "Work", "About", etc.)
  const threshold = Math.ceil(totalPages * 0.6)
  const chrome = new Set()
  for (const [t, n] of counts) {
    if (n >= threshold) chrome.add(t)
  }
  return chrome
}

// ── Markdown emitters ─────────────────────────────────────────────────────

function toMarkdown(blocks) {
  const lines = []
  for (const { tag, text } of blocks) {
    if (tag === 'h1') lines.push(`# ${text}`, '')
    else if (tag === 'h2') lines.push(`## ${text}`, '')
    else if (tag === 'h3') lines.push(`### ${text}`, '')
    else if (tag === 'h4') lines.push(`#### ${text}`, '')
    else if (tag === 'li') lines.push(`- ${text}`)
    else lines.push(text, '')
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function yamlEscape(v) {
  if (v == null) return '""'
  if (Array.isArray(v)) {
    if (v.length === 0) return '[]'
    return '\n' + v.map((x) => `  - ${JSON.stringify(String(x))}`).join('\n')
  }
  const s = String(v)
  if (/^[a-zA-Z0-9_\-./ ]+$/.test(s) && !s.startsWith(' ') && !s.endsWith(' ')) return s
  return JSON.stringify(s)
}

function frontmatter(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return ''
  const body = entries.map(([k, v]) => `${k}: ${yamlEscape(v)}`).join('\n')
  return `---\n${body}\n---\n\n`
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const files = readdirSync(RAW_DIR).filter((f) => f.endsWith('.html'))
  const allBlocks = {}

  for (const file of files) {
    const slug = file.replace(/\.html$/, '')
    if (!MANIFEST[slug] || MANIFEST[slug].status !== 200) continue

    const html = await readFile(path.join(RAW_DIR, file), 'utf-8')
    const root = parse(html)
    root.querySelectorAll('script, style, noscript').forEach((n) => n.remove())
    const main = root.querySelector('main') || root.querySelector('#SITE_CONTAINER') || root
    allBlocks[slug] = extractBlocks(main)
  }

  // Build chrome filter from cross-page repetition
  const chromeFilter = buildChromePhraseFilter(allBlocks)

  // Build chrome-image filter the same way. Images that show up on many
  // pages are site chrome (icons, social buttons, etc.), not page content.
  const imgCounts = new Map()
  for (const slug of Object.keys(allBlocks)) {
    const pageImgs = MANIFEST[slug]?.images || []
    for (const img of new Set(pageImgs)) {
      imgCounts.set(img, (imgCounts.get(img) || 0) + 1)
    }
  }
  const imgThreshold = Math.ceil(Object.keys(allBlocks).length * 0.25)
  const chromeImages = new Set()
  for (const [img, n] of imgCounts) {
    if (n >= imgThreshold) chromeImages.add(img)
  }

  // Additional hardcoded chrome/boilerplate strings that look like Wix noise
  const manualChrome = new Set([
    'top of page',
    'Skip to Main Content',
    'Shigorika',
    'Work',
    'Copywriting',
    'Creative Direction',
    'Fashion Editorial',
    'Editorial',
    'Poetry',
    'Published Paper',
    'Recommendations',
    'About',
    'Contact',
    'bottom of page',
    'View More',
    'More about my journey',
  ])

  for (const slug of Object.keys(allBlocks)) {
    const blocks = allBlocks[slug].filter(
      (b) => !chromeFilter.has(b.text) && !manualChrome.has(b.text),
    )

    const pageInfo = MANIFEST[slug]
    const images = (pageInfo.images || [])
      .filter((fname) => !chromeImages.has(fname))
      .map((fname) => `/portfolio/images/${fname}`)

    // Derive title: first h1/h2, or humanized slug. Home is fixed.
    let title
    if (slug === 'home') {
      title = 'Shigorika'
    } else {
      const heading = blocks.find((b) => b.tag === 'h1' || b.tag === 'h2')
      title =
        heading?.text ||
        slug.split('--').pop().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    }

    const body = toMarkdown(blocks)

    const fm = frontmatter({
      title,
      slug,
      source_path: pageInfo.path,
      images,
    })

    // Write to content/portfolio/<outPath>
    const outRel = outPathFor(slug)
    const outAbs = path.join(CONTENT_DIR, outRel)
    await mkdir(path.dirname(outAbs), { recursive: true })
    await writeFile(outAbs, fm + body, 'utf-8')
    console.log(`wrote ${outRel}`)
  }

  console.log(`\n── ${Object.keys(allBlocks).length} pages written to ${CONTENT_DIR}`)
}

await main()
