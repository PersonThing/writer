import { chromium } from 'playwright'
import { writeFile } from 'node:fs/promises'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('https://shigorika.wixsite.com/shigorika', {
  waitUntil: 'domcontentloaded',
  timeout: 45000,
})
await page.waitForTimeout(4000)
// Lazy-load everything
await page.evaluate(async () => {
  for (let y = 0; y < 8000; y += 300) {
    window.scrollTo(0, y)
    await new Promise((r) => setTimeout(r, 120))
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(2000)

// Walk the DOM and extract sections in document order with their images and text.
// A "section" is a category block on the homepage. We find them by looking for
// image clusters followed by text that includes known category names.
const data = await page.evaluate(() => {
  const out = { title: document.title, hero: null, stats: [], categories: [] }

  // Hero
  const heroImg = document.querySelector('main img, [data-testid*="richImage"] img')
  if (heroImg) out.hero = { src: heroImg.src, alt: heroImg.alt }

  // Gather every image with parent context
  const imgs = Array.from(document.querySelectorAll('img'))
  out.allImages = imgs
    .filter((i) => i.src && i.naturalWidth > 40)
    .map((i) => ({
      src: i.src,
      alt: i.alt,
      width: i.naturalWidth,
      height: i.naturalHeight,
      y: i.getBoundingClientRect().top + window.scrollY,
    }))
    .sort((a, b) => a.y - b.y)

  // Headings in order
  out.headings = Array.from(document.querySelectorAll('h1, h2, h3'))
    .map((h) => ({
      tag: h.tagName,
      text: h.textContent.trim(),
      y: h.getBoundingClientRect().top + window.scrollY,
    }))
    .filter((h) => h.text && h.text.length < 200)

  // Links (click targets)
  out.links = Array.from(document.querySelectorAll('a'))
    .filter((a) => {
      const href = a.href
      if (!href.startsWith('https://shigorika.wixsite.com/')) return false
      if (href.endsWith('/shigorika') || href.endsWith('/shigorika/')) return false
      return true
    })
    .map((a) => ({
      href: a.href,
      text: a.textContent.trim().slice(0, 120),
      y: a.getBoundingClientRect().top + window.scrollY,
    }))
    .sort((a, b) => a.y - b.y)

  return out
})

await writeFile('/tmp/home-audit.json', JSON.stringify(data, null, 2))
console.log('headings:', data.headings.length)
console.log('images:', data.allImages.length)
console.log('links:', data.links.length)

await page.screenshot({ path: '/tmp/prod-home-audit.png', fullPage: true })
await browser.close()
