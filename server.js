const express = require('express')
const path = require('path')
const fs = require('fs/promises')
const { existsSync } = require('fs')

const app = express()
const PORT = process.env.PORT || 3000

// In-memory config store (persisted to ~/.writer-config.json)
const CONFIG_PATH = path.join(
  process.env.HOME || process.env.USERPROFILE || '.',
  '.writer-config.json',
)

let config = {}
try {
  if (existsSync(CONFIG_PATH)) {
    config = JSON.parse(require('fs').readFileSync(CONFIG_PATH, 'utf-8'))
  }
} catch {
  config = {}
}

function saveConfig() {
  require('fs').writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
}

// ═══════════════════════════════════════════════════════════════════════════
// MIDDLEWARE
// ═══════════════════════════════════════════════════════════════════════════
app.use(express.json({ limit: '50mb' }))

// Serve static frontend in production
if (existsSync(path.join(__dirname, 'dist'))) {
  app.use(express.static(path.join(__dirname, 'dist')))
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/config/:key', (req, res) => {
  const val = config[req.params.key]
  res.json({ value: val !== undefined ? val : null })
})

app.put('/api/config/:key', (req, res) => {
  config[req.params.key] = req.body.value
  saveConfig()
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// SECURE STORAGE (stored in config as plain text — no OS encryption in web)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/secure/:key', (req, res) => {
  const val = config[`secure.${req.params.key}`] || null
  res.json({ value: val })
})

app.put('/api/secure/:key', (req, res) => {
  config[`secure.${req.params.key}`] = req.body.value
  saveConfig()
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// DIRECTORY LISTING (server-side scanning)
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/directories', (req, res) => {
  res.json({ value: config.lastDirectory || null })
})

app.put('/api/directories', (req, res) => {
  config.lastDirectory = req.body.path
  saveConfig()
  res.json({ ok: true })
})

