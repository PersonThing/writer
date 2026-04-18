/**
 * Minimal history-API router.
 *
 * `router.pathname` is reactive ($state). Navigate in-app via `router.navigate(path)`
 * or by clicking a <Link href="..." /> (see ../components/Link.svelte).
 * Popstate (back/forward) syncs `pathname` automatically.
 *
 * `matchRoute()` is a lightweight matcher for portfolio URLs. The root App
 * consumes `pathname` and branches on it with `{#if}` / `matchRoute()`.
 */

class Router {
  pathname = $state(typeof location !== 'undefined' ? location.pathname : '/')

  constructor() {
    if (typeof window === 'undefined') return
    window.addEventListener('popstate', () => {
      this.pathname = location.pathname
    })
  }

  navigate(to) {
    if (to === location.pathname) return
    history.pushState(null, '', to)
    this.pathname = to
    window.scrollTo(0, 0)
  }

  replace(to) {
    history.replaceState(null, '', to)
    this.pathname = to
  }
}

export const router = new Router()

// Known portfolio categories. /<category>/<slug> routes require the category
// to be in this set so stray paths don't get interpreted as pieces.
export const PORTFOLIO_CATEGORIES = new Set([
  'copywriting',
  'creative-direction',
  'fashion-editorial',
  'editorial',
  'poetry',
  'published-paper', // has no sub-items but accepting here is harmless
])

/**
 * Match a portfolio path against known shapes. Returns one of:
 *   { kind: 'home' }
 *   { kind: 'about' | 'contact' | 'published-paper' }
 *   { kind: 'category', category }
 *   { kind: 'piece', category, slug }
 *   { kind: 'notfound' }
 */
export function matchPortfolio(path) {
  if (path === '/') return { kind: 'home' }
  if (path === '/about') return { kind: 'about' }
  if (path === '/contact') return { kind: 'contact' }
  if (path === '/published-paper') return { kind: 'published-paper' }

  const parts = path.replace(/^\/|\/$/g, '').split('/')
  if (parts.length === 1 && PORTFOLIO_CATEGORIES.has(parts[0])) {
    return { kind: 'category', category: parts[0] }
  }
  if (parts.length === 2 && PORTFOLIO_CATEGORIES.has(parts[0])) {
    return { kind: 'piece', category: parts[0], slug: parts[1] }
  }
  return { kind: 'notfound' }
}

export function isWriterPath(path) {
  return path === '/writer' || path.startsWith('/writer/')
}
