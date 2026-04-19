import { chromium } from 'playwright'

const urls = [
  'https://shigorika.wixsite.com/shigorika/copywriting/grand-seiko-film',
  'https://shigorika.wixsite.com/shigorika/copywriting/tag-heuer-film',
  'https://shigorika.wixsite.com/shigorika/poetry/on-writing',
  'https://shigorika.wixsite.com/shigorika/poetry/hannah-banana',
  'https://shigorika.wixsite.com/shigorika/creative-direction/ethnicwear-db',
  'https://shigorika.wixsite.com/shigorika/fashion-editorial/azzedine-alaia%3A-master-and-maverick',
]

const browser = await chromium.launch()
for (const url of urls) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 40000 })
    await page.waitForTimeout(3500)
    await page.evaluate(async () => {
      for (let y = 0; y < 10000; y += 400) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 80)) }
      window.scrollTo(0, 0)
    })
    await page.waitForTimeout(1500)
    const data = await page.evaluate(() => {
      const imgs = Array.from(document.querySelectorAll('img'))
        .filter(i => i.src && i.src.includes('wixstatic.com/media') && i.naturalWidth > 100)
        .map(i => {
          const m = i.src.match(/\/media\/([^/]+)\//)
          return { id: m?.[1], w: i.naturalWidth, h: i.naturalHeight, y: Math.round(i.getBoundingClientRect().top + window.scrollY) }
        })
      const videos = Array.from(document.querySelectorAll('video, iframe'))
        .map(v => ({ tag: v.tagName, src: v.src || v.currentSrc, poster: v.poster, title: v.title, y: Math.round(v.getBoundingClientRect().top + window.scrollY) }))
      const audios = Array.from(document.querySelectorAll('audio'))
        .map(a => ({ src: a.src || a.currentSrc, y: Math.round(a.getBoundingClientRect().top + window.scrollY) }))
      // Look for any link to video CDNs in HTML
      const html = document.documentElement.innerHTML
      const videoUrls = [...new Set((html.match(/https?:\/\/[^"' )]+\.(mp4|webm|m3u8)[^"']*/g) || []).slice(0, 5))]
      const audioUrls = [...new Set((html.match(/https?:\/\/[^"' )]+\.(mp3|m4a|webm|ogg|wav)[^"']*/g) || []).slice(0, 5))]
      // Vimeo/youtube iframes
      const vimeoYoutube = [...new Set([...(html.match(/https?:\/\/(player\.vimeo\.com|www\.youtube\.com|youtu\.be)[^"' )]+/g) || [])].slice(0, 5))]
      return { imgs, videos, audios, videoUrls, audioUrls, vimeoYoutube }
    })
    console.log('\n===', url.split('/shigorika').pop())
    console.log('  images:', data.imgs.length)
    for (const i of data.imgs) console.log('    ', `y=${i.y}`, i.id, `(${i.w}x${i.h})`)
    if (data.videos.length) { console.log('  videos:'); for (const v of data.videos) console.log('    ', v) }
    if (data.audios.length) { console.log('  audios:'); for (const a of data.audios) console.log('    ', a) }
    if (data.videoUrls.length) { console.log('  video urls in html:'); for (const u of data.videoUrls) console.log('    ', u) }
    if (data.audioUrls.length) { console.log('  audio urls in html:'); for (const u of data.audioUrls) console.log('    ', u) }
    if (data.vimeoYoutube.length) { console.log('  vimeo/youtube:'); for (const u of data.vimeoYoutube) console.log('    ', u) }
  } catch (e) {
    console.log('===', url, 'ERROR:', e.message.split('\n')[0])
  }
  await page.close()
}
await browser.close()
