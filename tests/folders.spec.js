import { test, expect } from './fixtures.js'

test.describe('folders', () => {
  test('create-folder is a no-op but returns ok', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/create-folder', { data: { name: 'anywhere' } })
    expect(res.ok()).toBeTruthy()
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
})
