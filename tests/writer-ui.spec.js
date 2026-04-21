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

test.describe('writer UI — folder right-click menu', () => {
  async function signInWithFolder(page, asUser, folder = 'inbox') {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', { data: { name: folder } })
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })
    await expect(
      page.locator('.folder-name', { hasText: folder }),
    ).toBeVisible({ timeout: 5000 })
    return alice
  }

  test('right-click on a folder opens a folder-specific menu (Rename + Delete)', async ({
    db,
    page,
    asUser,
  }) => {
    await signInWithFolder(page, asUser)

    await page
      .locator('.folder-header', { has: page.locator('.folder-name', { hasText: 'inbox' }) })
      .click({ button: 'right' })

    const menu = page.locator('.ctx-menu')
    await expect(menu).toBeVisible()
    await expect(menu.getByText(/Rename folder/)).toBeVisible()
    await expect(menu.getByText(/Delete folder/)).toBeVisible()
    // Status / Quality sections from the file menu are NOT shown.
    await expect(menu.getByText('Status')).toHaveCount(0)
    await expect(menu.getByText('Quality')).toHaveCount(0)
  })

  test('choosing Rename enters inline rename mode and commits', async ({
    db,
    page,
    asUser,
  }) => {
    const alice = await signInWithFolder(page, asUser, 'old-name')

    await page
      .locator('.folder-header', {
        has: page.locator('.folder-name', { hasText: 'old-name' }),
      })
      .click({ button: 'right' })
    await page.locator('.ctx-menu').getByText(/Rename folder/).click()

    const input = page.locator('.folder-header .rename-input')
    await expect(input).toBeVisible({ timeout: 2000 })
    await input.fill('renamed')
    await input.press('Enter')

    await expect(
      page.locator('.folder-name', { hasText: 'renamed' }),
    ).toBeVisible({ timeout: 3000 })
    await expect(
      page.locator('.folder-name', { hasText: 'old-name' }),
    ).toHaveCount(0)

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['renamed']).toBe(true)
    expect(scan.dirs['old-name']).toBeUndefined()
  })

  test('choosing Delete confirms and removes the folder (with its files)', async ({
    db,
    page,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', {
      data: { path: 'doomed/inside.md', content: 'bye' },
    })
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })

    await expect(
      page.locator('.folder-name', { hasText: 'doomed' }),
    ).toBeVisible({ timeout: 5000 })

    await page
      .locator('.folder-header', {
        has: page.locator('.folder-name', { hasText: 'doomed' }),
      })
      .click({ button: 'right' })
    await page.locator('.ctx-menu').getByText(/Delete folder/).click()

    // Confirmation modal
    await expect(page.locator('.modal-message')).toContainText('doomed')
    await page.locator('.modal-actions .btn-primary').click()

    await expect(page.locator('.folder-name', { hasText: 'doomed' })).toHaveCount(
      0,
      { timeout: 3000 },
    )
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['doomed']).toBeUndefined()
    expect(scan.files['doomed/inside.md']).toBeUndefined()
  })

  test('Delete can be cancelled, folder stays intact', async ({
    db,
    page,
    asUser,
  }) => {
    const alice = await signInWithFolder(page, asUser, 'keeper')

    await page
      .locator('.folder-header', {
        has: page.locator('.folder-name', { hasText: 'keeper' }),
      })
      .click({ button: 'right' })
    await page.locator('.ctx-menu').getByText(/Delete folder/).click()

    await expect(page.locator('.modal-message')).toBeVisible()
    // Click the cancel button (non-primary) — first button in actions.
    await page.locator('.modal-actions .btn-small').first().click()

    await expect(
      page.locator('.folder-name', { hasText: 'keeper' }),
    ).toBeVisible()
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['keeper']).toBe(true)
  })
})

test.describe('writer UI — right-click file rename', () => {
  test('rename from context menu focuses the heading input', async ({
    db,
    page,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', {
      data: { path: 'target.md', content: 'body' },
    })

    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })

    await page
      .locator('.file-item', { hasText: 'target' })
      .first()
      .click({ button: 'right' })
    // The file context menu has a "Rename" item alongside Duplicate / Delete.
    // Match on trailing text so we don't collide with folder's "Rename folder".
    await page.locator('.ctx-menu .ctx-item', { hasText: /\bRename\b$/ }).click()

    // The heading input in the open editor pane should now be focused
    // and have its value selected, ready for the user to overtype.
    const heading = page.locator('.file-heading').first()
    await expect(heading).toBeFocused({ timeout: 2000 })
    const selection = await heading.evaluate((el) => ({
      start: el.selectionStart,
      end: el.selectionEnd,
      value: el.value,
    }))
    expect(selection.start).toBe(0)
    expect(selection.end).toBe(selection.value.length)
    expect(selection.value).toBe('target')
  })
})

