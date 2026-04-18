import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('https://shigorika.wixsite.com/shigorika', { waitUntil: 'domcontentloaded', timeout: 45000 })
await page.waitForTimeout(4000)
await page.evaluate(async () => {
  for (let y = 0; y < 3000; y += 300) {
    window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 80))
  }
  window.scrollTo(0, 0)
})
await page.waitForTimeout(1000)
await page.screenshot({ path: '/tmp/prod-home.png', fullPage: true })
console.log('screenshot saved: /tmp/prod-home.png')

// Also fetch the category layout
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page2.goto('https://shigorika.wixsite.com/shigorika/fashion-editorial', { waitUntil: 'domcontentloaded', timeout: 45000 })
await page2.waitForTimeout(3500)
await page2.evaluate(async () => {
  for (let y = 0; y < 3000; y += 300) {
    window.scrollTo(0, y)
    await new Promise(r => setTimeout(r, 80))
  }
  window.scrollTo(0, 0)
})
await page2.waitForTimeout(1000)
await page2.screenshot({ path: '/tmp/prod-fashion.png', fullPage: true })
console.log('screenshot saved: /tmp/prod-fashion.png')
await browser.close()
