import express from 'express'
import path from 'path'
import crypto from 'crypto'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import mammoth from 'mammoth'
import { and, asc, eq, ilike, like, sql } from 'drizzle-orm'
import Anthropic from '@anthropic-ai/sdk'

import { db, schema } from './db.js'
import { sessionMiddleware, requireAuth, mountAuth } from './auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 3456

// Trust Railway's proxy so secure cookies work behind TLS termination.
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1)

app.use(express.json({ limit: '50mb' }))
app.use(sessionMiddleware)

// Auth routes (unprotected)
mountAuth(app)

// Protect everything under /api
app.use('/api', requireAuth)

// Serve the built Svelte frontend
const distPath = path.join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/scan-directory', async (req, res) => {
  const userId = req.session.userId

  const rows = await db
    .select({
      path: schema.files.path,
      status: schema.files.status,
      quality: schema.files.quality,
      sortOrder: schema.files.sortOrder,
      modifiedAt: schema.files.modifiedAt,
      createdAt: schema.files.createdAt,
    })
    .from(schema.files)
    .where(eq(schema.files.userId, userId))

  const files = {}
  const dirSet = new Set()
  for (const r of rows) {
    files[r.path] = {
      status: r.status,
      quality: r.quality,
      sortOrder: r.sortOrder,
      modified: r.modifiedAt.getTime(),
      created: r.createdAt.getTime(),
    }
    // Collect directory prefixes
    const parts = r.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirSet.add(parts.slice(0, i).join('/'))
    }
  }

  // Union persisted empty folders. Also expand their ancestor prefixes
  // so `createFolder('a/b/c')` reveals `a`, `a/b`, and `a/b/c`.
  const folderRows = await db
    .select({ path: schema.folders.path, sortOrder: schema.folders.sortOrder })
    .from(schema.folders)
    .where(eq(schema.folders.userId, userId))
  const folderOrder = {}
  for (const r of folderRows) {
    folderOrder[r.path] = r.sortOrder
    const parts = r.path.split('/')
    for (let i = 1; i <= parts.length; i++) {
      dirSet.add(parts.slice(0, i).join('/'))
    }
  }

  const dirs = {}
  for (const d of dirSet) dirs[d] = true

  res.json({ files, dirs, folderOrder })
})

app.post('/api/search', async (req, res) => {
  const { query } = req.body
  const userId = req.session.userId
  if (!query || !query.trim()) return res.json({ matches: [] })

  const rows = await db
    .select({ path: schema.files.path })
    .from(schema.files)
    .where(
      and(
        eq(schema.files.userId, userId),
        ilike(schema.files.content, `%${query}%`),
      ),
    )

  res.json({ matches: rows.map((r) => r.path) })
})

app.post('/api/read-file', async (req, res) => {
  const { path: filePath } = req.body
  const userId = req.session.userId

  const [row] = await db
    .select({ content: schema.files.content })
    .from(schema.files)
    .where(and(eq(schema.files.userId, userId), eq(schema.files.path, filePath)))
  res.json({ content: row?.content || '' })
})

// Appends a new file at the end of the user's explicit sort order,
// leaving room for reorderings between existing rows.
async function nextSortOrder(tx, userId) {
  const [row] = await tx
    .select({ m: sql`coalesce(max(${schema.files.sortOrder}), 0)` })
    .from(schema.files)
    .where(eq(schema.files.userId, userId))
  return Number(row?.m || 0) + 10
}

// Returns the story_id a path belongs to (by slug prefix under
// `_stories/`), or null for root-level files.
async function resolveStoryIdForPath(tx, userId, filePath) {
  const m = /^_stories\/([^/]+)\//.exec(filePath || '')
  if (!m) return null
  const slug = m[1]
  const [row] = await tx
    .select({ id: schema.stories.id })
    .from(schema.stories)
    .where(and(eq(schema.stories.userId, userId), eq(schema.stories.slug, slug)))
  return row ? row.id : null
}

app.post('/api/write-file', async (req, res) => {
  const { path: filePath, content } = req.body
  const userId = req.session.userId

  const nextSo = await nextSortOrder(db, userId)
  const storyId = await resolveStoryIdForPath(db, userId, filePath)
  const [row] = await db
    .insert(schema.files)
    .values({ userId, path: filePath, content, sortOrder: nextSo, storyId })
    .onConflictDoUpdate({
      target: [schema.files.userId, schema.files.path],
      set: { content, modifiedAt: sql`now()` },
    })
    .returning({ modifiedAt: schema.files.modifiedAt })

  res.json({ modified: row.modifiedAt.getTime() })
})

