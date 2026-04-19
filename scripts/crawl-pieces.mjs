#!/usr/bin/env node
/**
 * Second-pass crawl of piece pages.
 *
 * Each page under:
 *   /copywriting/<slug>  /creative-direction/<slug>  /fashion-editorial/<slug>
 *   /editorial/<slug>    /poetry/<slug>               /published-paper
 * is rendered with headless Chromium to capture:
 *   - every body <img> in DOM order (stripped to the stable Wix media id)
 *   - every network response to video.wixstatic.com (the mp4s are not in the
 *     initial HTML — they only load when the player starts buffering)
 *   - every network response to music.wixstatic.com (same story for audio)
 *
 * Output:
 *   scripts/crawl/pieces.json            → per-piece content record
 *   src/renderer/public/portfolio/videos → downloaded mp4s
 *   src/renderer/public/portfolio/audio  → downloaded audio
 *   src/renderer/public/portfolio/images → newly discovered images appended
 */
import { chromium } from 'playwright'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { existsSync, createWriteStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const MANIFEST = path.join(ROOT, 'scripts/crawl/manifest.json')
const OUT_JSON = path.join(ROOT, 'scripts/crawl/pieces.json')
const IMG_DIR = path.join(ROOT, 'src/renderer/public/portfolio/images')
const VIDEO_DIR = path.join(ROOT, 'src/renderer/public/portfolio/videos')
const AUDIO_DIR = path.join(ROOT, 'src/renderer/public/portfolio/audio')
const BASE = 'https://shigorika.wixsite.com/shigorika'

// Wix ships a 7-second stock loop as a default "audio" element on every poem.
// Only ek-sher has a real recording. Drop everything that matches this id.
const STOCK_AUDIO_ID = '931f1b_f9c64a4fb00c4cef859c77b5eab38b3f'

const PIECE_PREFIXES = [
  '/copywriting/',
  '/creative-direction/',
  '/fashion-editorial/',
  '/editorial/',
  '/poetry/',
]

function stripWixTransform(url) {
  return url.replace(/(~mv2\.[a-zA-Z0-9]+)\/v1\/.*$/, '$1')
}

function wixImageFilename(url) {
  const m = url.match(/\/media\/([^?]+)$/)
  return m ? m[1].replace(/\//g, '_') : null
}

function wixVideoMediaId(url) {
  // https://video.wixstatic.com/video/<id>/<profile>/mp4/file.mp4
  const m = url.match(/\/video\/([^/]+)\//)
  return m ? m[1] : null
}

function wixAudioFilename(url) {
  // https://music.wixstatic.com/mp3/<id>.<ext>  or .../m4a/<id>.<ext>
  const m = url.match(/music\.wixstatic\.com\/(?:mp3|m4a)\/([^?]+)$/)
  return m ? m[1] : null
}

async function download(url, destPath) {
  if (existsSync(destPath)) return { skipped: true }
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  await pipeline(res.body, createWriteStream(destPath))
  return { skipped: false }
}

async function crawlPiece(browser, routePath) {
  const ctx = await browser.newContext({
    userAgent: 'Mozilla/5.0',
    viewport: { width: 1440, height: 900 },
  })
  const page = await ctx.newPage()

  const videoUrls = new Set()
  const audioUrls = new Set()
  page.on('response', (res) => {
    const u = res.url()
    if (u.startsWith('https://video.wixstatic.com/video/') && u.includes('/mp4/')) {
      videoUrls.add(u)
    }
    if (
      u.startsWith('https://music.wixstatic.com/mp3/') ||
      u.startsWith('https://music.wixstatic.com/m4a/')
    ) {
      audioUrls.add(u)
    }
  })

  const url = BASE + routePath
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    // Wait for hydration
    await page.waitForTimeout(3500)
    // Scroll to force lazy loads
    await page.evaluate(async () => {
      for (let y = 0; y < 10000; y += 400) {
        window.scrollTo(0, y)
        await new Promise((r) => setTimeout(r, 90))
      }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(2500)

    // Wix preloads enough metadata on its media elements that we just need
    // to give the page time to settle. Clicking play risks triggering
    // navigation on some layouts and was unreliable in practice.
    await page.waitForTimeout(4000)

    // Body images in document order
    const bodyImages = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
        .filter(
          (i) =>
            i.src &&
            i.src.includes('wixstatic.com/media/') &&
            i.naturalWidth >= 150, // skip icons
        )
        .map((i) => ({
          origUrl: i.src,
          y: Math.round(i.getBoundingClientRect().top + window.scrollY),
        }))
      // Dedupe by url
      const seen = new Set()
      return imgs.filter((x) => {
        if (seen.has(x.origUrl)) return false
        seen.add(x.origUrl)
        return true
      })
    })

    // Body text paragraphs in DOM order.
    const textBlocks = await page.evaluate(() => {
      const chromePhrases = new Set([
        'top of page', 'bottom of page', 'Skip to Main Content', 'Shigorika',
        'Work', 'Copywriting', 'Creative Direction', 'Fashion Editorial',
        'Editorial', 'Poetry', 'Published Paper', 'Recommendations',
        'About', 'Contact', 'View More', 'More about my journey',
        'shigorika@gmail.com',
        'Email me at',
        'Email me at shigorika@gmail.com',
      ])
      const chromePatterns = [
        /^©\s*\d{4}\s+Shigorika/i,  // footer copyright
        /All rights reserved/i,
      ]
      const out = []
      const nodes = document.querySelectorAll('h1, h2, h3, p')
      for (const el of nodes) {
        const t = (el.innerText || '').trim()
        if (!t) continue
        if (chromePhrases.has(t)) continue
        if (chromePatterns.some((re) => re.test(t))) continue
        out.push({
          tag: el.tagName.toLowerCase(),
          text: t,
          y: Math.round(el.getBoundingClientRect().top + window.scrollY),
        })
      }
      return out
    })

    await ctx.close()
    return {
      status: 'ok',
      bodyImages,
      textBlocks,
      videoUrls: [...videoUrls],
      audioUrls: [...audioUrls],
    }
  } catch (e) {
    await ctx.close()
    return { status: 'error', error: e.message }
  }
}

async function main() {
  await mkdir(VIDEO_DIR, { recursive: true })
  await mkdir(AUDIO_DIR, { recursive: true })
  await mkdir(IMG_DIR, { recursive: true })

  const manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'))
  const pieces = []
  for (const [slug, data] of Object.entries(manifest)) {
    if (data.status !== 200) continue
    const p = data.path
    if (p === '/published-paper') {
      pieces.push({ slug, path: p })
      continue
    }
    if (PIECE_PREFIXES.some((pref) => p.startsWith(pref) && p !== pref.slice(0, -1))) {
      pieces.push({ slug, path: p })
    }
  }

  // Resume: if pieces.json exists, only re-crawl entries that previously
  // errored. Good OK entries stay as-is.
  const records = []
  const existing = new Map()
  if (existsSync(OUT_JSON)) {
    const prev = JSON.parse(await readFile(OUT_JSON, 'utf-8'))
    for (const r of prev) existing.set(r.routePath, r)
  }
  // Always force re-crawl of copywriting (we need videos) on resume. Videos
  // may not have been captured on the first pass.
  const forceRecrawl = (routePath) => routePath.startsWith('/copywriting/')

  const todo = []
  for (const p of pieces) {
    const prior = existing.get(p.path)
    if (prior && !prior.error && !forceRecrawl(p.path)) {
      records.push(prior)
      continue
    }
    todo.push(p)
  }

  console.log(`Crawling ${todo.length} piece pages… (${records.length} already done)`)
  const browser = await chromium.launch()

  for (const { slug, path: routePath } of todo) {
    process.stdout.write(`── ${routePath}\n`)
    const result = await crawlPiece(browser, routePath)
    if (result.status !== 'ok') {
      console.log(`   ERROR: ${result.error}`)
      records.push({ slug, routePath, error: result.error })
      continue
    }

    // Download any new body images
    const imageFiles = []
    for (const { origUrl, y } of result.bodyImages) {
      const orig = stripWixTransform(origUrl)
      const fname = wixImageFilename(orig)
      if (!fname) continue
      const dest = path.join(IMG_DIR, fname)
      try {
        const { skipped } = await download(orig, dest)
        if (!skipped) process.stdout.write(`   ↓ img  ${fname}\n`)
        imageFiles.push({ fname, y })
      } catch (e) {
        console.log(`   ✗ img  ${fname} — ${e.message}`)
      }
    }

    // Videos
    const videoFiles = []
    for (const u of result.videoUrls) {
      const id = wixVideoMediaId(u)
      if (!id) continue
      // Prefer the 1080p mp4 if we have multiple profiles for the same id
      if (!u.includes('/1080p/')) continue
      const dest = path.join(VIDEO_DIR, `${id}.mp4`)
      try {
        const { skipped } = await download(u, dest)
        if (!skipped) process.stdout.write(`   ↓ vid  ${id}.mp4\n`)
        videoFiles.push({ id, path: `/portfolio/videos/${id}.mp4` })
      } catch (e) {
        console.log(`   ✗ vid  ${id} — ${e.message}`)
      }
    }

    // Audio (skip the stock loop)
    const audioFiles = []
    for (const u of result.audioUrls) {
      const fn = wixAudioFilename(u)
      if (!fn) continue
      if (fn.includes(STOCK_AUDIO_ID)) continue
      const dest = path.join(AUDIO_DIR, fn.replace(/\//g, '_'))
      try {
        const { skipped } = await download(u, dest)
        if (!skipped) process.stdout.write(`   ↓ aud  ${fn}\n`)
        audioFiles.push({
          fname: fn.replace(/\//g, '_'),
          path: `/portfolio/audio/${fn.replace(/\//g, '_')}`,
        })
      } catch (e) {
        console.log(`   ✗ aud  ${fn} — ${e.message}`)
      }
    }

    records.push({
      slug,
      routePath,
      bodyImages: imageFiles,
      textBlocks: result.textBlocks,
      videos: videoFiles,
      audios: audioFiles,
    })
  }

  await browser.close()
  await writeFile(OUT_JSON, JSON.stringify(records, null, 2), 'utf-8')
  console.log(`\n── Wrote ${OUT_JSON}`)
}

await main()
