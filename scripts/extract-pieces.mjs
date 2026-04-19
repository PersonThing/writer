#!/usr/bin/env node
/**
 * Reads scripts/crawl/pieces.json and regenerates per-piece markdown files
 * under content/portfolio/<category>/<slug>.md.
 *
 * Does two important things:
 *  1. Renames images from their Wix ids to human-readable per-piece names
 *     (<category>--<slug>--NN.ext) and rewrites references accordingly.
 *     This is done in-place on the public/portfolio/images/ directory.
 *  2. Inlines videos / audio using the custom ::: syntax that markdown.js
 *     now understands.
 *
 * Idempotent: if an image has already been renamed (target file exists,
 * source doesn't), we skip the copy.
 */
import { readFile, writeFile, rename, mkdir, copyFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(new URL('..', import.meta.url).pathname)
const PIECES_JSON = path.join(ROOT, 'scripts/crawl/pieces.json')
const CONTENT_DIR = path.join(ROOT, 'content/portfolio')
const IMG_DIR = path.join(ROOT, 'src/renderer/public/portfolio/images')

const WIX_TO_PIECE_SLUG = new Map() // wix filename → {category, slug}

function extOf(fname) {
  const i = fname.lastIndexOf('.')
  return i >= 0 ? fname.slice(i + 1).toLowerCase() : 'jpg'
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n)
}

function clean(s) {
  return s.replace(/\s+/g, ' ').trim()
}

const CHROME_EXACT = new Set([
  'top of page', 'bottom of page', 'Skip to Main Content', 'Shigorika',
  'Work', 'Copywriting', 'Creative Direction', 'Fashion Editorial',
  'Editorial', 'Poetry', 'Published Paper', 'Recommendations',
  'About', 'Contact', 'View More', 'More about my journey',
  'Email me at', 'shigorika@gmail.com', 'Email me at shigorika@gmail.com',
  '0', // some wix chrome
])
const CHROME_PATTERNS = [
  /^©\s*\d{4}\s+Shigorika/i,
  /^All rights reserved$/i,
  /rights reserved/i,
]
function isChrome(text) {
  if (CHROME_EXACT.has(text)) return true
  for (const re of CHROME_PATTERNS) if (re.test(text)) return true
  return false
}

function maybeRenameImage(wixFname, category, slug, n) {
  // Target name: <category>--<slug>--NN.<ext>
  const ext = extOf(wixFname)
  const newName = `${category}--${slug}--${pad2(n)}.${ext}`
  const src = path.join(IMG_DIR, wixFname)
  const dest = path.join(IMG_DIR, newName)
  return { wixFname, newName, src, dest }
}

async function performRenames(renames) {
  for (const r of renames) {
    if (existsSync(r.dest)) continue // already renamed
    if (!existsSync(r.src)) continue // source missing (wasn't crawled)
    // Use copy + (eventually) not delete, since the same image can be
    // referenced by the home page under its Wix id. We just make a second
    // named copy — disk cost is trivial at portfolio scale.
    await copyFile(r.src, r.dest)
  }
}