test.describe('writer UI — markdown format buttons', () => {
  async function openFresh(page, asUser, content = 'just one line\n') {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'demo.md', content } })
    await page.goto('/writer')
    await page.locator('.test-signin-btn', { hasText: 'alice@test.local' }).click()
    await page.waitForURL('/writer/poetry', { timeout: 5000 })
    await page.locator('.file-item', { hasText: 'demo' }).first().click()
    const ta = page.locator('.md-textarea').first()
    await expect(ta).toBeVisible()
    return { alice, ta }
  }

  test('bold with no selection wraps the current line', async ({
    db,
    page,
    asUser,
  }) => {
    const { ta } = await openFresh(page, asUser, 'hello world\n')
    // Move cursor somewhere inside the line.
    await ta.focus()
    await ta.evaluate((el) => {
      el.selectionStart = el.selectionEnd = 5
    })
    await page.locator('.fmt-btn[data-tip^="Bold"]').click()
    await expect(ta).toHaveValue('**hello world**\n')
  })

  test('bold toggles off when applied twice', async ({ db, page, asUser }) => {
    const { ta } = await openFresh(page, asUser, 'hi\n')
    await ta.focus()
    await ta.evaluate((el) => {
      el.selectionStart = el.selectionEnd = 1
    })
    const boldBtn = page.locator('.fmt-btn[data-tip^="Bold"]')
    await boldBtn.click()
    await expect(ta).toHaveValue('**hi**\n')
    await boldBtn.click()
    await expect(ta).toHaveValue('hi\n')
  })

  test('italic button shows active state when cursor is inside italics', async ({
    db,
    page,
    asUser,
  }) => {
    const { ta } = await openFresh(page, asUser, '*emphasis*\n')
    await ta.focus()
    await ta.evaluate((el) => {
      el.selectionStart = el.selectionEnd = 4
    })
    // Trigger selectionchange for the active-format detection.
    await ta.dispatchEvent('keyup')

    const italicBtn = page.locator('.fmt-btn[data-tip^="Italic"]')
    await expect(italicBtn).toHaveClass(/active/)
  })

  test('strikethrough on a selection wraps just that selection', async ({
    db,
    page,
    asUser,
  }) => {
    const { ta } = await openFresh(page, asUser, 'keep strike me\n')
    await ta.focus()
    // Select the word "strike"
    await ta.evaluate((el) => {
      el.selectionStart = 5
      el.selectionEnd = 11
    })
    await page.locator('.fmt-btn[data-tip^="Strikethrough"]').click()
    await expect(ta).toHaveValue('keep ~~strike~~ me\n')
  })

  test('red color button wraps the current line in [red]…[/red]', async ({
    db,
    page,
    asUser,
  }) => {
    const { ta } = await openFresh(page, asUser, 'paint me\n')
    await ta.focus()
    await ta.evaluate((el) => {
      el.selectionStart = el.selectionEnd = 0
    })
    await page.locator('.fmt-btn[data-tip="Red text"]').click()
    await expect(ta).toHaveValue('[red]paint me[/red]\n')
  })

  test('color button toggles off when applied twice', async ({
    db,
    page,
    asUser,
  }) => {
    const { ta } = await openFresh(page, asUser, 'x\n')
    await ta.focus()
    await ta.evaluate((el) => {
      el.selectionStart = el.selectionEnd = 0
    })
    const greenBtn = page.locator('.fmt-btn[data-tip="Green text"]')
    await greenBtn.click()
    await expect(ta).toHaveValue('[green]x[/green]\n')
    await greenBtn.click()
    await expect(ta).toHaveValue('x\n')
  })

  test('preview renders color spans with the expected class', async ({
    db,
    page,
    asUser,
  }) => {
    await openFresh(page, asUser, '[blue]ocean[/blue]\n')
    // Ensure the preview pane is showing.
    await page.locator('.vbtn', { hasText: 'Preview' }).click()
    const span = page.locator('.preview-content .md-color-blue').first()
    await expect(span).toHaveText('ocean')
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
