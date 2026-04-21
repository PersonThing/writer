import { test, expect } from './fixtures.js'

test.describe('folders', () => {
  test('create-folder persists the folder so scan shows it', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/create-folder', { data: { name: 'drafts' } })
    expect(res.ok()).toBeTruthy()
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['drafts']).toBe(true)
    expect(Object.keys(scan.files)).toHaveLength(0)
  })

  test('create-folder is idempotent', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', { data: { name: 'inbox' } })
    const res = await alice.post('/api/create-folder', { data: { name: 'inbox' } })
    expect(res.ok()).toBeTruthy()
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['inbox']).toBe(true)
  })

  test('create-folder is user-isolated', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')
    await alice.post('/api/create-folder', { data: { name: 'alice-only' } })
    const scan = await (await bob.post('/api/scan-directory')).json()
    expect(scan.dirs['alice-only']).toBeUndefined()
  })

  test('rename-folder rewrites all child paths', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'oldname/a.md', content: '1' } })
    await alice.post('/api/write-file', { data: { path: 'oldname/b.md', content: '2' } })
    await alice.post('/api/write-file', { data: { path: 'oldname/sub/c.md', content: '3' } })

    const res = await alice.post('/api/rename-folder', {
      data: { oldPath: 'oldname', newPath: 'newname' },
    })
    expect(res.ok()).toBeTruthy()

    const scan = await (await alice.post('/api/scan-directory')).json()
    const paths = Object.keys(scan.files).sort()
    expect(paths).toEqual(['newname/a.md', 'newname/b.md', 'newname/sub/c.md'])
  })

  test('move-file updates path', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'foo.md', content: '1' } })
    await alice.post('/api/move-file', {
      data: { oldPath: 'foo.md', newPath: 'folder/foo.md' },
    })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(scan.files)).toEqual(['folder/foo.md'])
  })

  test('delete-folder removes all children under prefix', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'keep.md', content: '1' } })
    await alice.post('/api/write-file', { data: { path: 'drop/a.md', content: '2' } })
    await alice.post('/api/write-file', { data: { path: 'drop/b.md', content: '3' } })

    const res = await alice.post('/api/delete-folder', { data: { path: 'drop' } })
    expect(res.ok()).toBeTruthy()

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(scan.files)).toEqual(['keep.md'])
  })

  test('delete-folder also removes a persisted empty folder record', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', { data: { name: 'ephemeral' } })
    let scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['ephemeral']).toBe(true)

    await alice.post('/api/delete-folder', { data: { path: 'ephemeral' } })
    scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['ephemeral']).toBeUndefined()
  })

  test('rename-folder moves a persisted empty folder', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', { data: { name: 'old' } })
    await alice.post('/api/rename-folder', {
      data: { oldPath: 'old', newPath: 'renamed' },
    })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['old']).toBeUndefined()
    expect(scan.dirs['renamed']).toBe(true)
  })

  test('create-folder with a nested name exposes all ancestors', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', { data: { name: 'a/b/c' } })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['a']).toBe(true)
    expect(scan.dirs['a/b']).toBe(true)
    expect(scan.dirs['a/b/c']).toBe(true)
  })

  test('create-folder accepts a parent path as the `path` field', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-folder', {
      data: { name: 'child', path: 'parent' },
    })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['parent']).toBe(true)
    expect(scan.dirs['parent/child']).toBe(true)
  })

  test('create-folder rejects empty/whitespace names', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res1 = await alice.post('/api/create-folder', { data: { name: '' } })
    expect(res1.status()).toBe(400)
    const res2 = await alice.post('/api/create-folder', { data: { name: '   ' } })
    expect(res2.status()).toBe(400)
  })

  test('move-file into a new folder creates the folder prefix in scan', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'loose.md', content: 'x' } })
    await alice.post('/api/move-file', {
      data: { oldPath: 'loose.md', newPath: 'archive/2024/loose.md' },
    })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(scan.files)).toEqual(['archive/2024/loose.md'])
    expect(scan.dirs['archive']).toBe(true)
    expect(scan.dirs['archive/2024']).toBe(true)
  })

  test('move-file to an occupied path returns 409', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a.md', content: '1' } })
    await alice.post('/api/write-file', { data: { path: 'sub/a.md', content: '2' } })
    const res = await alice.post('/api/move-file', {
      data: { oldPath: 'a.md', newPath: 'sub/a.md' },
    })
    expect(res.status()).toBe(409)
  })

  test('rename-folder to an occupied prefix returns 409', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a/x.md', content: '1' } })
    await alice.post('/api/write-file', { data: { path: 'b/x.md', content: '2' } })
    const res = await alice.post('/api/rename-folder', {
      data: { oldPath: 'a', newPath: 'b' },
    })
    expect(res.status()).toBe(409)
  })

  test('writing a file under a prefix reveals it without create-folder', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', {
      data: { path: 'deep/nested/path/file.md', content: 'x' },
    })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.dirs['deep']).toBe(true)
    expect(scan.dirs['deep/nested']).toBe(true)
    expect(scan.dirs['deep/nested/path']).toBe(true)
  })
})
