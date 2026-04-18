import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as schema from './schema.js'

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL is not set.')
  process.exit(1)
}

export const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
export const db = drizzle(pool, { schema })
export { schema }
