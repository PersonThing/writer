import { test, expect } from './fixtures.js'

test.describe('writer UI — deep route loads assets', () => {
  test('navigating directly to /writer/poetry loads the SPA bundle', async ({
    db,
    page,
  }) => {
    // Capture console and network errors to catch the MIME-type regression
    // we hit where /writer/assets/<hash>.js was falling back to the SPA
    // HTML and the browser refused to execute it as a module.
    const consoleErrors = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })
    const failedRequests = []
    page.on('requestfailed', (req) =>
      failedRequests.push(`${req.url()} — ${req.failure()?.errorText}`),
    )

    await page.goto('/writer/poetry')

    // Sign-in screen implies the SPA booted far enough to render Svelte.
    await expect(page.locator('.signin-card')).toBeVisible()

    // No JS or CSS request should have 404ed or been served as HTML.
    expect(consoleErrors.filter((e) => /MIME type/i.test(e))).toEqual([])
    expect(failedRequests).toEqual([])
  })
})

test.describe('writer UI — folder creation', () => {
  test('clicking "New folder" creates a visible folder in the sidebar', async ({
    db,
    page,
  }) => {
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })

    // Pre-flight: the sidebar renders without the drafts folder.
    await expect(page.locator('.folder-name', { hasText: 'drafts' })).toHaveCount(0)

    // Feed the modalPrompt a folder name, then click "New folder".
    page.once('dialog', (d) => d.accept('drafts'))
    await page.locator('.sb-icon-btn[title="New folder"]').click()

    // The custom prompt (ModalDialog, not window.prompt) renders an input.
    // We typed nothing via browser prompt, so handle our custom modal:
    const modalInput = page.locator('.modal-input')
    if (await modalInput.isVisible({ timeout: 500 }).catch(() => false)) {
      await modalInput.fill('drafts')
      await page.locator('.modal-actions .btn-primary').click()
    }

    // The folder appears in the sidebar without requiring a file to be
    // inside it.
    await expect(
      page.locator('.folder-name', { hasText: 'drafts' }),
    ).toBeVisible({ timeout: 5000 })
  })
})
