import express from 'express'
import path from 'path'
import fs from 'fs/promises'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import os from 'os'
import multer from 'multer'
import mammoth from 'mammoth'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ── Load .env from app root ────────────────────────────────────────────────
const envPath = path.join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

const app = express()
const PORT = process.env.PORT || 3456
const WRITER_ROOT = process.env.WRITER_ROOT

if (!WRITER_ROOT) {
  console.error('ERROR: WRITER_ROOT is not set. Add it to .env in the app root.')
  process.exit(1)
}

if (!existsSync(WRITER_ROOT)) {
  console.error(`ERROR: WRITER_ROOT directory does not exist: ${WRITER_ROOT}`)
  process.exit(1)
}

// ── Config file (replaces electron-store) ──────────────────────────────────
const CONFIG_PATH = path.join(os.homedir(), '.writer-config.json')

function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      return JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'))
    }
  } catch {}
  return {}
}

function saveConfig(data) {
  writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

let config = loadConfig()

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }))

// Serve the built Svelte frontend in production
const distPath = path.join(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
}

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM API
// ═══════════════════════════════════════════════════════════════════════════

app.get('/api/root', (req, res) => {
  res.json({ path: WRITER_ROOT })
})

app.post('/api/scan-directory', async (req, res) => {
  const dirPath = WRITER_ROOT

  const files = {}
  const dirs = {}

  async function scan(dir, prefix) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'poems-meta.json') continue
      if (entry.name === 'stories-meta.json') continue
      if (
        ['INDEX.html', 'watch_poems.ps1', 'start_watcher.vbs'].includes(
          entry.name,
        )
      )
        continue

      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        dirs[rel] = true
        await scan(full, rel)
      } else if (entry.name.endsWith('.md')) {
        try {
          const stat = await fs.stat(full)
          files[rel] = { modified: stat.mtimeMs, created: stat.birthtimeMs }
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  await scan(dirPath, '')
  res.json({ files, dirs })
})

app.post('/api/search', async (req, res) => {
  const { query } = req.body
  if (!query || !query.trim()) return res.json({ matches: [] })

  const q = query.toLowerCase()
  const matches = []

  async function scan(dir, prefix) {
    let entries
    try {
      entries = await fs.readdir(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      if (entry.name === 'poems-meta.json') continue
      if (entry.name === 'stories-meta.json') continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        await scan(full, rel)
      } else if (entry.name.endsWith('.md')) {
        try {
          const content = await fs.readFile(full, 'utf-8')
          const nameMatch = entry.name.toLowerCase().includes(q)
          const bodyMatch = content.toLowerCase().includes(q)
          if (nameMatch || bodyMatch) {
            matches.push(rel)
          }
        } catch {}
      }
    }
  }

  await scan(WRITER_ROOT, '')
  res.json({ matches })
})

