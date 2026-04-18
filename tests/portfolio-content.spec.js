import { test, expect } from './fixtures.js'

test.describe('portfolio content rendering', () => {
  test('piece page H1 matches the source title', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    await expect(page.locator('article.piece .piece-body h1').first()).toContainText(
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
})
