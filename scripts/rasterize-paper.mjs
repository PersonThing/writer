#!/usr/bin/env node
/**
 * Rasterize scripts/paper.pdf → src/renderer/public/portfolio/paper/page-NN.png
 * plus a manifest.json the slideshow reads at runtime.
 *
 * pdf-to-img wraps pdfjs + node-canvas and handles the canvas-factory plumbing
 * pdfjs v4 needs under Node; pdfjs direct rendering throws on inline images.
 */
import { pdf } from 'pdf-to-img'
import { readFile, writeFile, mkdir, readdir, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)))
const PDF_PATH = path.join(ROOT, 'scripts/paper.pdf')
const OUT_DIR = path.join(ROOT, 'src/renderer/public/portfolio/paper')
// ~2x display resolution so slides stay sharp on Retina when scaled to fit.
const SCALE = 2.0

async function main() {
  await mkdir(OUT_DIR, { recursive: true })

  // Clear stale page PNGs from a previous run.
  for (const f of await readdir(OUT_DIR)) {
    if (/^page-\d+\.png$/.test(f) || f === 'manifest.json') {
      await unlink(path.join(OUT_DIR, f))
    }
  }

  const data = await readFile(PDF_PATH)
  const doc = await pdf(data, { scale: SCALE })
  const pageCount = doc.length
  const pad = String(pageCount).length
  const pages = []

  let i = 0
  for await (const img of doc) {
    i++
    const name = `page-${String(i).padStart(pad, '0')}.png`
    await writeFile(path.join(OUT_DIR, name), img)
    process.stdout.write(`  ${name}  ${img.length.toLocaleString()} bytes\n`)
    pages.push({
      src: `/portfolio/paper/${name}`,
      index: i,
    })
  }

  const manifest = { pageCount, pages }
  await writeFile(
    path.join(OUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2),
  )
  console.log(`\nWrote ${pageCount} slides + manifest.json to ${OUT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
