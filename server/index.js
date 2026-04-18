import express from 'express'
import path from 'path'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import multer from 'multer'
import mammoth from 'mammoth'
import { and, asc, eq, ilike, like, sql } from 'drizzle-orm'

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
      modified: r.modifiedAt.getTime(),
      created: r.createdAt.getTime(),
    }
    // Collect directory prefixes
    const parts = r.path.split('/')
    for (let i = 1; i < parts.length; i++) {
      dirSet.add(parts.slice(0, i).join('/'))
    }
  }
  const dirs = {}
  for (const d of dirSet) dirs[d] = true

  res.json({ files, dirs })
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

app.post('/api/write-file', async (req, res) => {
  const { path: filePath, content } = req.body
  const userId = req.session.userId

  const [row] = await db
    .insert(schema.files)
    .values({ userId, path: filePath, content })
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
    await db
      .update(schema.files)
      .set({ path: newPath, modifiedAt: sql`now()` })
      .where(and(eq(schema.files.userId, userId), eq(schema.files.path, oldPath)))
    res.json({ ok: true })
  } catch (e) {
    if (e.cause?.code === '23505' || e.code === '23505')
      return res.status(409).json({ error: 'A file with that name already exists' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/create-folder', (req, res) => {
  // Folders are implicit (derived from file path prefixes). No-op for API compatibility.
  res.json({ ok: true })
})

app.post('/api/move-file', async (req, res) => {
  const { oldPath, newPath } = req.body
  const userId = req.session.userId
  try {
    await db
      .update(schema.files)
      .set({ path: newPath, modifiedAt: sql`now()` })
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
    await db
      .update(schema.files)
      .set({
        path: sql`${newPath} || substr(${schema.files.path}, ${oldPath.length + 1})`,
        modifiedAt: sql`now()`,
      })
      .where(
        and(
          eq(schema.files.userId, userId),
          like(schema.files.path, `${oldPath}/%`),
        ),
      )
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

app.post('/api/create-story', async (req, res) => {
  const { name } = req.body
  const userId = req.session.userId
  if (!name || !name.trim()) return res.status(400).json({ error: 'name is required' })

  const slug = slugify(name)
  try {
    const [story] = await db
      .insert(schema.stories)
      .values({ userId, name: name.trim(), slug })
      .returning()

    const basePath = `_stories/${slug}`
    const plotContent = `---\nnotes: []\nconnections: []\n---\n\n# Plot Board\n`
    const bibleContent = `# Story Bible\n\n## Characters\n\n## Setting\n\n## Genre & Tone\n\n## Timeline\n`

    await db.insert(schema.files).values([
      { userId, path: `${basePath}/_plot.md`, content: plotContent, storyId: story.id },
      { userId, path: `${basePath}/_bible.md`, content: bibleContent, storyId: story.id },
    ])

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

  // Always delete files whose path is under the prefix.
  await db
    .delete(schema.files)
    .where(
      and(
        eq(schema.files.userId, userId),
        like(schema.files.path, `${folderPath}/%`),
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
      await db.insert(schema.files).values({
        userId,
        path: finalPath,
        content,
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