app.post('/api/read-file', async (req, res) => {
  const { path: filePath } = req.body
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    res.json({ content })
  } catch (e) {
    if (e.code === 'ENOENT') return res.json({ content: '' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/write-file', async (req, res) => {
  const { path: filePath, content } = req.body
  await fs.writeFile(filePath, content, 'utf-8')
  const stat = await fs.stat(filePath)
  res.json({ modified: stat.mtimeMs })
})

app.post('/api/delete-file', async (req, res) => {
  const { path: filePath } = req.body
  await fs.unlink(filePath)
  res.json({ ok: true })
})

app.post('/api/rename-file', async (req, res) => {
  const { oldPath, newPath } = req.body
  await fs.rename(oldPath, newPath)
  res.json({ ok: true })
})

app.post('/api/create-folder', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })
  const fullPath = path.join(WRITER_ROOT, name)
  try {
    await fs.mkdir(fullPath, { recursive: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/move-file', async (req, res) => {
  const { oldPath, newPath } = req.body
  const fullOld = path.join(WRITER_ROOT, oldPath)
  const fullNew = path.join(WRITER_ROOT, newPath)
  // Ensure target directory exists
  await fs.mkdir(path.dirname(fullNew), { recursive: true })
  await fs.rename(fullOld, fullNew)
  res.json({ ok: true })
})

app.post('/api/rename-folder', async (req, res) => {
  const { oldPath, newPath } = req.body
  const fullOld = path.join(WRITER_ROOT, oldPath)
  const fullNew = path.join(WRITER_ROOT, newPath)
  await fs.rename(fullOld, fullNew)
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// STORY API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/create-story', async (req, res) => {
  const { name } = req.body
  if (!name) return res.status(400).json({ error: 'name is required' })

  const storyDir = path.join(WRITER_ROOT, '_stories', name)
  try {
    await fs.mkdir(storyDir, { recursive: true })

    const plotContent = `---
notes: []
connections: []
---

# Plot Board
`
    await fs.writeFile(path.join(storyDir, '_plot.md'), plotContent, 'utf-8')

    const bibleContent = `# Story Bible

## Characters

## Setting

## Genre & Tone

## Timeline
`
    await fs.writeFile(path.join(storyDir, '_bible.md'), bibleContent, 'utf-8')

    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/delete-folder', async (req, res) => {
  const { path: folderPath } = req.body
  if (!folderPath) return res.status(400).json({ error: 'path is required' })

  // Safety: only allow deleting within WRITER_ROOT
  const full = path.resolve(folderPath)
  if (!full.startsWith(path.resolve(WRITER_ROOT))) {
    return res.status(403).json({ error: 'Cannot delete outside WRITER_ROOT' })
  }

  try {
    await fs.rm(full, { recursive: true, force: true })
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG API (replaces electron-store + secure storage)
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/config/set', (req, res) => {
  const { key, value } = req.body
  config[key] = value
  saveConfig(config)
  res.json({ ok: true })
})

app.post('/api/config/get', (req, res) => {
  const { key, defaultValue } = req.body
  res.json({ value: config[key] ?? defaultValue ?? null })
})

// Secure storage (stored in same config file — acceptable for local-only use)
app.post('/api/secure/set', (req, res) => {
  const { key, value } = req.body
  if (!config._secure) config._secure = {}
  config._secure[key] = value
  saveConfig(config)
  res.json({ ok: true })
})

app.post('/api/secure/get', (req, res) => {
  const { key } = req.body
  const value = config._secure?.[key] || null
  res.json({ value })
})

// ═══════════════════════════════════════════════════════════════════════════
// AI SERVICES
// ═══════════════════════════════════════════════════════════════════════════

function getApiKey(name) {
  return config._secure?.[name] || null
}

app.post('/api/ai/list-models', async (req, res) => {
  const apiKey = getApiKey('claudeApiKey')
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured' })

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })

    const models = []
    for await (const model of client.models.list({ limit: 100 })) {
      models.push({ id: model.id, name: model.display_name || model.id })
    }
    models.sort((a, b) => b.id.localeCompare(a.id))
    res.json(models)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/suggest-image-prompts', async (req, res) => {
  const apiKey = getApiKey('claudeApiKey')
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured' })

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const model = config.claudeModel || 'claude-haiku-4-5-20251001'

    const message = await client.messages.create({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Given this poem, suggest 3 evocative image descriptions that would work as backgrounds for an Instagram poetry post. Each should be a vivid, detailed single paragraph suitable as a DALL-E image generation prompt. Return ONLY a JSON array of 3 strings, no other text.\n\nPoem:\n${req.body.text}`,
        },
      ],
    })

    const text = message.content[0].text.trim()
    const match = text.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('Failed to parse Claude response')
    res.json(JSON.parse(match[0]))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/suggest-text-style', async (req, res) => {
  const apiKey = getApiKey('claudeApiKey')
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured' })

  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })
    const model = config.claudeModel || 'claude-haiku-4-5-20251001'

    const message = await client.messages.create({
      model,
      max_tokens: 512,
      messages: [
        {
          role: 'user',
          content: `You are styling poem text to overlay on an image for a social media post. Given the poem and image description, suggest text styling that makes the text readable and beautiful. Return ONLY a JSON object with these exact keys: fontFamily (one of "Georgia", "system-ui", "monospace"), fontSize (int 20-60), fontWeight ("normal" or "bold"), fontStyle ("normal" or "italic"), fontColor (hex string), fontOpacity (0-1 float), textX (0-100 int, horizontal % position), textY (0-100 int, vertical % position), textAlign ("left", "center", or "right"), textShadow (boolean).\n\nPoem:\n${req.body.text}\n\nImage description: ${req.body.description || 'unknown'}`,
        },
      ],
    })

    const text = message.content[0].text.trim()
    const match = text.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Failed to parse Claude response')
    res.json(JSON.parse(match[0]))
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/generate-image', async (req, res) => {
  const apiKey = getApiKey('openaiApiKey')
  if (!apiKey) return res.status(400).json({ error: 'OpenAI API key not configured' })

  try {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey })

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: req.body.prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    })

    res.json({ dataUrl: `data:image/png;base64,${response.data[0].b64_json}` })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE UPLOAD (replaces native dialog)
// ═══════════════════════════════════════════════════════════════════════════

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } })

const UPLOAD_ALLOWED_EXTS = new Set(['md', 'txt', 'docx'])

async function uniqueMarkdownPath(dir, baseStem) {
  let candidate = path.join(dir, `${baseStem}.md`)
  if (!existsSync(candidate)) return candidate
  let i = 1
  while (existsSync(path.join(dir, `${baseStem}-${i}.md`))) i++
  return path.join(dir, `${baseStem}-${i}.md`)
}

app.post('/api/upload-files', upload.array('files'), async (req, res) => {
  const files = req.files || []
  const targetFolder = (req.body.targetFolder || '').trim()

  const targetDir = path.resolve(path.join(WRITER_ROOT, targetFolder))
  if (!targetDir.startsWith(path.resolve(WRITER_ROOT))) {
    return res.status(403).json({ error: 'Cannot upload outside WRITER_ROOT' })
  }

  try {
    await fs.mkdir(targetDir, { recursive: true })
  } catch (e) {
    return res.status(500).json({ error: e.message })
  }

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
      const finalPath = await uniqueMarkdownPath(targetDir, stem)
      await fs.writeFile(finalPath, content, 'utf-8')
      results.push({
        original: f.originalname,
        saved: path.relative(path.resolve(WRITER_ROOT), finalPath),
      })
    } catch (e) {
      results.push({ original: f.originalname, error: e.message })
    }
  }

  res.json({ results })
})

app.post('/api/upload-image', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' })

  const ext = path.extname(req.file.originalname).toLowerCase().slice(1)
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  const dataUrl = `data:${mime};base64,${req.file.buffer.toString('base64')}`

  res.json({
    name: req.file.originalname,
    dataUrl,
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/write-base64', async (req, res) => {
  const { path: filePath, dataUrl } = req.body
  const base64 = dataUrl.split(',')[1]
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
  res.json({ path: filePath })
})

// Download endpoint — lets the browser download a data URL as a file
app.post('/api/download', (req, res) => {
  const { dataUrl, filename } = req.body
  const base64 = dataUrl.split(',')[1]
  const mimeMatch = dataUrl.match(/^data:([^;]+);/)
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream'

  res.setHeader('Content-Type', mime)
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(Buffer.from(base64, 'base64'))
})

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO CREATION
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/video/create-reel', async (req, res) => {
  try {
    const { default: ffmpegPath } = await import('ffmpeg-static')
    const { default: ffmpeg } = await import('fluent-ffmpeg')
    ffmpeg.setFfmpegPath(ffmpegPath)

    const tempDir = os.tmpdir()
    const ts = Date.now()

    const { imageDataUrl, audioBase64, duration } = req.body

    // Save composite image to temp
    const imgPath = path.join(tempDir, `reel-img-${ts}.jpg`)
    const imgBase64 = imageDataUrl.split(',')[1]
    await fs.writeFile(imgPath, Buffer.from(imgBase64, 'base64'))

    // Save audio to temp
    const audioPath = path.join(tempDir, `reel-audio-${ts}.webm`)
    await fs.writeFile(audioPath, Buffer.from(audioBase64, 'base64'))

    const outputPath = path.join(tempDir, `reel-${ts}.mp4`)

    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imgPath)
        .loop(duration)
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-tune stillimage',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          '-shortest',
          '-vf',
          'scale=1080:1080',
        ])
        .output(outputPath)
        .on('end', async () => {
          await fs.unlink(imgPath).catch(() => {})
          await fs.unlink(audioPath).catch(() => {})
          resolve()
        })
        .on('error', reject)
        .run()
    })

    // Read the output and send as base64
    const videoBuffer = await fs.readFile(outputPath)
    await fs.unlink(outputPath).catch(() => {})
    res.json({
      dataUrl: `data:video/mp4;base64,${videoBuffer.toString('base64')}`,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
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

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Writer server running at http://0.0.0.0:${PORT}`)
  console.log(`Serving files from ${WRITER_ROOT}`)
  console.log(`Config stored at ${CONFIG_PATH}`)
})
