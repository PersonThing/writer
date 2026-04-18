#!/usr/bin/env node
/**
 * Crawl shigorika.com using headless Chromium (Playwright).
 *
 * Steps:
 *   1. Visit each nav page (home, about, contact, recommendations, each /work/*).
 *   2. Wait for the Wix JS to finish hydrating, then dump:
 *        - full post-JS HTML into scripts/crawl/raw/<slug>.html
 *        - every <a> href — used to discover sub-item URLs
 *        - every image src (including lazy-loaded) — used to download originals
 *   3. BFS-discover every /copywriting/<slug>, /creative-direction/<slug>,
 *      /fashion-editorial/<slug>, /editorial/<slug>, /poetry/<slug>,
 *      /published-paper/<slug> link found, and crawl each.
 *   4. Strip Wix's CDN transform suffix (...~mv2.<ext>/v1/...) to recover the
 *      full-res original, download each unique image exactly once.
 *   5. Write a manifest.json mapping page slug → {url, images, subItems}.
 *
 * Idempotent: re-runs skip already-downloaded images (by filename).
 */
import { chromium } from 'playwright'
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const RAW_DIR = path.join(ROOT, 'scripts/crawl/raw')
const IMG_DIR = path.join(ROOT, 'src/renderer/public/portfolio/images')
const MANIFEST = path.join(ROOT, 'scripts/crawl/manifest.json')
const BASE = 'https://www.shigorika.com'

const SEED_PATHS = [
  '/',
  '/about',
  '/contact',
  '/recommendations',
  '/copywriting',
  '/creative-direction',
  '/fashion-editorial',
  '/editorial',
  '/poetry',
  '/published-paper',
]

// Sub-item URL patterns we follow into (each category page lists pieces).
const SUBITEM_PREFIXES = [
  '/copywriting/',
  '/creative-direction/',
  '/fashion-editorial/',
  '/editorial/',
  '/poetry/',
  '/published-paper/',
]

function toSlug(pagePath) {
  if (pagePath === '/') return 'home'
  return pagePath.replace(/^\//, '').replace(/\//g, '--').replace(/[^a-z0-9._-]/gi, '-')
}

// Strip Wix CDN transform to recover the original URL.
// Before: https://static.wixstatic.com/media/<id>~mv2.<ext>/v1/fill/...
// After:  https://static.wixstatic.com/media/<id>~mv2.<ext>
function stripWixTransform(url) {
  return url.replace(/(~mv2\.[a-zA-Z0-9]+)\/v1\/.*$/, '$1')
}

function wixFilename(url) {
  // Keep the whole path after /media/, swap / for _
  const m = url.match(/\/media\/([^?]+)$/)
  if (!m) return null
  return m[1].replace(/\//g, '_')
}

async function downloadImage(url, destPath) {
  if (existsSync(destPath)) return { skipped: true }
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  await pipeline(res.body, createWriteStream(destPath))
  return { skipped: false }
}

async function crawlPage(browser, pagePath) {
  const slug = toSlug(pagePath)
  const url = BASE + pagePath
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0' })
  const page = await ctx.newPage()

  try {
    // Use domcontentloaded rather than networkidle — Wix sites have
    // long-running analytics pings that prevent the network from ever idling.
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    if (!response.ok() && response.status() !== 304) {
      await ctx.close()
      return { slug, url, status: response.status(), html: null, links: [], images: [] }
    }

    // Give Wix a few seconds to hydrate and start loading images
    await page.waitForTimeout(2000)

    // Scroll to bottom to force lazy-loaded images to start loading
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let y = 0
        const step = () => {
          window.scrollTo(0, y)
          y += 400
          if (y > document.body.scrollHeight + 1000) return resolve()
          setTimeout(step, 80)
        }
        step()
      })
    })
    // Fixed settle time rather than networkidle (see above)
    await page.waitForTimeout(3000)

    const html = await page.content()

    // Extract links + images from the rendered DOM
    const { links, images } = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.href)
        .filter(Boolean)
      const images = []
      for (const img of document.querySelectorAll('img')) {
        for (const attr of ['src', 'data-src', 'data-image', 'srcset', 'data-srcset']) {
          const val = img.getAttribute(attr)
          if (!val) continue
          // srcset is comma-separated; take each URL
          val.split(',').forEach((s) => {
            const u = s.trim().split(/\s+/)[0]
            if (u) images.push(u)
          })
        }
      }
      // Also pick up background-image CSS on all elements
      for (const el of document.querySelectorAll('[style*="background"]')) {
        const m = el.getAttribute('style')?.match(/url\(["']?([^)"']+)["']?\)/g) || []
        m.forEach((s) => {
          const u = s.replace(/^url\(["']?/, '').replace(/["']?\)$/, '')
          images.push(u)
        })
      }
      return { links, images }
    })

    await ctx.close()
    return { slug, url, status: 200, html, links, images }
  } catch (e) {
    await ctx.close()
    return { slug, url, status: 0, error: e.message, html: null, links: [], images: [] }
  }
}

