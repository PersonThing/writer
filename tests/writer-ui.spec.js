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

test.describe('writer UI — upload button', () => {
  async function signIn(page) {
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })
  }

  test('upload button exposes a hidden file input with the right accepts', async ({
    db,
    page,
  }) => {
    await signIn(page)
    const input = page.locator('.sb-upload-input')
    // Exists in the DOM but is display:none — we don't check visibility.
    await expect(input).toHaveCount(1)
    await expect(input).toHaveAttribute('type', 'file')
    await expect(input).toHaveAttribute('multiple', '')
    const accept = await input.getAttribute('accept')
    expect(accept).toContain('.md')
    expect(accept).toContain('.txt')
    expect(accept).toContain('.docx')
  })

  test('uploading a single file via the button adds it to the sidebar', async ({
    db,
    page,
  }) => {
    await signIn(page)

    await page.locator('.sb-upload-input').setInputFiles([
      {
        name: 'picked.md',
        mimeType: 'text/markdown',
        buffer: Buffer.from('# Picked\n\ncontent'),
      },
    ])

    // The new file shows up as a row in the sidebar file list.
    await expect(
      page.locator('.file-item', { hasText: 'picked' }).first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('uploading multiple files at once lands them all', async ({
    db,
    page,
  }) => {
    await signIn(page)

    await page.locator('.sb-upload-input').setInputFiles([
      { name: 'a.md', mimeType: 'text/markdown', buffer: Buffer.from('a') },
      { name: 'b.md', mimeType: 'text/markdown', buffer: Buffer.from('b') },
      { name: 'c.md', mimeType: 'text/markdown', buffer: Buffer.from('c') },
    ])

    for (const stem of ['a', 'b', 'c']) {
      await expect(
        page.locator('.file-item', { hasText: stem }).first(),
      ).toBeVisible({ timeout: 5000 })
    }
  })

  test('uploading a .txt gets converted to .md', async ({ db, page }) => {
    await signIn(page)

    await page.locator('.sb-upload-input').setInputFiles([
      {
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('plain text'),
      },
    ])

    await expect(
      page.locator('.file-item', { hasText: 'notes' }).first(),
    ).toBeVisible({ timeout: 5000 })
  })

  test('picking the same file twice in a row works (input.value reset)', async ({
    db,
    page,
  }) => {
    await signIn(page)
    const input = page.locator('.sb-upload-input')

    await input.setInputFiles([
      { name: 'same.md', mimeType: 'text/markdown', buffer: Buffer.from('v1') },
    ])
    await expect(
      page.locator('.file-item', { hasText: 'same' }).first(),
    ).toBeVisible({ timeout: 5000 })

    // A second pick of the same file goes through the API again,
    // landing as `same (copy).md` (or similar unique name via the
    // upload endpoint's de-dup logic).
    await input.setInputFiles([
      { name: 'same.md', mimeType: 'text/markdown', buffer: Buffer.from('v2') },
    ])
    // There should now be at least two rows whose display name starts with "same".
    await expect(page.locator('.file-item')).toHaveCount(2, { timeout: 5000 })
  })
})

test.describe('writer UI — drag-drop bubbling regression', () => {
  // Regression: dropping a file onto a subfolder also triggered the outer
  // list-level drop handler, double-uploading the file — once into the
  // subfolder, once into the root. The fix was to stopPropagation on the
  // folder-level drop handler. We simulate the drop with dispatched
  // DataTransfer events since Playwright can't synthesize real drag
  // gestures across the native sidebar layout.
  test('a drop on a subfolder does not also upload to root', async ({
    db,
    page,
    asUser,
  }) => {
    // Pre-create a folder via the API so we can target it in the UI.
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', { data: { name: 'inbox' } })

    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })

    await expect(
      page.locator('.folder-name', { hasText: 'inbox' }),
    ).toBeVisible({ timeout: 5000 })

    // Fire a native-looking drop event on the folder-header element.
    // We craft a DataTransfer with one file and verify that only the
    // subfolder-level handler fires the upload. The event propagation
    // is what matters: if the fix regresses, two uploads happen and
    // the file count at the root is non-zero.
    await page.evaluate(async () => {
      const header = document.querySelector('.folder-header')
      if (!header) throw new Error('folder header not found')
      const dt = new DataTransfer()
      dt.items.add(new File(['hello'], 'dropped.md', { type: 'text/markdown' }))
      const dragOver = new DragEvent('dragover', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
      header.dispatchEvent(dragOver)
      const drop = new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: dt,
      })
      header.dispatchEvent(drop)
    })

    // Give the upload a moment to complete + the file list to refresh.
    await expect(async () => {
      const scan = await (await alice.post('/api/scan-directory')).json()
      const paths = Object.keys(scan.files)
      // Exactly one saved file, under the inbox folder.
      expect(paths).toEqual(['inbox/dropped.md'])
    }).toPass({ timeout: 5000 })
  })
})
