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

async function captureFull(path, outFile) {
  await page.goto('http://localhost:3456' + path, { waitUntil: 'domcontentloaded' })
  await sleep(1000)
  await page.evaluate(async () => {
    for (let y = 0; y < 5000; y += 400) {
      window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60))
    }
    window.scrollTo(0, 0)
  })
  await sleep(800)
  await page.screenshot({ path: outFile, fullPage: true })
  console.log('wrote', outFile)
}

await captureFull('/', '/tmp/local-home.png')
await captureFull('/fashion-editorial', '/tmp/local-fashion.png')
await captureFull('/fashion-editorial/azzedine-alaia--master-and-maverick', '/tmp/local-piece.png')
await captureFull('/about', '/tmp/local-about.png')

await browser.close()
server.kill()
