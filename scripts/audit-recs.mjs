import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } })
await page.goto('https://shigorika.wixsite.com/shigorika', { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(4000)
await page.evaluate(async () => {
  window.scrollTo(0, document.body.scrollHeight)
  await new Promise(r => setTimeout(r, 1500))
})
await page.waitForTimeout(2000)

// Get all paragraphs in the last ~2000px of the page (that's where recommendations live)
const recs = await page.evaluate(() => {
  // Find the Recommendations heading
  const recHdg = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .find(el => el.textContent?.trim() === 'Recommendations')
  if (!recHdg) return { err: 'no heading' }
  const hdgY = recHdg.getBoundingClientRect().top + window.scrollY
  // Grab EVERY text-bearing element below that heading
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_ELEMENT)
  const items = []
  let n
  while ((n = walker.nextNode())) {
    if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'IMG'].includes(n.tagName)) continue
    // Direct text content only (not bubbled)
    const direct = Array.from(n.childNodes).filter(c => c.nodeType === 3).map(c => c.textContent).join('').trim()
    if (!direct) continue
    const y = n.getBoundingClientRect().top + window.scrollY
    if (y < hdgY) continue
    items.push({ tag: n.tagName, y: Math.round(y), text: direct })
  }
  return items.sort((a, b) => a.y - b.y).slice(0, 80)
})
if (recs.err) console.log('ERR', recs.err)
else for (const r of recs) console.log(r.y, r.tag, '|', r.text)

await browser.close()
