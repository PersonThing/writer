/**
 * Prefix app-absolute asset paths with the GH Pages repo subpath.
 *
 * On personthing.github.io/shigorika/, static files in public/portfolio/
 * are served at /shigorika/portfolio/... — but our source references them
 * as /portfolio/.... This helper rewrites those references at render
 * time. On the custom domain (or any other host) it's a no-op.
 *
 * Kept separate from router.svelte.js so plain .js modules like
 * markdown.js don't have to import Svelte runes.
 */

export const ASSET_PREFIX =
  typeof location !== 'undefined' && location.hostname === 'personthing.github.io'
    ? '/shigorika'
    : ''

export function asset(path) {
  if (!path) return path
  if (!ASSET_PREFIX) return path
  if (path.startsWith('/') && !path.startsWith('//')) return ASSET_PREFIX + path
  return path
}
