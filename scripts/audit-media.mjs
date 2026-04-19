import { chromium } from 'playwright'

const urls = [
  'https://shigorika.wixsite.com/shigorika/copywriting/grand-seiko-film',
  'https://shigorika.wixsite.com/shigorika/poetry/on-writing',
  'https://shigorika.wixsite.com/shigorika/poetry/hannah-banana',
  'https://shigorika.wixsite.com/shigorika/poetry/ek-sher',
  'https://shigorika.wixsite.com/shigorika/poetry/my-dad-socks-and-gulzar',
  'https://shigorika.wixsite.com/shigorika/poetry/home-and-hell',
  'https://shigorika.wixsite.com/shigorika/poetry/medeas-ideas',
  'https://shigorika.wixsite.com/shigorika/poetry/times-square',
]

const browser = await chromium.launch()
for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const networkAssets = new Set()
  page.on('response', (res) => {
    const u = res.url()
    if (/\.(mp4|webm|m3u8|mpd|mp3|m4a|wav|ogg)(\?|$)/i.test(u)) networkAssets.add(u)
    if (u.includes('video.wixstatic.com/video/')) networkAssets.add(u)
    if (u.includes('audio.wixstatic.com/audio/')) networkAssets.add(u)
  })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(4000)
    await page.evaluate(async () => {
      for (let y = 0; y < 10000; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 100)) }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(2000)
    const data = await page.evaluate(() => {
      const html = document.documentElement.innerHTML
      const out = {
        hasVideoTag: !!document.querySelector('video'),
        hasAudioTag: !!document.querySelector('audio'),
        iframeSrcs: Array.from(document.querySelectorAll('iframe')).map(i => i.src).filter(Boolean).slice(0, 4),
        wixVideos: [...new Set((html.match(/https?:\/\/video\.wixstatic\.com\/video\/[^"' ]+/g) || []).slice(0, 5))],
        wixAudios: [...new Set((html.match(/https?:\/\/audio\.wixstatic\.com\/[^"' ]+/g) || []).slice(0, 5))],
        posterIds: [...new Set((html.match(/\/media\/video_[^/]+\//g) || []).slice(0, 3))],
        videoComponents: html.includes('wixVideoPlayer') || html.includes('VideoComponent') || html.includes('soundcloud'),
      }
      return out
    })
    console.log('\n===', url.split('/shigorika').pop())
    console.log('  tags: video=' + data.hasVideoTag + ' audio=' + data.hasAudioTag)
    if (data.iframeSrcs.length) console.log('  iframes:', data.iframeSrcs)
    if (data.wixVideos.length) console.log('  wixVideo urls:', data.wixVideos)
    if (data.wixAudios.length) console.log('  wixAudio urls:', data.wixAudios)
    if (networkAssets.size) console.log('  network:', [...networkAssets].slice(0, 5))
    if (data.videoComponents) console.log('  has video/audio player component hints')
  } catch (e) { console.log('===', url, 'ERROR:', e.message.split('\n')[0]) }
  await page.close()
}
await browser.close()
