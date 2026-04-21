#!/usr/bin/env node
/**
 * Optimize portfolio images in place.
 *
 * The Wix extract left us with 300MB+ of full-resolution originals, many
 * of them duplicated under both a Wix-hash filename and a human-readable
 * `<category>--<slug>--NN.ext` filename. Both forms are referenced from
 * code and content, so we can't delete either side — we just need to
 * shrink each file.
 *
 * Strategy:
 *   • Resize long-edge to MAX_DIM (default 2000px). Retina-ready and
 *     still plenty for a ~1000 CSS-px-wide editorial column.
 *   • JPEG/JPG/JPEG → re-encode at quality 82, strip metadata.
 *   • PNG → palette-quantize + zlib max compression + metadata strip.
 *   • WEBP → re-encode at quality 82.
 *   • Content-hash dedup: every unique source bytestream is processed
 *     once; duplicate filenames are written by streaming the result.
 *   • Backup: originals moved to public/portfolio/images-raw/ on the
 *     first run (gitignored) so re-runs can pick up with different
 *     settings. Skip a file if its compressed size would be bigger
 *     than the original.
 *
 * Usage:
 *   node scripts/optimize-images.mjs           # optimize in place
 *   node scripts/optimize-images.mjs --dry-run # report only, no writes
 */
import { createHash } from 'node:crypto'
import { mkdir, readdir, readFile, stat, writeFile, rename } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const SRC_DIR = path.resolve('src/renderer/public/portfolio/images')
// Backups live outside the `public/` tree so Vite doesn't ship them to
// the dist/ build. Gitignored — see .gitignore.
const BACKUP_DIR = path.resolve('scripts/image-originals/portfolio-images')
const MAX_DIM = 2000
const JPEG_Q = 82
const WEBP_Q = 82
const DRY_RUN = process.argv.includes('--dry-run')

function fmt(bytes) {
  if (bytes > 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + ' MB'
  return (bytes / 1024).toFixed(1) + ' KB'
}

async function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex')
}

async function optimizeBuffer(buf, ext) {
  const img = sharp(buf, { failOn: 'none' }).rotate() // respect EXIF orientation
  const meta = await img.metadata()
  const longEdge = Math.max(meta.width || 0, meta.height || 0)
  const needsResize = longEdge > MAX_DIM
  const pipeline = needsResize
    ? img.resize({
        width: meta.width >= meta.height ? MAX_DIM : undefined,
        height: meta.height > meta.width ? MAX_DIM : undefined,
        withoutEnlargement: true,
      })
    : img

  switch (ext.toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return pipeline.jpeg({ quality: JPEG_Q, mozjpeg: true }).withMetadata({ orientation: undefined }).toBuffer()
    case '.png':
      // palette=true enables quantization (8-bit palette) which is
      // aggressive but safe for photography with no meaningful alpha.
      return pipeline
        .png({ compressionLevel: 9, palette: true, quality: 90 })
        .toBuffer()
    case '.webp':
      return pipeline.webp({ quality: WEBP_Q }).toBuffer()
    default:
      return buf
  }
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`No such directory: ${SRC_DIR}`)
    process.exit(1)
  }
  const files = (await readdir(SRC_DIR))
    .filter((f) => /\.(jpe?g|png|webp)$/i.test(f))
    .sort()

  // First pass: compute hash of current on-disk contents so we can
  // dedup and so we can skip files that were already optimized on a
  // previous run (heuristic: < 400KB already).
  const byHash = new Map() // hash → { aliases: [filename, ...], sourceBuf }
  let totalBefore = 0
  for (const f of files) {
    const buf = await readFile(path.join(SRC_DIR, f))
    totalBefore += buf.length
    const h = await sha256(buf)
    if (!byHash.has(h)) byHash.set(h, { aliases: [], sourceBuf: buf, origSize: buf.length })
    byHash.get(h).aliases.push(f)
  }

  console.log(
    `\nFiles: ${files.length}   Unique content: ${byHash.size}   Total input: ${fmt(totalBefore)}\n`,
  )

  if (!DRY_RUN) {
    await mkdir(BACKUP_DIR, { recursive: true })
  }

  let totalAfter = 0
  let kept = 0
  let shrunk = 0
  let skippedNoGain = 0
  let errors = 0

  for (const [hash, group] of byHash) {
    const primary = group.aliases[0]
    const ext = path.extname(primary)
    const inBytes = group.origSize
    let out
    try {
      out = await optimizeBuffer(group.sourceBuf, ext)
    } catch (e) {
      console.error(`[error] ${primary}: ${e.message}`)
      errors++
      totalAfter += inBytes * group.aliases.length
      continue
    }
    // If compression didn't help, keep the original bytes.
    const useOut = out.length < inBytes * 0.95
    const finalBuf = useOut ? out : group.sourceBuf
    if (useOut) shrunk++
    else skippedNoGain++

    for (const alias of group.aliases) {
      totalAfter += finalBuf.length
      kept++
      if (DRY_RUN) continue
      const srcPath = path.join(SRC_DIR, alias)
      const backupPath = path.join(BACKUP_DIR, alias)
      // Move the untouched original to the backup dir (first run only;
      // if backup exists, don't overwrite — keeps true originals).
      if (!existsSync(backupPath)) {
        await rename(srcPath, backupPath)
      }
      await writeFile(srcPath, finalBuf)
    }

    const tag = useOut ? 'shrunk' : 'no-gain'
    const saved = inBytes - finalBuf.length
    const pct = ((saved / inBytes) * 100).toFixed(0)
    console.log(
      `  ${tag.padEnd(8)} ${fmt(inBytes).padStart(9)} → ${fmt(finalBuf.length).padStart(9)}  (-${pct}%)  ${primary}${
        group.aliases.length > 1 ? `  [+${group.aliases.length - 1} dup]` : ''
      }`,
    )
  }

  console.log('')
  console.log(`Summary:`)
  console.log(`  shrunk:         ${shrunk} groups`)
  console.log(`  kept original:  ${skippedNoGain} groups`)
  console.log(`  errored:        ${errors} groups`)
  console.log(`  files written:  ${kept}${DRY_RUN ? ' (dry-run: no files changed)' : ''}`)
  console.log(`  total before:   ${fmt(totalBefore)}`)
  console.log(`  total after:    ${fmt(totalAfter)}`)
  console.log(`  saved:          ${fmt(totalBefore - totalAfter)} (-${(((totalBefore - totalAfter) / totalBefore) * 100).toFixed(1)}%)`)
  if (!DRY_RUN) {
    console.log(`\nOriginals backed up to: ${BACKUP_DIR}`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
