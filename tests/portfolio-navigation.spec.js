import { test, expect } from './fixtures.js'

test.describe('portfolio navigation', () => {
  test('home page renders without hitting /auth/me', async ({ page }) => {
    let hitAuthMe = false
    page.on('request', (req) => {
      if (req.url().endsWith('/auth/me')) hitAuthMe = true
    })
    await page.goto('/')
    await expect(page.locator('.wordmark')).toBeVisible()
    await expect(page.locator('.wordmark')).toHaveText('Shigorika')
    expect(hitAuthMe).toBe(false)
  })

  test('clicking a category link updates path without reloading', async ({ page }) => {
    await page.goto('/')
    let navCount = 0
    page.on('framenavigated', () => navCount++)
    // The initial load already bumped navCount by 1
    const before = navCount

    // Open Work dropdown, then click Fashion Editorial
    await page.locator('.work-menu .dropdown-trigger').click()
    await page
      .locator('.work-menu .dropdown-panel a', { hasText: 'Fashion Editorial' })
      .click()
    await expect(page).toHaveURL('/fashion-editorial')
    // history.pushState fires framenavigated too, so one navigation
    expect(navCount - before).toBeLessThanOrEqual(1)
    await expect(page.locator('article.category h1')).toContainText(/Fashion Editorial/i)
  })

  test('clicking a piece card navigates to the piece page', async ({ page }) => {
    await page.goto('/fashion-editorial')
    await page.locator('.cards .card').first().click()
    await expect(page).toHaveURL(/\/fashion-editorial\/.+/)
    await expect(page.locator('article.piece')).toBeVisible()
  })

  test('browser back button returns to previous page', async ({ page }) => {
    await page.goto('/fashion-editorial')
    await page.locator('.cards .card').first().click()
    await expect(page).toHaveURL(/\/fashion-editorial\/.+/)
    await page.goBack()
    await expect(page).toHaveURL('/fashion-editorial')
  })

  test('deep-link to a piece loads correctly (SPA fallback)', async ({ page }) => {
    await page.goto('/fashion-editorial/azzedine-alaia--master-and-maverick')
    await expect(page.locator('article.piece .piece-head h1')).toContainText(/Azzedine Alaia/i)
  })

  test('unknown path renders the not-found page', async ({ page }) => {
    await page.goto('/nope-not-a-real-path')
    await expect(page.locator('article.notfound h1')).toHaveText('Not found')
  })
})
