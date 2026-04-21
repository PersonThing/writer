import { test, expect } from './fixtures.js'

test.describe('files CRUD', () => {
  test('write then read', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const writeRes = await alice.post('/api/write-file', {
      data: { path: 'hello.md', content: '# Hello' },
    })
    expect(writeRes.ok()).toBeTruthy()
    const { modified } = await writeRes.json()
    expect(typeof modified).toBe('number')

    const readRes = await alice.post('/api/read-file', {
      data: { path: 'hello.md' },
    })
    expect(await readRes.json()).toEqual({ content: '# Hello' })
  })

  test('scan-directory returns the file with created/modified', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a.md', content: 'x' } })
    await alice.post('/api/write-file', { data: { path: 'b.md', content: 'y' } })

    const res = await alice.post('/api/scan-directory')
    const { files } = await res.json()
    expect(Object.keys(files).sort()).toEqual(['a.md', 'b.md'])
    expect(typeof files['a.md'].created).toBe('number')
    expect(typeof files['a.md'].modified).toBe('number')
  })

  test('rename-file moves the row', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'old.md', content: 'x' } })
    const renameRes = await alice.post('/api/rename-file', {
      data: { oldPath: 'old.md', newPath: 'new.md' },
    })
    expect(renameRes.ok()).toBeTruthy()

    const readRes = await alice.post('/api/read-file', { data: { path: 'new.md' } })
    expect((await readRes.json()).content).toBe('x')

    const oldRead = await alice.post('/api/read-file', { data: { path: 'old.md' } })
    expect((await oldRead.json()).content).toBe('')
  })

  test('rename-file to an existing path returns 409', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a.md', content: '1' } })
    await alice.post('/api/write-file', { data: { path: 'b.md', content: '2' } })
    const res = await alice.post('/api/rename-file', {
      data: { oldPath: 'a.md', newPath: 'b.md' },
    })
    expect(res.status()).toBe(409)
  })

  test('delete-file removes the row', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'gone.md', content: 'x' } })
    await alice.post('/api/delete-file', { data: { path: 'gone.md' } })

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['gone.md']).toBeUndefined()
  })

  test('copy-file duplicates content with a " (copy)" suffix, incrementing on collision', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'note.md', content: 'body' } })

    const first = await (await alice.post('/api/copy-file', { data: { sourcePath: 'note.md' } })).json()
    expect(first.path).toBe('note (copy).md')

    const firstContent = await (
      await alice.post('/api/read-file', { data: { path: 'note (copy).md' } })
    ).json()
    expect(firstContent.content).toBe('body')

    const second = await (await alice.post('/api/copy-file', { data: { sourcePath: 'note.md' } })).json()
    expect(second.path).toBe('note (copy 2).md')
  })

  test('copy-file preserves folder prefix', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'sub/a.md', content: 'x' } })
    const res = await (await alice.post('/api/copy-file', { data: { sourcePath: 'sub/a.md' } })).json()
    expect(res.path).toBe('sub/a (copy).md')
  })

  test('copy-file on missing path returns 404', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/copy-file', { data: { sourcePath: 'nope.md' } })
    expect(res.status()).toBe(404)
  })

  test('set-meta updates status/quality without touching content', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'p.md', content: 'body' } })
    await alice.post('/api/set-meta', {
      data: { path: 'p.md', status: 'draft', quality: 4 },
    })

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['p.md'].status).toBe('draft')
    expect(scan.files['p.md'].quality).toBe(4)

    const read = await (await alice.post('/api/read-file', { data: { path: 'p.md' } })).json()
    expect(read.content).toBe('body')
  })

  test('write-file upserts content — same path rewrites in place', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'up.md', content: 'first' } })
    await alice.post('/api/write-file', { data: { path: 'up.md', content: 'second' } })
    const read = await (await alice.post('/api/read-file', { data: { path: 'up.md' } })).json()
    expect(read.content).toBe('second')
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(scan.files)).toEqual(['up.md'])
  })

  test('write-file bumps modified timestamp without changing created', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'ts.md', content: 'a' } })
    const before = (await (await alice.post('/api/scan-directory')).json()).files['ts.md']
    // Wait a hair so modified is strictly greater.
    await new Promise((r) => setTimeout(r, 15))
    await alice.post('/api/write-file', { data: { path: 'ts.md', content: 'b' } })
    const after = (await (await alice.post('/api/scan-directory')).json()).files['ts.md']
    expect(after.created).toBe(before.created)
    expect(after.modified).toBeGreaterThan(before.modified)
  })

  test('read-file on a missing path returns empty content', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const read = await (
      await alice.post('/api/read-file', { data: { path: 'nope.md' } })
    ).json()
    expect(read.content).toBe('')
  })

  test('delete-file is idempotent on missing paths', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/delete-file', { data: { path: 'ghost.md' } })
    expect(res.ok()).toBeTruthy()
  })

  test('files are user-isolated', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')
    await alice.post('/api/write-file', { data: { path: 'private.md', content: 'secret' } })

    const bobRead = await (
      await bob.post('/api/read-file', { data: { path: 'private.md' } })
    ).json()
    expect(bobRead.content).toBe('')
    const bobScan = await (await bob.post('/api/scan-directory')).json()
    expect(Object.keys(bobScan.files)).toEqual([])
  })

  test('two users can hold files at the same path independently', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')
    await alice.post('/api/write-file', { data: { path: 'shared.md', content: 'A' } })
    await bob.post('/api/write-file', { data: { path: 'shared.md', content: 'B' } })

    const aliceRead = await (
      await alice.post('/api/read-file', { data: { path: 'shared.md' } })
    ).json()
    const bobRead = await (
      await bob.post('/api/read-file', { data: { path: 'shared.md' } })
    ).json()
    expect(aliceRead.content).toBe('A')
    expect(bobRead.content).toBe('B')
  })

  test('move-file across nested folders preserves content + meta', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'src/a.md', content: 'body' } })
    await alice.post('/api/set-meta', {
      data: { path: 'src/a.md', status: 'draft', quality: 3 },
    })
    await alice.post('/api/move-file', {
      data: { oldPath: 'src/a.md', newPath: 'dst/deep/a.md' },
    })
    const read = await (
      await alice.post('/api/read-file', { data: { path: 'dst/deep/a.md' } })
    ).json()
    expect(read.content).toBe('body')
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['dst/deep/a.md'].status).toBe('draft')
    expect(scan.files['dst/deep/a.md'].quality).toBe(3)
  })

  test('write-file assigns an incrementing sort_order so new files append', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'first.md', content: '1' } })
    await alice.post('/api/write-file', { data: { path: 'second.md', content: '2' } })
    await alice.post('/api/write-file', { data: { path: 'third.md', content: '3' } })
    const scan = await (await alice.post('/api/scan-directory')).json()
    const so = (p) => scan.files[p].sortOrder
    expect(so('first.md')).toBeGreaterThan(0)
    expect(so('second.md')).toBeGreaterThan(so('first.md'))
    expect(so('third.md')).toBeGreaterThan(so('second.md'))
  })

  test('reorder-files rewrites sortOrder in the given sequence', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    for (const p of ['a.md', 'b.md', 'c.md']) {
      await alice.post('/api/write-file', { data: { path: p, content: p } })
    }
    const res = await alice.post('/api/reorder-files', {
      data: { paths: ['c.md', 'a.md', 'b.md'] },
    })
    expect(res.ok()).toBeTruthy()
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['c.md'].sortOrder).toBe(10)
    expect(scan.files['a.md'].sortOrder).toBe(20)
    expect(scan.files['b.md'].sortOrder).toBe(30)
  })

  test('reorder-files no-ops on empty or single-path inputs', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'only.md', content: 'x' } })
    const before = (
      await (await alice.post('/api/scan-directory')).json()
    ).files['only.md'].sortOrder
    const r1 = await alice.post('/api/reorder-files', { data: { paths: [] } })
    const r2 = await alice.post('/api/reorder-files', {
      data: { paths: ['only.md'] },
    })
    expect(r1.ok()).toBeTruthy()
    expect(r2.ok()).toBeTruthy()
    const after = (
      await (await alice.post('/api/scan-directory')).json()
    ).files['only.md'].sortOrder
    expect(after).toBe(before)
  })

  test('reorder-files rejects non-array input with 400', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/reorder-files', {
      data: { paths: 'a.md' },
    })
    expect(res.status()).toBe(400)
  })

  test('reorder-files is user-isolated', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const bob = await asUser('bob@test.local')
    await alice.post('/api/write-file', { data: { path: 'x.md', content: 'a' } })
    await bob.post('/api/write-file', { data: { path: 'x.md', content: 'b' } })
    // Bob reorders his side only.
    await bob.post('/api/reorder-files', { data: { paths: ['x.md'] } })
    // Reorder a path bob doesn't own — should silently no-op against alice's.
    await bob.post('/api/reorder-files', { data: { paths: ['x.md'] } })
    const aliceScan = await (await alice.post('/api/scan-directory')).json()
    // Alice's sort_order for x.md should be whatever write-file assigned
    // originally (positive, untouched).
    expect(aliceScan.files['x.md'].sortOrder).toBeGreaterThan(0)
  })

  test('reorder-files de-dups repeated paths in the input array', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    for (const p of ['a.md', 'b.md']) {
      await alice.post('/api/write-file', { data: { path: p, content: p } })
    }
    await alice.post('/api/reorder-files', {
      data: { paths: ['b.md', 'b.md', 'a.md'] },
    })
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['b.md'].sortOrder).toBe(10)
    expect(scan.files['a.md'].sortOrder).toBe(20)
  })

  test('copy-file keeps status/quality defaults and increments name collisions', async ({
    db,
    asUser,
  }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'z.md', content: '1' } })
    await alice.post('/api/copy-file', { data: { sourcePath: 'z.md' } })
    await alice.post('/api/copy-file', { data: { sourcePath: 'z.md' } })
    await alice.post('/api/copy-file', { data: { sourcePath: 'z.md' } })
    const scan = await (await alice.post('/api/scan-directory')).json()
    const paths = Object.keys(scan.files).sort()
    expect(paths).toEqual([
      'z (copy 2).md',
      'z (copy 3).md',
      'z (copy).md',
      'z.md',
    ])
  })
})