function isOnSite(href) {
  try {
    const u = new URL(href, BASE)
    return u.origin === BASE
  } catch {
    return false
  }
}

function pathOf(href) {
  try {
    const u = new URL(href, BASE)
    return decodeURIComponent(u.pathname)
  } catch {
    return null
  }
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true })
  await mkdir(IMG_DIR, { recursive: true })

  const browser = await chromium.launch()
  const visited = new Set()
  const queue = [...SEED_PATHS]
  const manifest = {}
  const imageResults = new Map() // origUrl -> filename

  // Load existing manifest so we don't re-crawl already-OK pages. If an entry
  // had status 200 before, trust it. Failed entries get re-tried.
  // Also: any sub-items discovered on a previously-good page but not yet
  // crawled themselves get added to the queue.
  if (existsSync(MANIFEST)) {
    const { readFileSync } = await import('node:fs')
    const prev = JSON.parse(readFileSync(MANIFEST, 'utf-8'))
    for (const [slug, data] of Object.entries(prev)) {
      if (data.status === 200) {
        manifest[slug] = data
        visited.add(data.path)
      }
    }
    // Queue any referenced sub-items we haven't visited
    const referenced = new Set()
    for (const data of Object.values(prev)) {
      for (const s of data.subItems || []) referenced.add(s)
    }
    for (const p of referenced) {
      if (!visited.has(p) && !queue.includes(p)) queue.push(p)
    }
    console.log(`Resuming: ${Object.keys(manifest).length} pages already done, ${queue.length} in queue`)
  }

  while (queue.length) {
    const p = queue.shift()
    if (visited.has(p)) continue
    visited.add(p)

    console.log(`── ${p}`)
    const result = await crawlPage(browser, p)
    if (result.status !== 200 || !result.html) {
      console.log(`   status=${result.status} ${result.error || ''}`)
      manifest[result.slug] = { path: p, status: result.status, error: result.error || null }
      continue
    }

    // Write raw HTML
    await writeFile(path.join(RAW_DIR, `${result.slug}.html`), result.html, 'utf-8')

    // Enqueue any sub-item links we haven't seen
    const newSubItems = []
    for (const href of result.links) {
      if (!isOnSite(href)) continue
      const linkPath = pathOf(href)
      if (!linkPath) continue
      if (visited.has(linkPath) || queue.includes(linkPath)) continue
      if (SUBITEM_PREFIXES.some((prefix) => linkPath.startsWith(prefix) && linkPath !== prefix.slice(0, -1))) {
        queue.push(linkPath)
        newSubItems.push(linkPath)
      }
    }
    if (newSubItems.length) console.log(`   +${newSubItems.length} sub-items`)

    // Collect unique wix images (strip transforms → originals)
    const pageImages = []
    const seenOnPage = new Set()
    for (const u of result.images) {
      if (!u.includes('wixstatic.com/media/')) continue
      const orig = stripWixTransform(u.startsWith('//') ? 'https:' + u : u)
      if (seenOnPage.has(orig)) continue
      seenOnPage.add(orig)
      const fname = wixFilename(orig)
      if (!fname) continue
      pageImages.push(fname)

      if (!imageResults.has(orig)) {
        try {
          const { skipped } = await downloadImage(orig, path.join(IMG_DIR, fname))
          imageResults.set(orig, fname)
          if (!skipped) process.stdout.write(`   ↓ ${fname}\n`)
        } catch (e) {
          console.log(`   ✗ ${fname} — ${e.message}`)
          imageResults.set(orig, null)
        }
      }
    }

    manifest[result.slug] = {
      path: p,
      status: 200,
      images: pageImages,
      subItems: newSubItems,
    }
  }

  await browser.close()

  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2), 'utf-8')

  const pageCount = Object.keys(manifest).length
  const imgCount = [...imageResults.values()].filter(Boolean).length
  console.log('')
  console.log(`── Done. ${pageCount} pages, ${imgCount} unique images.`)
  console.log(`── Manifest: ${MANIFEST}`)
}

await main()
