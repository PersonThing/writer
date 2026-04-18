import { test, expect } from './fixtures.js'

test.describe('auth', () => {
  test('unauthed /api/* returns 401', async ({ db, request }) => {
    const res = await request.post('/api/scan-directory')
    expect(res.status()).toBe(401)
  })

  test('test-login creates a user and seeds default statuses', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')

    const meRes = await alice.get('/auth/me')
    expect(meRes.ok()).toBeTruthy()
    const me = await meRes.json()
    expect(me.email).toBe('alice@test.local')

    const statusRes = await alice.get('/api/statuses')
    expect(statusRes.ok()).toBeTruthy()
    const statuses = await statusRes.json()
    expect(statuses.length).toBe(4)
    expect(statuses.map((s) => s.id)).toEqual(['draft', 'revising', 'ready', 'archived'])
  })

  test('logout clears the session', async ({ db, asUser }) => {
    const alice = await asUser('alice@test.local')
    await alice.post('/auth/logout')

    const meRes = await alice.get('/auth/me')
    expect(meRes.status()).toBe(401)
  })
})
