/**
 * Dynamic <title> helpers. The computed title depends on the current
 * route and, for writer pages, the active editor pane's file path.
 *
 * Portfolio:
 *   /                     → "Shigorika"
 *   /about                → "Shigorika / About"
 *   /poetry/hannah-banana → "Shigorika / Poetry / Hannah Banana"
 *
 * Writer:
 *   /writer/poetry                  → "Writing / Poetry"
 *   /writer/stories                 → "Writing / Short Stories"
 *   /writer/* (with open pane)      → "Writing / <file display name>"
 */
import { matchPortfolio, isWriterPath } from './router.svelte.js'
import { getPage } from './content.js'

function titleCase(slug) {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(' ')
}

export function computeDocTitle(path, ctx = {}) {
  if (isWriterPath(path)) return writerTitle(path, ctx)
  return portfolioTitle(path)
}

function portfolioTitle(path) {
  const m = matchPortfolio(path)
  const root = 'Shigorika'
  if (m.kind === 'home') return root
  if (m.kind === 'about') return `${root} / About`
  if (m.kind === 'contact') return `${root} / Contact`
  if (m.kind === 'published-paper') return `${root} / Published Paper`
  if (m.kind === 'category') return `${root} / ${titleCase(m.category)}`
  if (m.kind === 'piece') {
    const piece = getPage(`/${m.category}/${m.slug}`)
    const pieceTitle = piece?.title || titleCase(m.slug)
    return `${root} / ${titleCase(m.category)} / ${pieceTitle}`
  }
  return root
}

function writerTitle(path, { activeFileName } = {}) {
  const root = 'Writing'
  if (activeFileName) return `${root} / ${activeFileName}`
  if (path === '/writer/stories') return `${root} / Short Stories`
  if (path === '/writer/poetry') return `${root} / Poetry`
  return root
}
