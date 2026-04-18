import { test as base, expect } from '@playwright/test'
import pg from 'pg'

const pool = new pg.Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgres://writer:writer@localhost:5434/writer_dev',
})

export const test = base.extend({
  // Truncate user-owned tables before each test.
  // `session` is managed by connect-pg-simple; leaving it alone is fine since
  // tests log in with fresh cookies anyway.
  db: async ({}, use) => {
    await pool.query(
      'TRUNCATE users, stories, files, statuses RESTART IDENTITY CASCADE',
    )
    await use(pool)
  },

  // Login helper — returns a Playwright APIRequestContext already carrying the session cookie.
  asUser: async ({ playwright }, use) => {
    const contexts = []
    const factory = async (email) => {
      const ctx = await playwright.request.newContext({
        baseURL: 'http://localhost:3456',
      })
      const res = await ctx.post('/auth/test-login', { data: { email } })
      if (!res.ok()) {
        throw new Error(`test-login failed for ${email}: ${res.status()} ${await res.text()}`)
      }
      contexts.push(ctx)
      return ctx
    }
    await use(factory)
    for (const c of contexts) await c.dispose()
  },
})

export { expect }
