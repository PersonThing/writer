import { test, expect } from './fixtures.js'

test.describe('stories', () => {
  test('create-story returns a story row without seeding plot/bible', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.post('/api/create-story', { data: { name: 'My Novel' } })
    expect(res.ok()).toBeTruthy()

    const stories = await (await alice.get('/api/stories')).json()
    expect(stories.map((s) => s.slug)).toContain('my-novel')

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['_stories/my-novel/_plot.md']).toBeUndefined()
    expect(scan.files['_stories/my-novel/_bible.md']).toBeUndefined()
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

  test('writing a chapter under a story auto-links story_id', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-story', { data: { name: 'Bound' } })
    await alice.post('/api/write-file', {
      data: { path: '_stories/bound/ch1.md', content: 'hi' },
    })

    const row = await db.query(
      `SELECT story_id FROM files WHERE path = '_stories/bound/ch1.md'`,
    )
    const storyIdOnFile = row.rows[0]?.story_id
    expect(storyIdOnFile).not.toBeNull()

    const story = await db.query(
      `SELECT id FROM stories WHERE slug = 'bound'`,
    )
    expect(storyIdOnFile).toBe(story.rows[0].id)
  })

  test('nested folders inside a story are scannable', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-story', { data: { name: 'Deep' } })
    await alice.post('/api/create-folder', {
      data: { name: 'part1', path: '_stories/deep' },
    })
    await alice.post('/api/write-file', {
      data: { path: '_stories/deep/part1/scene-a.md', content: 'scene' },
    })

    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['_stories/deep/part1/scene-a.md']).toBeDefined()
    expect(scan.dirs['_stories/deep/part1']).toBeTruthy()
  })

  test('move-to-story moves a poem into the story and sets story_id', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-story', { data: { name: 'Target' } })
    const story = await (await alice.get('/api/stories')).json()
    const targetId = story.find((s) => s.slug === 'target').id

    await alice.post('/api/write-file', {
      data: { path: 'loose-poem.md', content: 'words' },
    })

    const res = await alice.post('/api/move-to-story', {
      data: { sourcePath: 'loose-poem.md', storyId: targetId },
    })
    expect(res.ok()).toBeTruthy()
    const body = await res.json()
    expect(body.path).toBe('_stories/target/loose-poem.md')

    const row = await db.query(
      `SELECT story_id FROM files WHERE path = '_stories/target/loose-poem.md'`,
    )
    expect(row.rows[0].story_id).toBe(targetId)

    // The source path is gone.
    const scan = await (await alice.post('/api/scan-directory')).json()
    expect(scan.files['loose-poem.md']).toBeUndefined()
  })

  test('move-to-story suffixes on filename collision', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/create-story', { data: { name: 'Busy' } })
    const story = await (await alice.get('/api/stories')).json()
    const targetId = story.find((s) => s.slug === 'busy').id

    // Existing chapter at the collision target path.
    await alice.post('/api/write-file', {
      data: { path: '_stories/busy/ch.md', content: 'original' },
    })
    // Source poem with the same basename.
    await alice.post('/api/write-file', {
      data: { path: 'ch.md', content: 'incoming' },
    })

    const res = await alice.post('/api/move-to-story', {
      data: { sourcePath: 'ch.md', storyId: targetId },
    })
    const body = await res.json()
    expect(body.path).toBe('_stories/busy/ch-2.md')
  })
})
