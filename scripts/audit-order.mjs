import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const CATEGORIES = [
  '/creative-direction',
  '/fashion-editorial',
  '/editorial',
  '/poetry',
]

const browser = await chromium.launch()
const out = { categories: {}, recommendations: null }

for (const cat of CATEGORIES) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('https://shigorika.wixsite.com/shigorika' + cat, {
    waitUntil: 'domcontentloaded',
    timeout: 45000,
  })
  await page.waitForTimeout(4000)
  await page.evaluate(async () => {
    for (let y = 0; y < 8000; y += 300) {
      window.scrollTo(0, y)
      await new Promise(r => setTimeout(r, 120))
    }
    window.scrollTo(0, 0)
  })
  await page.waitForTimeout(1500)
  // Get every piece link in vertical order
  const items = await page.evaluate((prefix) => {
    const anchors = Array.from(document.querySelectorAll('a[href*="' + prefix + '/"]'))
    const seen = new Set()
    const out = []
    for (const a of anchors) {
      const href = a.href
      // Only accept sub-items (not the category landing itself)
      const m = href.match(/\/(creative-direction|fashion-editorial|editorial|poetry)\/([^/?#]+)$/)
      if (!m) continue
      const slug = decodeURIComponent(m[2])
      if (seen.has(slug)) continue
      seen.add(slug)
      out.push({ slug, y: Math.round(a.getBoundingClientRect().top + window.scrollY), title: (a.textContent || '').trim() })
    }
    return out.sort((a, b) => a.y - b.y)
  }, cat)
  out.categories[cat] = items
  console.log(cat, '=', items.length, 'items')
  for (const it of items) console.log('  ', it.slug, '| y=' + it.y)
  await page.close()
}

// Recommendations on home
{
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  await page.goto('https://shigorika.wixsite.com/shigorika', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(4000)
  await page.evaluate(async () => {
    window.scrollTo(0, document.body.scrollHeight)
    await new Promise(r => setTimeout(r, 1500))
    window.scrollTo(0, document.body.scrollHeight - 1200)
  })
  await page.waitForTimeout(1500)
  const recs = await page.evaluate(() => {
    // Find the "Recommendations" heading and then walk siblings for quote blocks
    const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4'))
      .filter(h => /recommendations/i.test(h.textContent))
    if (!headings.length) return { headingFound: false }
    const h = headings[0]
    // Grab the next ~4 quote blocks. On Wix each looks like: quote body + author + role
    // We walk a wide DOM area after the heading and capture paragraphs.
    const container = h.closest('[data-mesh-id], section, div')
    let section = container
    // Try the parent up to a containing section
    for (let i = 0; i < 5 && section && section.clientHeight < 400; i++) section = section.parentElement
    const text = section ? (section.innerText || '') : ''
    // Also extract names: Wix tends to put author in a <p data-testid="richTextElement"> with shorter text
    const paragraphs = Array.from(section.querySelectorAll('p')).map(p => (p.innerText || '').trim()).filter(Boolean)
    return { headingFound: true, paragraphs, textLen: text.length }
  })
  out.recommendations = recs
  console.log('\nrecommendations:', recs.headingFound ? recs.paragraphs.length + ' paragraphs' : 'NOT FOUND')
  if (recs.paragraphs) {
    for (const p of recs.paragraphs) console.log('  ─', p.slice(0, 120))
  }
  // Also screenshot
  await page.screenshot({ path: '/tmp/prod-recs.png', fullPage: false })
  await page.close()
}

await writeFile('/tmp/order-audit.json', JSON.stringify(out, null, 2))
await browser.close()
console.log('\nwritten: /tmp/order-audit.json')
