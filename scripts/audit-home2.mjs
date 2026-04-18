import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('https://shigorika.wixsite.com/shigorika', {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
})
await page.waitForTimeout(4000)
await page.evaluate(async () => {
  for (let y = 0; y < 8000; y += 300) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 120))
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(2000)

// Find each link that points at a piece, and extract the image inside it (Wix
// wraps each tile in <a><img/>text</a>). We grab the full unique Wix media ID
// by stripping the CDN transform prefix.
const data = await page.evaluate(() => {
  const tiles = []
  const anchors = Array.from(document.querySelectorAll('a[href*="wixsite.com/shigorika/"]'))
  for (const a of anchors) {
    const href = a.href
    // Skip top-level nav links (they don't wrap an image)
    const img = a.querySelector('img')
    if (!img) continue
    // Wix appends a CDN transform. The stable media ID is between "/media/" and "/v1/"
    const m = img.src.match(/\/media\/([^/]+)\//)
    const mediaId = m ? m[1] : null
    tiles.push({
      href: href.replace('https://shigorika.wixsite.com/shigorika', ''),
      text: a.textContent.trim().slice(0, 100),
      imgSrc: img.src,
      mediaId,
      y: img.getBoundingClientRect().top + window.scrollY,
    })
  }
  // Dedupe by href (Wix duplicates anchors for responsive layouts)
  const seen = new Set()
  return tiles.filter((t) => {
    if (seen.has(t.href)) return false
    seen.add(t.href)
    return true
  })
})

// Also grab the hero image
const hero = await page.evaluate(() => {
  const first = document.querySelector('main img')
  if (!first) return null
  const m = first.src.match(/\/media\/([^/]+)\//)
  return { src: first.src, mediaId: m?.[1] }
})

console.log('HERO:')
console.log(' ', hero?.mediaId, hero?.src)
console.log()
console.log('TILES (by href):')
for (const t of data.sort((a, b) => a.y - b.y)) {
  console.log(' ', t.href, '→', t.mediaId)
}

await writeFile('/tmp/home-tiles.json', JSON.stringify({ hero, tiles: data }, null, 2))
await browser.close()
