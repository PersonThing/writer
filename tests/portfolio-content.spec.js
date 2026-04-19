import { test, expect } from './fixtures.js'

test.describe('portfolio content rendering', () => {
  test('piece page H1 matches the source title', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    await expect(page.locator('article.piece .piece-head h1')).toContainText(
      /Azzedine Alaia: Master & Maverick/i,
    )
  })

  test('piece body contains known text from the source', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    await expect(page.locator('article.piece .piece-body')).toContainText('King of Cling')
  })

  test('piece hero image resolves with a 200', async ({ page, request }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    const hero = page.locator('article.piece .hero img').first()
    await expect(hero).toBeVisible()
    const src = await hero.getAttribute('src')
    expect(src).toMatch(/^\/portfolio\/images\//)
    const res = await request.get(src)
    expect(res.status()).toBe(200)
  })

  test('poetry category lists all 7 pieces', async ({ page }) => {
    await page.goto('/poetry')
    const rows = page.locator('.piece-row')
    await expect(rows).toHaveCount(7)
  })

  test('top nav has wordmark + Work dropdown + About + Contact', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('.wordmark')).toBeVisible()
    await expect(page.locator('.work-trigger')).toHaveText(/Work/)
    await expect(page.getByRole('link', { name: 'About' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible()
  })

  test('Work dropdown opens and lists all categories', async ({ page }) => {
    await page.goto('/')
    await page.locator('.work-trigger').click()
    const dropdown = page.locator('.work-dropdown')
    await expect(dropdown).toBeVisible()
    await expect(dropdown.locator('a')).toHaveCount(6)
    await expect(dropdown.getByText('Fashion Editorial')).toBeVisible()
    await expect(dropdown.getByText('Copywriting')).toBeVisible()
  })

  test('piece page renders markdown (paragraphs present)', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    const body = page.locator('article.piece .piece-body')
    const paragraphs = await body.locator('p').count()
    expect(paragraphs).toBeGreaterThan(3)
  })

  test('copywriting video page renders a <video> element', async ({ page, request }) => {
    await page.goto('/copywriting/grand-seiko-film')
    const video = page.locator('article.piece .piece-body video').first()
    await expect(video).toBeVisible()
    const src = await video.getAttribute('src')
    expect(src).toMatch(/^\/portfolio\/videos\/.+\.mp4$/)
    const res = await request.head(src)
    expect(res.status()).toBe(200)
  })

  test('ek-sher poem renders an <audio> element', async ({ page }) => {
    await page.goto('/poetry/ek-sher')
    const audio = page.locator('article.piece .piece-body audio').first()
    await expect(audio).toBeVisible()
  })

  test('other poems do NOT render audio (stock loop filtered)', async ({ page }) => {
    await page.goto('/poetry/on-writing')
    const audioCount = await page.locator('article.piece audio').count()
    expect(audioCount).toBe(0)
  })

  test('creative-direction gallery page has multiple inline images', async ({ page }) => {
    await page.goto('/creative-direction/ethnicwear-db')
    const images = page.locator('article.piece .piece-body img')
    const count = await images.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('poetry category lists pieces in live-site order', async ({ page }) => {
    await page.goto('/poetry')
    const titles = await page.locator('.piece-row .meta h3').allTextContents()
    // Top 3 must match prod ordering: On Writing, Hannah Banana, My Dad Socks & Gulzar
    expect(titles[0]).toMatch(/On Writing/i)
    expect(titles[1]).toMatch(/Hannah Banana/i)
    expect(titles[2]).toMatch(/Dad/i)
  })

  test('home has a Recommendations section with 4 quotes', async ({ page }) => {
    await page.goto('/')
    const recs = page.locator('#recommendations .rec')
    await expect(recs).toHaveCount(4)
    await expect(page.locator('#recommendations .rec .rec-name').first()).toBeVisible()
  })

  test('Recommendations nav link scrolls to the home section', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Recommendations' }).click()
    // URL stays at "/" (hash anchor is just a scroll target, not a route change)
    const section = page.locator('#recommendations')
    // After smooth-scroll, the section should be in the viewport.
    await page.waitForTimeout(500)
    const inView = await section.evaluate((el) => {
      const r = el.getBoundingClientRect()
      return r.top < window.innerHeight && r.bottom > 0
    })
    expect(inView).toBe(true)
  })

  test('footer has snail, 3 social icons, and current-year copyright', async ({ page }) => {
    await page.goto('/')
    const footer = page.locator('.site-footer')
    await expect(footer.locator('.footer-snail')).toBeVisible()
    await expect(footer.locator('.footer-socials a')).toHaveCount(3)
    const year = new Date().getFullYear()
    await expect(footer).toContainText(`© ${year} Shigorika`)
  })
})
