import { chromium } from 'playwright'
import { spawn } from 'node:child_process'
import { setTimeout as sleep } from 'node:timers/promises'

const server = spawn('node', ['--env-file=.env.local', 'server/index.js'], {
  stdio: ['ignore', 'ignore', 'inherit'],
})
process.on('exit', () => server.kill())
await sleep(2500)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:3456/', { waitUntil: 'domcontentloaded' })
await sleep(800)
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
await sleep(800)
// Just the footer
const footer = page.locator('.site-footer')
await footer.screenshot({ path: '/tmp/local-footer.png' })
console.log('wrote /tmp/local-footer.png')

await browser.close()
server.kill()