function buildBody(piece, sortedAssets) {
  // piece: { bodyImages: [{fname, y}], textBlocks: [{tag, text, y}], videos, audios }
  // sortedAssets: array sorted by y, each { type, payload }
  const lines = []
  for (const a of sortedAssets) {
    if (a.type === 'text') {
      if (a.tag === 'h1') {
        lines.push(`# ${clean(a.text)}`, '')
      } else if (a.tag === 'h2') {
        lines.push(`## ${clean(a.text)}`, '')
      } else if (a.tag === 'h3') {
        lines.push(`### ${clean(a.text)}`, '')
      } else {
        lines.push(clean(a.text), '')
      }
    } else if (a.type === 'image') {
      lines.push(`![](${a.path})`, '')
    } else if (a.type === 'video') {
      const poster = a.poster ? ` poster=${a.poster}` : ''
      lines.push(`::: video ${a.path}${poster} :::`, '')
    } else if (a.type === 'audio') {
      lines.push(`::: audio ${a.path} :::`, '')
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n'
}

function yamlValue(v) {
  if (v == null || v === '') return null
  const s = String(v)
  if (/^[A-Za-z0-9_\-./: ]+$/.test(s) && !s.startsWith(' ') && !s.endsWith(' ')) return s
  return JSON.stringify(s)
}

function frontmatter(obj) {
  const entries = Object.entries(obj).filter(([, v]) => yamlValue(v) !== null)
  const body = entries.map(([k, v]) => `${k}: ${yamlValue(v)}`).join('\n')
  return `---\n${body}\n---\n\n`
}

async function main() {
  const raw = await readFile(PIECES_JSON, 'utf-8')
  const pieces = JSON.parse(raw)

  const allRenames = []

  for (const p of pieces) {
    if (p.error) {
      console.log(`skip ${p.routePath}: ${p.error}`)
      continue
    }
    const slugParts = p.slug.split('--')
    const category = slugParts[0]
    const subSlug = slugParts.slice(1).join('--') || 'index'

    // Order every asset by y
    const assets = []
    for (const { fname, y } of p.bodyImages || []) {
      assets.push({ type: 'image', y, fname })
    }
    for (const { text, tag, y } of p.textBlocks || []) {
      if (isChrome(text.trim())) continue
      assets.push({ type: 'text', y, tag, text })
    }
    // Videos & audio don't have y positions — place them after the first
    // image (if any) so they appear near the top of the body. If no images,
    // they go before the first text block.
    const firstImgY = assets.find((a) => a.type === 'image')?.y
    const firstTextY = assets.find((a) => a.type === 'text')?.y
    const mediaY = firstImgY != null ? firstImgY + 1 : (firstTextY != null ? firstTextY - 10 : 0)

    // Rename images & collect video/audio assets
    const imageRenames = []
    let n = 0
    for (const a of assets) {
      if (a.type !== 'image') continue
      n++
      const r = maybeRenameImage(a.fname, category, subSlug, n)
      imageRenames.push(r)
      a.path = `/portfolio/images/${r.newName}`
    }
    allRenames.push(...imageRenames)

    // Add videos + audios
    for (const v of p.videos || []) {
      assets.push({ type: 'video', y: mediaY, path: v.path })
    }
    // Audio policy: on poetry pages put audio BEFORE any text/image so the
    // player sits at the top of the piece. Everywhere else, use mediaY.
    const audioY = category === 'poetry' ? -1 : mediaY
    for (const au of p.audios || []) {
      assets.push({ type: 'audio', y: audioY, path: au.path })
    }

    assets.sort((a, b) => a.y - b.y)

    // Dedupe consecutive identical text blocks (Wix occasionally repeats
    // paragraphs in different containers)
    const seen = new Set()
    const dedup = []
    for (const a of assets) {
      const key = a.type === 'text' ? `text:${a.text}` : a.type + ':' + (a.path || '')
      if (seen.has(key)) continue
      seen.add(key)
      dedup.push(a)
    }

    // Pull out hero image: first image that is followed by at least one text
    // block. Pages that lead with the video skip hero.
    let hero = ''
    const firstImageIdx = dedup.findIndex((a) => a.type === 'image')
    if (firstImageIdx >= 0) {
      const hasTextAfter = dedup.slice(firstImageIdx + 1).some((a) => a.type === 'text')
      const hasVideo = dedup.some((a) => a.type === 'video')
      if (hasTextAfter && !hasVideo) {
        hero = dedup[firstImageIdx].path
        dedup.splice(firstImageIdx, 1)
      }
    }

    // Derive title + lede from the first H1/H2 + its immediate next short paragraph
    let title = p.slug.split('--').pop().replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    let lede = ''
    const headingIdx = dedup.findIndex((a) => a.type === 'text' && (a.tag === 'h1' || a.tag === 'h2'))
    if (headingIdx >= 0) {
      title = dedup[headingIdx].text
      // Remove the title from the body
      dedup.splice(headingIdx, 1)
      // If the next text block is short (<200 chars), treat it as the lede
      const nextTextIdx = dedup.findIndex((a) => a.type === 'text')
      if (nextTextIdx >= 0 && dedup[nextTextIdx].text.length <= 200) {
        lede = dedup[nextTextIdx].text
        dedup.splice(nextTextIdx, 1)
      }
    }

    const body = buildBody(p, dedup)
    const fm = frontmatter({
      title,
      slug: p.slug,
      source_path: p.routePath,
      lede,
      hero,
    })

    const outPath = path.join(CONTENT_DIR, category, `${subSlug}.md`)
    await mkdir(path.dirname(outPath), { recursive: true })
    await writeFile(outPath, fm + body, 'utf-8')
    console.log(`wrote ${category}/${subSlug}.md`)

    for (const r of imageRenames) {
      WIX_TO_PIECE_SLUG.set(r.wixFname, {
        category,
        slug: subSlug,
        newName: r.newName,
      })
    }
  }

  // Perform the file copies now (extractor is idempotent)
  await performRenames(allRenames)

  // Write the mapping so HomePage can look up new names for its tiles
  await writeFile(
    path.join(ROOT, 'scripts/crawl/image-rename.json'),
    JSON.stringify(Object.fromEntries(WIX_TO_PIECE_SLUG), null, 2),
  )

  console.log(`\n── ${pieces.length} pieces written, ${allRenames.length} image renames recorded`)
}

await main()
