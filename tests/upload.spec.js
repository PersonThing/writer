import { test, expect } from './fixtures.js'

function mdFile(name, content) {
  return { name, mimeType: 'text/markdown', buffer: Buffer.from(content) }
}
function txtFile(name, content) {
  return { name, mimeType: 'text/plain', buffer: Buffer.from(content) }
}

test.describe('upload-files', () => {
  test('md files land with original name and content', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/upload-files', {
      multipart: {
        files: mdFile('poem.md', '# Title\n\nbody'),
        targetFolder: '',
      },
    })
    const body = await res.json()
    expect(body.results).toEqual([{ original: 'poem.md', saved: 'poem.md' }])

    const read = await (await alice.post('/api/read-file', { data: { path: 'poem.md' } })).json()
    expect(read.content).toBe('# Title\n\nbody')
  })

  test('txt files get renamed to .md', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/upload-files', {
      multipart: {
        files: txtFile('notes.txt', 'plain text'),
        targetFolder: '',
      },
    })
    const body = await res.json()
    expect(body.results[0].saved).toBe('notes.md')
  })

  test('unsupported extensions are rejected', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/upload-files', {
      multipart: {
        files: { name: 'rogue.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF') },
        targetFolder: '',
      },
    })
    const body = await res.json()
    expect(body.results[0].skipped).toBe(true)
    expect(body.results[0].error).toContain('Unsupported extension')
  })

  test('name collisions auto-suffix', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/upload-files', {
      multipart: { files: mdFile('dup.md', 'first'), targetFolder: '' },
    })
    const second = await alice.post('/api/upload-files', {
      multipart: { files: mdFile('dup.md', 'second'), targetFolder: '' },
    })
    const body = await second.json()
    expect(body.results[0].saved).toBe('dup-1.md')

    const third = await alice.post('/api/upload-files', {
      multipart: { files: mdFile('dup.md', 'third'), targetFolder: '' },
    })
    expect((await third.json()).results[0].saved).toBe('dup-2.md')
  })

  test('targetFolder puts the file inside it', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/upload-files', {
      multipart: { files: mdFile('p.md', 'x'), targetFolder: 'sub' },
    })
    expect((await res.json()).results[0].saved).toBe('sub/p.md')
  })
})
