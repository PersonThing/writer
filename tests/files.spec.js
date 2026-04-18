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
})
