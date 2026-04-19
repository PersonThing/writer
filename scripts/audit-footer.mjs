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
  window.scrollTo(0, document.body.scrollHeight)
  await new Promise(r => setTimeout(r, 500))
})
await page.waitForTimeout(2000)

// Find the footer / bottom of page. Wix labels it SITE_FOOTER.
const info = await page.evaluate(() => {
  const footer = document.querySelector('#SITE_FOOTER, [data-mesh-id*="FOOTER"], footer')
  if (!footer) return { found: false }
  const imgs = Array.from(footer.querySelectorAll('img')).map(i => ({
    src: i.src,
    alt: i.alt,
    width: i.naturalWidth,
    height: i.naturalHeight,
  }))
  const links = Array.from(footer.querySelectorAll('a')).map(a => ({
    href: a.href,
    text: (a.textContent || '').trim().slice(0, 80),
  }))
  const text = (footer.textContent || '').trim()
  return { found: true, imgs, links, text: text.slice(0, 1200) }
})

console.log(JSON.stringify(info, null, 2))

// Screenshot the footer area
const h = await page.evaluate(() => {
  const el = document.querySelector('#SITE_FOOTER, footer')
  return el ? el.getBoundingClientRect().top + window.scrollY : null
})
if (h != null) {
  await page.evaluate((y) => window.scrollTo(0, y - 100), h)
  await page.waitForTimeout(500)
  await page.screenshot({ path: '/tmp/prod-footer.png' })
  console.log('screenshot: /tmp/prod-footer.png')
}

await writeFile('/tmp/footer-info.json', JSON.stringify(info, null, 2))
await browser.close()
