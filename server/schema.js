import {
  pgTable,
  serial,
  integer,
  text,
  smallint,
  timestamp,
  varchar,
  json,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name'),
  picture: text('picture'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
})

export const stories = pgTable(
  'stories',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    storyOrder: integer('story_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userSlugUnique: uniqueIndex('stories_user_slug_idx').on(t.userId, t.slug),
    userIdx: index('stories_user_idx').on(t.userId),
  }),
)

export const files = pgTable(
  'files',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    content: text('content').notNull().default(''),
    status: text('status').notNull().default(''),
    quality: smallint('quality').notNull().default(0),
    sortOrder: integer('sort_order').notNull().default(0),
    storyId: integer('story_id').references(() => stories.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    modifiedAt: timestamp('modified_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userPathUnique: uniqueIndex('files_user_path_idx').on(t.userId, t.path),
    userStoryIdx: index('files_user_story_idx').on(t.userId, t.storyId),
  }),
)

// Persists user-created empty folders so they survive even before any
// file exists in them. Folders with files are still derived implicitly
// from files.path prefixes; this table is the union partner that keeps
// freshly-created empty folders visible. `sortOrder` is the manual
// drag-order among siblings of the same parent.
export const folders = pgTable(
  'folders',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    path: text('path').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => ({
    userPathUnique: uniqueIndex('folders_user_path_idx').on(t.userId, t.path),
    userIdx: index('folders_user_idx').on(t.userId),
  }),
)

export const statuses = pgTable(
  'statuses',
  {
    id: serial('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    statusId: text('status_id').notNull(),
    label: text('label').notNull(),
    color: text('color').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => ({
    userStatusUnique: uniqueIndex('statuses_user_status_idx').on(t.userId, t.statusId),
  }),
)

// connect-pg-simple's session table — defined here so migrations create it.
export const session = pgTable(
  'session',
  {
    sid: varchar('sid').primaryKey(),
    sess: json('sess').notNull(),
    expire: timestamp('expire', { precision: 6 }).notNull(),
  },
  (t) => ({
    expireIdx: index('idx_session_expire').on(t.expire),
  }),
)
