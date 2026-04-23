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
    // CategoryPage renders a grid of `.card` tiles (one per piece).
    const cards = page.locator('.cards .card')
    await expect(cards).toHaveCount(7)
  })

  test('top nav has wordmark + Work dropdown + About + Contact', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('.wordmark')).toBeVisible()
    await expect(page.locator('.work-menu .dropdown-trigger')).toHaveText(/Work/)
    await expect(page.getByRole('link', { name: 'About' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Contact' })).toBeVisible()
  })

  test('Work dropdown opens and lists all categories', async ({ page }) => {
    await page.goto('/')
    await page.locator('.work-menu .dropdown-trigger').click()
    const dropdown = page.locator('.work-menu .dropdown-panel')
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
    // Copywriting pieces render as a split layout; the vertical video
    // lives inside `.cw-split-media` rather than the generic piece body.
    const video = page.locator('.cw-split-media video').first()
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
    // Creative-direction pieces render via CdPiece.svelte with a
    // sidebar + gallery column; grab images from the gallery only.
    const images = page.locator('.cd-a-gallery img')
    const count = await images.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('poetry category lists pieces in live-site order', async ({ page }) => {
    await page.goto('/poetry')
    const titles = await page.locator('.cards .card h3').allTextContents()
    // Top 3 must match prod ordering: On Writing, Hannah Banana, My Dad Socks & Gulzar
    expect(titles[0]).toMatch(/On Writing/i)
    expect(titles[1]).toMatch(/Hannah Banana/i)
    expect(titles[2]).toMatch(/Dad/i)
  })

  test('home has a Recommendations section with 4 quotes', async ({ page }) => {
    await page.goto('/')
    const recs = page.locator('#recommendations .pull')
    await expect(recs).toHaveCount(4)
    await expect(
      page.locator('#recommendations .pull figcaption strong').first(),
    ).toBeVisible()
  })

  test('Recommendations nav link scrolls to the home section', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('link', { name: 'Recommendations' }).click()
    // URL stays at "/" (hash anchor is just a scroll target, not a route change)
    const section = page.locator('#recommendations')
    // The smooth scroll is async; poll until the section enters the
    // viewport (default 5s timeout).
    await expect
      .poll(async () =>
        section.evaluate((el) => {
          const r = el.getBoundingClientRect()
          return r.top < window.innerHeight && r.bottom > 0
        }),
      )
      .toBe(true)
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
