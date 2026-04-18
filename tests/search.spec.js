import { test, expect } from './fixtures.js'

test.describe('search', () => {
  test('ilike content match, scoped to user', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a.md', content: 'the quick brown fox' } })
    await alice.post('/api/write-file', { data: { path: 'b.md', content: 'a lazy dog' } })

    const res = await (
      await alice.post('/api/search', { data: { query: 'brown' } })
    ).json()
    expect(res.matches).toEqual(['a.md'])
  })

  test('case-insensitive match', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a.md', content: 'Hello World' } })
    const res = await (
      await alice.post('/api/search', { data: { query: 'hello' } })
    ).json()
    expect(res.matches).toEqual(['a.md'])
  })

  test('empty query returns no matches', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/api/write-file', { data: { path: 'a.md', content: 'stuff' } })
    const res = await (await alice.post('/api/search', { data: { query: '' } })).json()
    expect(res.matches).toEqual([])
  })
})
