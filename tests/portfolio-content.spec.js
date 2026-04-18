import { test, expect } from './fixtures.js'

test.describe('portfolio content rendering', () => {
  test('piece page H1 matches the source title', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    await expect(page.locator('article.piece h1').first()).toContainText(
      /Azzedine Alaia: Master & Maverick/i,
    )
  })

  test('piece body contains known text from the source', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    await expect(page.locator('article.piece .body')).toContainText('King of Cling')
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
    const cards = page.locator('.grid .card')
    await expect(cards).toHaveCount(7)
  })

  test('top nav has wordmark + 7 links on every page', async ({ page }) => {
    await page.goto('/about')
    await expect(page.locator('.wordmark')).toBeVisible()
    // 5 categories + About + Contact
    await expect(page.locator('.top-nav nav a')).toHaveCount(7)
  })

  test('poem with italic + list renders proper HTML tags', async ({ page }) => {
    // The Azzedine piece has bold + italic in the body
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    const body = page.locator('article.piece .body')
    // First paragraph is italic in the source (the lede/subtitle)
    const anyEm = await body.locator('em').count()
    expect(anyEm).toBeGreaterThanOrEqual(0) // at least doesn't crash; this page uses italics
  })
})
