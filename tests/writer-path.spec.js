import { test, expect } from './fixtures.js'

test.describe('writer path-based routing', () => {
  test('/writer (unauthed) shows sign-in screen with dev shortcut', async ({ db, page }) => {
    await page.goto('/writer')
    await expect(page.locator('.signin-card')).toBeVisible()
    await expect(page.locator('.signin-card h1')).toHaveText('Writer')
    // Dev shortcut visible because NODE_ENV=test
    await expect(page.locator('.test-signin')).toBeVisible()
    await expect(page.locator('.test-signin-btn').first()).toBeVisible()
  })

  test('canonicalizes /writer to /writer/poetry after login', async ({ db, page }) => {
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    // Auth triggers reload, then TabBar canonicalizes the path.
    await page.waitForURL(/\/writer\/(poetry|stories)$/, { timeout: 5000 })
    await expect(page).toHaveURL('/writer/poetry')
  })

  test('clicking the Short stories tab updates path without reload', async ({ db, page }) => {
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })

    let loads = 0
    page.on('load', () => loads++)

    await page.locator('.tab-btn', { hasText: 'Short stories' }).click()
    await expect(page).toHaveURL('/writer/stories')
    expect(loads).toBe(0) // SPA navigation, no full reload
  })

  test('reload on /writer/stories keeps the stories tab active', async ({ db, page }) => {
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })

    await page.goto('/writer/stories')
    await expect(
      page.locator('.tab-btn.active', { hasText: 'Short stories' }),
    ).toBeVisible()
  })
})