app.post('/api/delete-file', async (req, res) => {
  const { path: filePath } = req.body
  const userId = req.session.userId
  await db
    .delete(schema.files)
    .where(and(eq(schema.files.userId, userId), eq(schema.files.path, filePath)))
  res.json({ ok: true })
})

app.post('/api/rename-file', async (req, res) => {
  const { oldPath, newPath } = req.body
  const userId = req.session.userId
  try {
    const storyId = await resolveStoryIdForPath(db, userId, newPath)
    await db
      .update(schema.files)
      .set({ path: newPath, storyId, modifiedAt: sql`now()` })
      .where(and(eq(schema.files.userId, userId), eq(schema.files.path, oldPath)))
    res.json({ ok: true })
  } catch (e) {
    if (e.cause?.code === '23505' || e.code === '23505')
      return res.status(409).json({ error: 'A file with that name already exists' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/create-folder', async (req, res) => {
  const userId = req.session.userId
  let { name, path: parentPath } = req.body || {}
  if (typeof name !== 'string' || !name.trim()) {
    return res.status(400).json({ error: 'name is required' })
  }
  // Allow the client to pass either a plain name (treated as top-level)
  // or a full slash-separated path. A `path` field, if present, becomes
  // the parent prefix and `name` is appended.
  const cleanName = name.trim().replace(/^\/+|\/+$/g, '')
  const cleanParent = (parentPath || '').trim().replace(/^\/+|\/+$/g, '')
  const fullPath = cleanParent ? `${cleanParent}/${cleanName}` : cleanName
  if (!fullPath) return res.status(400).json({ error: 'invalid folder path' })

  try {
    // Append to the end of the parent's sibling bucket.
    const siblings = await siblingFolders(db, userId, cleanParent)
    const maxSo = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0)
    const nextSo = maxSo + 10

    await db
      .insert(schema.folders)
      .values({ userId, path: fullPath, sortOrder: nextSo })
      .onConflictDoNothing({
        target: [schema.folders.userId, schema.folders.path],
      })
    res.json({ ok: true, path: fullPath })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// List persisted folders whose parent equals the given path. Used to
// compute the next sort_order slot and to validate cross-parent reorders.
async function siblingFolders(db, userId, parentPath) {
  const rows = await db
    .select({ path: schema.folders.path, sortOrder: schema.folders.sortOrder })
    .from(schema.folders)
    .where(eq(schema.folders.userId, userId))
  return rows.filter((r) => {
    const idx = r.path.lastIndexOf('/')
    const parent = idx === -1 ? '' : r.path.slice(0, idx)
    return parent === parentPath
  })
}

function parentOf(p) {
  const idx = p.lastIndexOf('/')
  return idx === -1 ? '' : p.slice(0, idx)
}

app.post('/api/copy-file', async (req, res) => {
  const { sourcePath } = req.body
  const userId = req.session.userId

  const [src] = await db
    .select({ content: schema.files.content, storyId: schema.files.storyId })
    .from(schema.files)
    .where(and(eq(schema.files.userId, userId), eq(schema.files.path, sourcePath)))
  if (!src) return res.status(404).json({ error: 'File not found' })

  // Find a unique "<stem> (copy).md" / "<stem> (copy N).md" name
  const lastSlash = sourcePath.lastIndexOf('/')
  const folder = lastSlash >= 0 ? sourcePath.slice(0, lastSlash) : ''
  const fileName = lastSlash >= 0 ? sourcePath.slice(lastSlash + 1) : sourcePath
  const dotMd = fileName.endsWith('.md')
  const stem = dotMd ? fileName.slice(0, -3) : fileName

  const existing = await db
    .select({ path: schema.files.path })
    .from(schema.files)
    .where(
      and(
        eq(schema.files.userId, userId),
        like(schema.files.path, folder ? `${folder}/${stem}%` : `${stem}%`),
      ),
    )
  const taken = new Set(existing.map((r) => r.path))

  const build = (suffix) =>
    `${folder ? folder + '/' : ''}${stem}${suffix}.md`
  let candidate = build(' (copy)')
  let i = 2
  while (taken.has(candidate)) {
    candidate = build(` (copy ${i})`)
    i++
  }

  const nextSo = await nextSortOrder(db, userId)
  const [row] = await db
    .insert(schema.files)
    .values({
      userId,
      path: candidate,
      content: src.content,
      storyId: src.storyId,
      sortOrder: nextSo,
    })
    .returning({ path: schema.files.path })

  res.json({ path: row.path })
})

app.post('/api/reorder-files', async (req, res) => {
  const { paths } = req.body || {}
  const userId = req.session.userId
  if (!Array.isArray(paths)) {
    return res.status(400).json({ error: 'paths must be an array' })
  }
  // Empty or single-item arrays are legal no-ops.
  if (paths.length <= 1) return res.json({ ok: true })

  // De-dup defensively — a bad client could submit the same path twice.
  const seen = new Set()
  const unique = []
  for (const p of paths) {
    if (typeof p !== 'string' || seen.has(p)) continue
    seen.add(p)
    unique.push(p)
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < unique.length; i++) {
        await tx
          .update(schema.files)
          .set({ sortOrder: (i + 1) * 10 })
          .where(
            and(
              eq(schema.files.userId, userId),
              eq(schema.files.path, unique[i]),
            ),
          )
      }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Reorder folder siblings. All paths must share the same parent. The
// server rewrites sort_order as (i+1)*10 within that parent bucket.
app.post('/api/reorder-folders', async (req, res) => {
  const { paths } = req.body || {}
  const userId = req.session.userId
  if (!Array.isArray(paths)) {
    return res.status(400).json({ error: 'paths must be an array' })
  }
  if (paths.length <= 1) return res.json({ ok: true })

  const seen = new Set()
  const unique = []
  for (const p of paths) {
    if (typeof p !== 'string' || seen.has(p)) continue
    seen.add(p)
    unique.push(p)
  }

  const firstParent = parentOf(unique[0])
  for (const p of unique) {
    if (parentOf(p) !== firstParent) {
      return res
        .status(400)
        .json({ error: 'all paths must share the same parent folder' })
    }
  }

  try {
    await db.transaction(async (tx) => {
      for (let i = 0; i < unique.length; i++) {
        await tx
          .update(schema.folders)
          .set({ sortOrder: (i + 1) * 10 })
          .where(
            and(
              eq(schema.folders.userId, userId),
              eq(schema.folders.path, unique[i]),
            ),
          )
      }
    })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// Move a folder (and all its descendants — files + subfolders) to a new
// parent. `newParent` === '' means root. Rewrites path prefixes with SQL
// substr, same strategy as rename-folder. Appends to end of target parent.
app.post('/api/move-folder', async (req, res) => {
  const { sourcePath, newParent } = req.body || {}
  const userId = req.session.userId
  if (typeof sourcePath !== 'string' || !sourcePath) {
    return res.status(400).json({ error: 'sourcePath is required' })
  }
  if (typeof newParent !== 'string') {
    return res.status(400).json({ error: 'newParent is required' })
  }
  const name = sourcePath.split('/').pop()
  const destPath = newParent ? `${newParent}/${name}` : name
  if (destPath === sourcePath) return res.json({ ok: true, path: destPath })
  if (
    destPath === sourcePath ||
    destPath.startsWith(sourcePath + '/')
  ) {
    return res.status(400).json({ error: 'cannot move a folder into itself' })
  }

  try {
    await db.transaction(async (tx) => {
      // Collision check.
      const [existing] = await tx
        .select({ path: schema.folders.path })
        .from(schema.folders)
        .where(
          and(
            eq(schema.folders.userId, userId),
            eq(schema.folders.path, destPath),
          ),
        )
      if (existing) {
        throw new Error(`A folder named "${name}" already exists there`)
      }

      // Rewrite descendants: folders + files.
      await tx
        .update(schema.folders)
        .set({
          path: sql`${destPath} || substr(${schema.folders.path}, ${sourcePath.length + 1})`,
        })
        .where(
          and(
            eq(schema.folders.userId, userId),
            like(schema.folders.path, `${sourcePath}/%`),
          ),
        )
      await tx
        .update(schema.files)
        .set({
          path: sql`${destPath} || substr(${schema.files.path}, ${sourcePath.length + 1})`,
        })
        .where(
          and(
            eq(schema.files.userId, userId),
            like(schema.files.path, `${sourcePath}/%`),
          ),
        )

      // Rewrite the folder itself, and give it a sort_order at the tail
      // of the new parent's bucket.
      const siblings = await siblingFolders(tx, userId, newParent)
      const maxSo = siblings.reduce((m, s) => Math.max(m, s.sortOrder || 0), 0)
      await tx
        .update(schema.folders)
        .set({ path: destPath, sortOrder: maxSo + 10 })
        .where(
          and(
            eq(schema.folders.userId, userId),
            eq(schema.folders.path, sourcePath),
          ),
        )
    })
    res.json({ ok: true, path: destPath })
  } catch (e) {
    if (e.cause?.code === '23505' || e.code === '23505') {
      return res
        .status(409)
        .json({ error: 'A folder with that name already exists there' })
    }
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/move-file', async (req, res) => {
  const { oldPath, newPath } = req.body
  const userId = req.session.userId
  try {
    const storyId = await resolveStoryIdForPath(db, userId, newPath)
    await db
      .update(schema.files)
      .set({ path: newPath, storyId, modifiedAt: sql`now()` })
      .where(and(eq(schema.files.userId, userId), eq(schema.files.path, oldPath)))
    res.json({ ok: true })
  } catch (e) {
    if (e.cause?.code === '23505' || e.code === '23505')
      return res.status(409).json({ error: 'A file with that name already exists' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/rename-folder', async (req, res) => {
  const { oldPath, newPath } = req.body
  const userId = req.session.userId
  try {
    await db.transaction(async (tx) => {
      // Rewrite any file paths under the old prefix, and re-resolve
      // story_id from the new path prefix so files that moved into or
      // out of a _stories/<slug>/ branch are correctly re-linked.
      const rows = await tx
        .select({ id: schema.files.id, path: schema.files.path })
        .from(schema.files)
        .where(
          and(
            eq(schema.files.userId, userId),
            like(schema.files.path, `${oldPath}/%`),
          ),
        )
      for (const r of rows) {
        const nextPath = newPath + r.path.slice(oldPath.length)
        const nextStoryId = await resolveStoryIdForPath(tx, userId, nextPath)
        await tx
          .update(schema.files)
          .set({ path: nextPath, storyId: nextStoryId, modifiedAt: sql`now()` })
          .where(eq(schema.files.id, r.id))
      }
      // Rewrite any persisted folder entries under the old prefix
      // (covers both the folder itself and its nested descendants).
      await tx
        .update(schema.folders)
        .set({
          path: sql`${newPath} || substr(${schema.folders.path}, ${oldPath.length + 1})`,
        })
        .where(
          and(
            eq(schema.folders.userId, userId),
            like(schema.folders.path, `${oldPath}/%`),
          ),
        )
      await tx
        .update(schema.folders)
        .set({ path: newPath })
        .where(
          and(
            eq(schema.folders.userId, userId),
            eq(schema.folders.path, oldPath),
          ),
        )
    })
    res.json({ ok: true })
  } catch (e) {
    if (e.cause?.code === '23505')
      return res.status(409).json({ error: 'A file with that name already exists' })
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// STORY API
// ═══════════════════════════════════════════════════════════════════════════

function slugify(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

app.get('/api/stories', async (req, res) => {
  const userId = req.session.userId
  const rows = await db
    .select({
      id: schema.stories.id,
      name: schema.stories.name,
      slug: schema.stories.slug,
      storyOrder: schema.stories.storyOrder,
      preferredModel: schema.stories.preferredModel,
    })
    .from(schema.stories)
    .where(eq(schema.stories.userId, userId))
    .orderBy(asc(schema.stories.storyOrder), asc(schema.stories.id))
  res.json(rows)
})

app.post('/api/create-story', async (req, res) => {
  const { name } = req.body
  const userId = req.session.userId
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })

  const slug = slugify(name)
  try {
    await db
      .insert(schema.stories)
      .values({ userId, name: name.trim(), slug })
      .returning()
    res.json({ ok: true })
  } catch (e) {
    if (e.cause?.code === '23505' || e.code === '23505')
      return res.status(409).json({ error: 'A story with that name already exists' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/delete-folder', async (req, res) => {
  const { path: folderPath } = req.body
  const userId = req.session.userId
  if (!folderPath) return res.status(400).json({ error: 'path is required' })

  // Files under the prefix.
  await db
    .delete(schema.files)
    .where(
      and(
        eq(schema.files.userId, userId),
        like(schema.files.path, `${folderPath}/%`),
      ),
    )

  // Persisted folder entries: the folder itself + any nested descendants.
  await db
    .delete(schema.folders)
    .where(
      and(
        eq(schema.folders.userId, userId),
        eq(schema.folders.path, folderPath),
      ),
    )
  await db
    .delete(schema.folders)
    .where(
      and(
        eq(schema.folders.userId, userId),
        like(schema.folders.path, `${folderPath}/%`),
      ),
    )

  // If it's a story folder, also delete the story row.
  const match = folderPath.match(/^_stories\/([^/]+)$/)
  if (match) {
    const slug = match[1]
    await db
      .delete(schema.stories)
      .where(and(eq(schema.stories.userId, userId), eq(schema.stories.slug, slug)))
  }

  res.json({ ok: true })
})

// Move a file into a story's folder. Computes the destination path as
// `_stories/<slug>/<basename>`, resolves collisions with `-2`, `-3`,
// etc., and atomically updates files.path + files.story_id.
app.post('/api/move-to-story', async (req, res) => {
  const { sourcePath, storyId } = req.body || {}
  const userId = req.session.userId
  if (!sourcePath || !storyId) {
    return res.status(400).json({ error: 'sourcePath and storyId are required' })
  }

  try {
    const [story] = await db
      .select({ id: schema.stories.id, slug: schema.stories.slug })
      .from(schema.stories)
      .where(and(eq(schema.stories.userId, userId), eq(schema.stories.id, storyId)))
    if (!story) return res.status(404).json({ error: 'Story not found' })

    const base = sourcePath.split('/').pop()
    const dotMd = base.endsWith('.md')
    const stem = dotMd ? base.slice(0, -3) : base

    const prefix = `_stories/${story.slug}/`
    const existing = await db
      .select({ path: schema.files.path })
      .from(schema.files)
      .where(
        and(
          eq(schema.files.userId, userId),
          like(schema.files.path, `${prefix}${stem}%`),
        ),
      )
    const taken = new Set(existing.map((r) => r.path))
    let candidate = `${prefix}${stem}.md`
    let i = 2
    while (taken.has(candidate)) {
      candidate = `${prefix}${stem}-${i}.md`
      i++
    }

    await db
      .update(schema.files)
      .set({ path: candidate, storyId: story.id, modifiedAt: sql`now()` })
      .where(and(eq(schema.files.userId, userId), eq(schema.files.path, sourcePath)))

    res.json({ ok: true, path: candidate })
  } catch (e) {
    if (e.cause?.code === '23505' || e.code === '23505')
      return res.status(409).json({ error: 'A file with that name already exists' })
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHTS
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_INSIGHTS_MODEL = 'claude-haiku-4-5-20251001'
const ANTHROPIC_MOCK = process.env.ANTHROPIC_MOCK === '1'

let anthropicClient = null
function getAnthropic() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY && !ANTHROPIC_MOCK) {
      throw new Error('ANTHROPIC_API_KEY is not configured')
    }
    anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  }
  return anthropicClient
}

// In-process cache: models list is stable enough to reuse across requests.
let modelsCache = null
let modelsCacheAt = 0
const MODELS_CACHE_TTL = 10 * 60 * 1000

const MOCK_MODELS = [
  {
    id: 'claude-haiku-4-5-20251001',
    displayName: 'Claude Haiku 4.5',
    createdAt: '2025-10-01T00:00:00Z',
  },
  {
    id: 'claude-sonnet-4-6',
    displayName: 'Claude Sonnet 4.6',
    createdAt: '2025-12-01T00:00:00Z',
  },
]

app.get('/api/models', async (req, res) => {
  if (ANTHROPIC_MOCK) return res.json({ data: MOCK_MODELS })

  const now = Date.now()
  if (modelsCache && now - modelsCacheAt < MODELS_CACHE_TTL) {
    return res.json({ data: modelsCache })
  }
  try {
    const client = getAnthropic()
    const resp = await client.models.list({ limit: 100 })
    const data = (resp?.data || []).map((m) => ({
      id: m.id,
      displayName: m.display_name || m.id,
      createdAt: m.created_at,
    }))
    modelsCache = data
    modelsCacheAt = now
    res.json({ data })
  } catch (e) {
    res.status(502).json({ error: e.message })
  }
})

// Read all chapters for a story, concatenated with simple titled
// separators. Filters out author-facing color annotations so the LLM
// sees plain prose. `_stories/<slug>/` already tags files with
// storyId via the /api/write-file helper, so we match on storyId.
async function readStoryManuscript(userId, storyId) {
  const rows = await db
    .select({
      path: schema.files.path,
      content: schema.files.content,
      sortOrder: schema.files.sortOrder,
    })
    .from(schema.files)
    .where(
      and(
        eq(schema.files.userId, userId),
        eq(schema.files.storyId, storyId),
      ),
    )
    .orderBy(asc(schema.files.sortOrder), asc(schema.files.path))

  const chunks = []
  for (const r of rows) {
    const name = r.path.split('/').pop().replace(/\.md$/, '')
    const body = stripColorTokens(r.content || '')
    chunks.push(`# ${name}\n\n${body}`)
  }
  return chunks.join('\n\n---\n\n')
}

function stripColorTokens(md) {
  // `[red]…[/red]`, `[bg-red]…[/bg-red]` etc. are author annotations
  // — drop them so the LLM analyzes the prose, not the markup.
  return md.replace(
    /\[(bg-)?(red|green|blue|yellow)\]([\s\S]*?)\[\/(?:bg-)?(?:red|green|blue|yellow)\]/g,
    '$3',
  )
}

function hashManuscript(text) {
  return crypto.createHash('sha256').update(text).digest('hex')
}

async function loadStoryForUser(userId, storyId) {
  const [row] = await db
    .select({
      id: schema.stories.id,
      name: schema.stories.name,
      slug: schema.stories.slug,
      preferredModel: schema.stories.preferredModel,
    })
    .from(schema.stories)
    .where(and(eq(schema.stories.userId, userId), eq(schema.stories.id, storyId)))
  return row || null
}

app.get('/api/insights/:storyId', async (req, res) => {
  const userId = req.session.userId
  const storyId = Number(req.params.storyId)
  if (!Number.isFinite(storyId))
    return res.status(400).json({ error: 'invalid storyId' })

  const story = await loadStoryForUser(userId, storyId)
  if (!story) return res.status(404).json({ error: 'Story not found' })

  const [row] = await db
    .select()
    .from(schema.storyInsights)
    .where(eq(schema.storyInsights.storyId, storyId))

  if (!row) return res.json({ data: null, preferredModel: story.preferredModel })

  const manuscript = await readStoryManuscript(userId, storyId)
  const currentHash = hashManuscript(manuscript)

  res.json({
    data: row.data,
    generatedAt: row.generatedAt,
    model: row.model,
    stale: currentHash !== row.manuscriptHash,
    preferredModel: story.preferredModel,
  })
})

const INSIGHTS_SYSTEM_PROMPT = `You are a literary analyst. You will read a manuscript and produce a single JSON object describing its characters, their relationships, and the scenes. Ignore any [red]…[/red] or [bg-*]…[/bg-*] annotations in the text — those are author highlights, not content.

Return JSON only, matching this TypeScript type exactly:

{
  "characters": Array<{
    "id": string,           // stable kebab-case slug, unique
    "name": string,
    "aliases": string[],
    "personality": string,  // 2-3 sentences
    "arc": string,          // trajectory across the manuscript
    "keyQuotes": string[],  // 2-4 short quotes
    "sceneIds": string[]    // ids from the scenes array below
  }>,
  "relationships": Array<{
    "from": string,         // character id
    "to": string,           // character id
    "label": string,        // e.g. "sibling", "rival", "mentor→student"
    "strength": 1 | 2 | 3,
    "summary": string       // 1 sentence
  }>,
  "scenes": Array<{
    "id": string,           // stable kebab-case slug, unique
    "title": string,
    "chapterPath": string,  // matches the "# <name>" heading preceding the scene
    "order": number,        // 1-based, manuscript order
    "summary": string,
    "characterIds": string[],
    "location": string | null
  }>
}

For chapterPath: use the bare chapter name you see as "# <name>" — the client will resolve it back to a file path. Use kebab-case ids.`

const MOCK_INSIGHTS = {
  characters: [
    {
      id: 'protagonist',
      name: 'Protagonist',
      aliases: [],
      personality: 'Stoic but curious.',
      arc: 'Learns to trust others.',
      keyQuotes: ['I will try.'],
      sceneIds: ['opening'],
    },
  ],
  relationships: [],
  scenes: [
    {
      id: 'opening',
      title: 'Opening',
      chapterPath: 'ch1',
      order: 1,
      summary: 'We meet the protagonist.',
      characterIds: ['protagonist'],
      location: null,
    },
  ],
}

app.post('/api/insights/:storyId/analyze', async (req, res) => {
  const userId = req.session.userId
  const storyId = Number(req.params.storyId)
  if (!Number.isFinite(storyId))
    return res.status(400).json({ error: 'invalid storyId' })

  const story = await loadStoryForUser(userId, storyId)
  if (!story) return res.status(404).json({ error: 'Story not found' })

  // Resolve target model: request body override → story preferredModel → default.
  // Validated against the live models list to fail fast on typos.
  const requested =
    (req.body && typeof req.body.model === 'string' && req.body.model) ||
    story.preferredModel ||
    DEFAULT_INSIGHTS_MODEL

  let validModels
  if (ANTHROPIC_MOCK) {
    validModels = new Set(MOCK_MODELS.map((m) => m.id))
  } else {
    try {
      const client = getAnthropic()
      const resp = await client.models.list({ limit: 100 })
      validModels = new Set((resp?.data || []).map((m) => m.id))
    } catch (e) {
      return res.status(502).json({ error: 'Could not reach Anthropic: ' + e.message })
    }
  }
  if (!validModels.has(requested)) {
    return res
      .status(400)
      .json({ error: `Unknown model "${requested}". Pick one from /api/models.` })
  }

  const manuscript = await readStoryManuscript(userId, storyId)
  if (!manuscript.trim()) {
    return res
      .status(400)
      .json({ error: 'This story has no chapters yet — add some content first.' })
  }
  const currentHash = hashManuscript(manuscript)

  // Cache hit: same manuscript + same model → return existing row.
  const [existing] = await db
    .select()
    .from(schema.storyInsights)
    .where(eq(schema.storyInsights.storyId, storyId))
  if (
    existing &&
    existing.manuscriptHash === currentHash &&
    existing.model === requested
  ) {
    return res.json({
      data: existing.data,
      generatedAt: existing.generatedAt,
      model: existing.model,
      stale: false,
      cached: true,
    })
  }

  // Produce JSON from the LLM (or mock).
  let parsed
  if (ANTHROPIC_MOCK) {
    parsed = MOCK_INSIGHTS
  } else {
    try {
      const client = getAnthropic()
      const resp = await client.messages.create({
        model: requested,
        max_tokens: 16000,
        system: INSIGHTS_SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: manuscript,
                cache_control: { type: 'ephemeral' },
              },
              {
                type: 'text',
                text:
                  'Return JSON only. Your entire response must be a single JSON object matching the schema in the system prompt. No prose, no markdown fences.',
              },
            ],
          },
        ],
      })
      const text = (resp.content || [])
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('')
      try {
        parsed = JSON.parse(text)
      } catch {
        // Sometimes the model emits fences or trailing prose — try to
        // extract the first balanced { … } block.
        const match = text.match(/\{[\s\S]*\}/)
        if (!match) throw new Error('LLM did not return JSON')
        parsed = JSON.parse(match[0])
      }
    } catch (e) {
      return res.status(502).json({ error: 'Analysis failed: ' + e.message })
    }
  }

  if (
    !parsed ||
    !Array.isArray(parsed.characters) ||
    !Array.isArray(parsed.relationships) ||
    !Array.isArray(parsed.scenes)
  ) {
    return res
      .status(502)
      .json({ error: 'Analysis returned invalid shape. Try again.' })
  }

  const generatedAt = new Date()
  await db
    .insert(schema.storyInsights)
    .values({
      storyId,
      data: parsed,
      manuscriptHash: currentHash,
      model: requested,
      generatedAt,
    })
    .onConflictDoUpdate({
      target: schema.storyInsights.storyId,
      set: {
        data: parsed,
        manuscriptHash: currentHash,
        model: requested,
        generatedAt,
      },
    })

  res.json({
    data: parsed,
    generatedAt,
    model: requested,
    stale: false,
    cached: false,
  })
})

// Persist the user's preferred model for a specific story. Validated
// against the live models list so typos fail fast.
app.patch('/api/stories/:storyId/preferred-model', async (req, res) => {
  const userId = req.session.userId
  const storyId = Number(req.params.storyId)
  if (!Number.isFinite(storyId))
    return res.status(400).json({ error: 'invalid storyId' })

  const story = await loadStoryForUser(userId, storyId)
  if (!story) return res.status(404).json({ error: 'Story not found' })

  const model = req.body?.model
  if (model !== null && typeof model !== 'string') {
    return res.status(400).json({ error: 'model must be a string or null' })
  }
  if (model) {
    let validModels
    if (ANTHROPIC_MOCK) {
      validModels = new Set(MOCK_MODELS.map((m) => m.id))
    } else {
      try {
        const client = getAnthropic()
        const resp = await client.models.list({ limit: 100 })
        validModels = new Set((resp?.data || []).map((m) => m.id))
      } catch (e) {
        return res.status(502).json({ error: e.message })
      }
    }
    if (!validModels.has(model)) {
      return res.status(400).json({ error: `Unknown model "${model}"` })
    }
  }

  await db
    .update(schema.stories)
    .set({ preferredModel: model || null })
    .where(and(eq(schema.stories.userId, userId), eq(schema.stories.id, storyId)))

  res.json({ ok: true, preferredModel: model || null })
})

// ═══════════════════════════════════════════════════════════════════════════
// STATUSES API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/statuses', async (req, res) => {
  const userId = req.session.userId
  const rows = await db
    .select({
      id: schema.statuses.statusId,
      label: schema.statuses.label,
      color: schema.statuses.color,
    })
    .from(schema.statuses)
    .where(eq(schema.statuses.userId, userId))
    .orderBy(asc(schema.statuses.sortOrder))
  res.json(rows)
})

app.post('/api/statuses', async (req, res) => {
  const userId = req.session.userId
  const { statuses } = req.body
  if (!Array.isArray(statuses)) return res.status(400).json({ error: 'statuses must be an array' })

  await db.transaction(async (tx) => {
    await tx.delete(schema.statuses).where(eq(schema.statuses.userId, userId))
    if (statuses.length) {
      await tx.insert(schema.statuses).values(
        statuses.map((s, i) => ({
          userId,
          statusId: s.id,
          label: s.label,
          color: s.color,
          sortOrder: i,
        })),
      )
    }
  })
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// META API (per-file status/quality — replaces poems-meta.json)
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/set-meta', async (req, res) => {
  const { path: filePath, status, quality } = req.body
  const userId = req.session.userId

  const patch = { modifiedAt: sql`now()` }
  if (status !== undefined) patch.status = status
  if (quality !== undefined) patch.quality = quality

  await db
    .update(schema.files)
    .set(patch)
    .where(and(eq(schema.files.userId, userId), eq(schema.files.path, filePath)))

  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// FILE UPLOAD (external drops from Finder/Explorer)
// ═══════════════════════════════════════════════════════════════════════════

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const UPLOAD_ALLOWED_EXTS = new Set(['md', 'txt', 'docx'])

async function uniqueMarkdownPath(userId, targetFolder, baseStem) {
  const prefix = targetFolder ? `${targetFolder}/${baseStem}` : baseStem
  // Look up existing paths in this folder matching the stem
  const existing = await db
    .select({ path: schema.files.path })
    .from(schema.files)
    .where(
      and(
        eq(schema.files.userId, userId),
        like(schema.files.path, `${prefix}%`),
      ),
    )
  const taken = new Set(existing.map((r) => r.path))
  let candidate = `${prefix}.md`
  if (!taken.has(candidate)) return candidate
  let i = 1
  while (taken.has(`${prefix}-${i}.md`)) i++
  return `${prefix}-${i}.md`
}

app.post('/api/upload-files', upload.array('files'), async (req, res) => {
  const files = req.files || []
  const targetFolder = (req.body.targetFolder || '').trim()
  const userId = req.session.userId

  const results = []
  for (const f of files) {
    const ext = path.extname(f.originalname).toLowerCase().slice(1)
    const stem = path.basename(f.originalname, path.extname(f.originalname))

    if (!UPLOAD_ALLOWED_EXTS.has(ext)) {
      results.push({ original: f.originalname, skipped: true, error: `Unsupported extension: .${ext}` })
      continue
    }

    try {
      let content
      if (ext === 'docx') {
        const conv = await mammoth.convertToMarkdown({ buffer: f.buffer })
        content = conv.value
      } else {
        content = f.buffer.toString('utf-8')
      }
      const finalPath = await uniqueMarkdownPath(userId, targetFolder, stem)
      const nextSo = await nextSortOrder(db, userId)
      const storyId = await resolveStoryIdForPath(db, userId, finalPath)
      await db.insert(schema.files).values({
        userId,
        path: finalPath,
        content,
        sortOrder: nextSo,
        storyId,
      })
      results.push({ original: f.originalname, saved: finalPath })
    } catch (e) {
      results.push({ original: f.originalname, error: e.message })
    }
  }

  res.json({ results })
})

// ═══════════════════════════════════════════════════════════════════════════
// SPA FALLBACK
// ═══════════════════════════════════════════════════════════════════════════

if (existsSync(distPath)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({ error: err.message || 'Internal server error' })
})

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err)
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Writer server running at http://0.0.0.0:${PORT}`)
})
