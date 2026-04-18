import { test, expect } from './fixtures.js'

test.describe('multi-user isolation', () => {
  test('users only see their own files', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')

    await alice.post('/api/write-file', { data: { path: 'alice-only.md', content: 'secret' } })
    await bob.post('/api/write-file', { data: { path: 'bob-only.md', content: 'mine' } })

    const aliceScan = await (await alice.post('/api/scan-directory')).json()
    const bobScan = await (await bob.post('/api/scan-directory')).json()

    expect(Object.keys(aliceScan.files)).toEqual(['alice-only.md'])
    expect(Object.keys(bobScan.files)).toEqual(['bob-only.md'])
  })

  test('bob cannot read, rename, or delete alice files', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')

    await alice.post('/api/write-file', { data: { path: 'alice.md', content: 'hers' } })

    // Read returns empty (same shape as not-found)
    const readRes = await (await bob.post('/api/read-file', { data: { path: 'alice.md' } })).json()
    expect(readRes.content).toBe('')

    // Rename affects 0 rows — Alice's file stays put
    await bob.post('/api/rename-file', {
      data: { oldPath: 'alice.md', newPath: 'hacked.md' },
    })
    const aliceScan = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(aliceScan.files)).toEqual(['alice.md'])

    // Delete affects 0 rows
    await bob.post('/api/delete-file', { data: { path: 'alice.md' } })
    const aliceScan2 = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(aliceScan2.files)).toEqual(['alice.md'])
  })

  test('bob set-meta does not touch alice file', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')

    await alice.post('/api/write-file', { data: { path: 'a.md', content: 'x' } })
    await alice.post('/api/set-meta', {
      data: { path: 'a.md', status: 'draft', quality: 3 },
    })

    await bob.post('/api/set-meta', {
      data: { path: 'a.md', status: 'archived', quality: 1 },
    })

    const aliceScan = await (await alice.post('/api/scan-directory')).json()
    expect(aliceScan.files['a.md'].status).toBe('draft')
    expect(aliceScan.files['a.md'].quality).toBe(3)
  })

  test('statuses are per-user', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')

    await alice.post('/api/statuses', {
      data: { statuses: [{ id: 'custom', label: 'Custom', color: '#fff' }] },
    })

    const bobStatuses = await (await bob.get('/api/statuses')).json()
    // Bob still has the defaults
    expect(bobStatuses.map((s) => s.id)).toEqual(['draft', 'revising', 'ready', 'archived'])
  })
})
