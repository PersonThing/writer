import { test, expect } from './fixtures.js'

test.describe('statuses', () => {
  test('GET returns the seeded defaults in order', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const res = await alice.get('/api/statuses')
    const statuses = await res.json()
    expect(statuses.map((s) => s.id)).toEqual(['draft', 'revising', 'ready', 'archived'])
  })

  test('POST replaces the status list wholesale', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    const next = [
      { id: 'wip', label: 'WIP', color: '#123456' },
      { id: 'shipped', label: 'Shipped', color: '#abcdef' },
    ]
    const putRes = await alice.post('/api/statuses', { data: { statuses: next } })
    expect(putRes.ok()).toBeTruthy()

    const got = await (await alice.get('/api/statuses')).json()
    expect(got.map((s) => ({ id: s.id, label: s.label, color: s.color }))).toEqual(next)
  })
})
