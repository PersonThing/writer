import { test, expect } from './fixtures.js'

test.describe('stories', () => {
  test('create-story seeds _plot.md and _bible.md', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/create-story', { data: { name: 'My Novel' } })
    expect(res.ok()).toBeTruthy()

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['_stories/my-novel/_plot.md']).toBeDefined()
    expect(scan.files['_stories/my-novel/_bible.md']).toBeDefined()

    const plot = await (
      await alice.post('/api/read-file', { data: { path: '_stories/my-novel/_plot.md' } })
    ).json()
    expect(plot.content).toContain('notes: []')
    expect(plot.content).toContain('# Plot Board')
  })

  test('creating a story with the same slug returns 409', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-story', { data: { name: 'Saga' } })
    const dup = await alice.post('/api/create-story', { data: { name: 'saga' } })
    expect(dup.status()).toBe(409)
  })

  test('delete-folder on a story prefix cascades files', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-story', { data: { name: 'Temp' } })
    await alice.post('/api/write-file', {
      data: { path: '_stories/temp/ch1.md', content: 'chapter one' },
    })

    await alice.post('/api/delete-folder', { data: { path: '_stories/temp' } })

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(Object.keys(scan.files).filter((p) => p.startsWith('_stories/temp'))).toEqual([])
  })
})