// List top-level directories in a base path for browsing
app.post('/api/browse', async (req, res) => {
  const dirPath = req.body.path || process.env.HOME || '/'
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    const dirs = entries
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort()
    res.json({ path: dirPath, dirs })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

app.post('/api/scan', async (req, res) => {
  const dirPath = req.body.path
  if (!dirPath) return res.status(400).json({ error: 'path required' })

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
          files[rel] = { modified: stat.mtimeMs }
        } catch {
          /* skip unreadable */
        }
      }
    }
  }

  await scan(dirPath, '')
  res.json({ files, dirs })
})

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/fs/read', async (req, res) => {
  try {
    const content = await fs.readFile(req.body.path, 'utf-8')
    res.json({ content })
  } catch (e) {
    if (e.code === 'ENOENT') return res.json({ content: '' })
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/write', async (req, res) => {
  try {
    await fs.writeFile(req.body.path, req.body.content, 'utf-8')
    const stat = await fs.stat(req.body.path)
    res.json({ modified: stat.mtimeMs })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/delete', async (req, res) => {
  try {
    await fs.unlink(req.body.path)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/fs/rename', async (req, res) => {
  try {
    await fs.rename(req.body.oldPath, req.body.newPath)
    res.json({ ok: true })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE UPLOAD (replaces Electron dialog:openImage)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/upload/image', express.raw({ type: 'image/*', limit: '20mb' }), (req, res) => {
  const mime = req.headers['content-type'] || 'image/jpeg'
  const dataUrl = `data:${mime};base64,${req.body.toString('base64')}`
  res.json({ dataUrl, name: 'uploaded-image' })
})

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT / DOWNLOAD (replaces Electron save dialogs)
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/export/image', async (req, res) => {
  const { dataUrl, filename } = req.body
  const base64 = dataUrl.split(',')[1]
  const buffer = Buffer.from(base64, 'base64')
  const mime = dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/jpeg'
  res.set('Content-Type', mime)
  res.set('Content-Disposition', `attachment; filename="${filename || 'export.jpg'}"`)
  res.send(buffer)
})

// ═══════════════════════════════════════════════════════════════════════════
// AI SERVICES
// ═══════════════════════════════════════════════════════════════════════════
app.get('/api/ai/models', async (req, res) => {
  const apiKey = config['secure.claudeApiKey']
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured' })

  try {
    const Anthropic = require('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey })

    const models = []
    for await (const model of client.models.list({ limit: 100 })) {
      models.push({ id: model.id, name: model.display_name || model.id })
    }
    models.sort((a, b) => b.id.localeCompare(a.id))
    res.json({ models })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/suggest-image-prompts', async (req, res) => {
  const apiKey = config['secure.claudeApiKey']
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured' })

  try {
    const Anthropic = require('@anthropic-ai/sdk')
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
    res.json({ suggestions: JSON.parse(match[0]) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/suggest-text-style', async (req, res) => {
  const apiKey = config['secure.claudeApiKey']
  if (!apiKey) return res.status(400).json({ error: 'Claude API key not configured' })

  try {
    const Anthropic = require('@anthropic-ai/sdk')
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
    res.json({ style: JSON.parse(match[0]) })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/ai/generate-image', async (req, res) => {
  const apiKey = config['secure.openaiApiKey']
  if (!apiKey) return res.status(400).json({ error: 'OpenAI API key not configured' })

  try {
    const OpenAI = require('openai')
    const client = new OpenAI({ apiKey })

    const response = await client.images.generate({
      model: 'dall-e-3',
      prompt: req.body.prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    })

    res.json({
      dataUrl: `data:image/png;base64,${response.data[0].b64_json}`,
    })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL COMPOSER AUTO-SAVE
// ═══════════════════════════════════════════════════════════════════════════
function socialCacheDir(projectRoot) {
  return path.join(projectRoot, '.social-cache')
}

function socialKey(poemPath) {
  return poemPath.replace(/[\/\\]/g, '__').replace(/\.md$/, '')
}

app.post('/api/social/save', async (req, res) => {
  const { projectRoot, poemPath, state } = req.body
  const dir = socialCacheDir(projectRoot)
  await fs.mkdir(dir, { recursive: true })
  const key = socialKey(poemPath)

  let saveState = { ...state }

  // Save image data to file if present
  if (saveState.imageDataUrl) {
    const imgPath = path.join(dir, `${key}.img`)
    const base64 = saveState.imageDataUrl.split(',')[1]
    const mimeMatch = saveState.imageDataUrl.match(/^data:([^;]+);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    await fs.writeFile(imgPath, Buffer.from(base64, 'base64'))
    saveState = { ...saveState, _imageMime: mime, imageDataUrl: undefined }
  } else {
    const imgPath = path.join(dir, `${key}.img`)
    await fs.unlink(imgPath).catch(() => {})
    saveState = { ...saveState, imageDataUrl: undefined }
  }

  // Save audio data to file if present
  if (saveState.audioBase64) {
    const audioPath = path.join(dir, `${key}.audio`)
    const base64 = saveState.audioBase64.split(',')[1] || saveState.audioBase64
    await fs.writeFile(audioPath, Buffer.from(base64, 'base64'))
    saveState = { ...saveState, audioBase64: undefined }
  } else {
    const audioPath = path.join(dir, `${key}.audio`)
    await fs.unlink(audioPath).catch(() => {})
    saveState = { ...saveState, audioBase64: undefined }
  }

  const jsonPath = path.join(dir, `${key}.json`)
  await fs.writeFile(jsonPath, JSON.stringify(saveState, null, 2), 'utf-8')
  res.json({ ok: true })
})

app.post('/api/social/load', async (req, res) => {
  const { projectRoot, poemPath } = req.body
  const dir = socialCacheDir(projectRoot)
  const key = socialKey(poemPath)
  const jsonPath = path.join(dir, `${key}.json`)

  let state
  try {
    const text = await fs.readFile(jsonPath, 'utf-8')
    state = JSON.parse(text)
  } catch {
    return res.json({ state: null })
  }

  // Restore image data URL from file
  const imgPath = path.join(dir, `${key}.img`)
  try {
    const buffer = await fs.readFile(imgPath)
    const mime = state._imageMime || 'image/jpeg'
    state.imageDataUrl = `data:${mime};base64,${buffer.toString('base64')}`
    delete state._imageMime
  } catch {
    state.imageDataUrl = null
  }

  // Restore audio from file
  const audioPath = path.join(dir, `${key}.audio`)
  try {
    const buffer = await fs.readFile(audioPath)
    state.audioBase64 = `data:audio/webm;base64,${buffer.toString('base64')}`
  } catch {
    state.audioBase64 = null
  }

  res.json({ state })
})

app.post('/api/social/clear', async (req, res) => {
  const { projectRoot, poemPath } = req.body
  const dir = socialCacheDir(projectRoot)
  const key = socialKey(poemPath)
  await fs.unlink(path.join(dir, `${key}.json`)).catch(() => {})
  await fs.unlink(path.join(dir, `${key}.img`)).catch(() => {})
  await fs.unlink(path.join(dir, `${key}.audio`)).catch(() => {})
  res.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO CREATION
// ═══════════════════════════════════════════════════════════════════════════
app.post('/api/video/create-reel', async (req, res) => {
  const { imageDataUrl, audioBase64, duration } = req.body

  try {
    const ffmpegPath = require('ffmpeg-static')
    const ffmpeg = require('fluent-ffmpeg')
    ffmpeg.setFfmpegPath(ffmpegPath)

    const os = require('os')
    const tempDir = os.tmpdir()
    const ts = Date.now()

    // Save composite image to temp
    const imgPath = path.join(tempDir, `reel-img-${ts}.jpg`)
    const imgBase64 = imageDataUrl.split(',')[1]
    await fs.writeFile(imgPath, Buffer.from(imgBase64, 'base64'))

    // Save audio to temp
    const audioPath = path.join(tempDir, `reel-audio-${ts}.webm`)
    const audioData = audioBase64.split(',')[1] || audioBase64
    await fs.writeFile(audioPath, Buffer.from(audioData, 'base64'))

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
        .on('error', (err) => reject(err))
        .run()
    })

    // Send the video file as a download
    const videoBuffer = await fs.readFile(outputPath)
    await fs.unlink(outputPath).catch(() => {})
    res.set('Content-Type', 'video/mp4')
    res.set('Content-Disposition', 'attachment; filename="social-reel.mp4"')
    res.send(videoBuffer)
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// SPA FALLBACK
// ═══════════════════════════════════════════════════════════════════════════
if (existsSync(path.join(__dirname, 'dist'))) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'))
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Writer server running at http://0.0.0.0:${PORT}`)
  console.log(`Local: http://localhost:${PORT}`)
})
