const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  safeStorage,
  net,
} = require('electron')
const path = require('path')
const fs = require('fs/promises')
const Store = require('electron-store')
const { autoUpdater } = require('electron-updater')

const store = new Store()
let mainWindow

// Helper to read a secure value
function getSecureValue(key) {
  const val = store.get(`secure.${key}`)
  if (!val) return null
  if (!store.get(`secure.${key}_enc`)) return val
  try {
    const buffer = Buffer.from(val, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// WINDOW
// ═══════════════════════════════════════════════════════════════════════════
function createWindow() {
  const bounds = store.get('windowBounds', { width: 1200, height: 800 })
  mainWindow = new BrowserWindow({
    ...bounds,
    minWidth: 700,
    minHeight: 400,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 10 },
  })

  // In dev, electron-vite serves from dev server; in production, load built files
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds())
  })
}

app.whenReady().then(() => {
  createWindow()
  autoUpdater.checkForUpdatesAndNotify().catch(() => {})
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM IPC
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  })
  if (result.canceled) return null
  const dirPath = result.filePaths[0]
  store.set('lastDirectory', dirPath)
  return dirPath
})

ipcMain.handle('store:getLastDirectory', () => {
  return store.get('lastDirectory', null)
})

ipcMain.handle('fs:scanDirectory', async (_, dirPath) => {
  const files = {} // relPath → { modified }
  const dirs = {} // relPath → true

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
  return { files, dirs }
})

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    return await fs.readFile(filePath, 'utf-8')
  } catch (e) {
    if (e.code === 'ENOENT') return ''
    throw e
  }
})

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8')
  const stat = await fs.stat(filePath)
  return stat.mtimeMs
})

ipcMain.handle('fs:deleteFile', async (_, filePath) => {
  await fs.unlink(filePath)
})

ipcMain.handle('fs:renameFile', async (_, oldPath, newPath) => {
  await fs.rename(oldPath, newPath)
})

// ═══════════════════════════════════════════════════════════════════════════
// SECURE STORAGE
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('secure:set', (_, key, value) => {
  if (!safeStorage.isEncryptionAvailable()) {
    store.set(`secure.${key}`, value)
    return
  }
  const encrypted = safeStorage.encryptString(value)
  store.set(`secure.${key}`, encrypted.toString('base64'))
  store.set(`secure.${key}_enc`, true)
})

ipcMain.handle('secure:get', (_, key) => {
  const val = store.get(`secure.${key}`)
  if (!val) return null
  if (!store.get(`secure.${key}_enc`)) return val
  try {
    const buffer = Buffer.from(val, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG (non-secret settings stored in electron-store)
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('config:set', (_, key, value) => {
  store.set(key, value)
})

ipcMain.handle('config:get', (_, key, defaultVal) => {
  return store.get(key, defaultVal ?? null)
})

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE MODEL LISTING
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('ai:listModels', async () => {
  const apiKey = getSecureValue('claudeApiKey')
  if (!apiKey) throw new Error('Claude API key not configured')

  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })

  const models = []
  for await (const model of client.models.list({ limit: 100 })) {
    models.push({ id: model.id, name: model.display_name || model.id })
  }
  // Sort: newest first (model IDs are roughly chronological)
  models.sort((a, b) => b.id.localeCompare(a.id))
  return models
})

// ═══════════════════════════════════════════════════════════════════════════
// IMAGE DIALOG
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('dialog:openImage', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp'] },
    ],
  })
  if (result.canceled) return null
  const filePath = result.filePaths[0]
  const buffer = await fs.readFile(filePath)
  const ext = path.extname(filePath).toLowerCase().slice(1)
  const mime = ext === 'jpg' ? 'image/jpeg' : `image/${ext}`
  return {
    path: filePath,
    dataUrl: `data:${mime};base64,${buffer.toString('base64')}`,
    name: path.basename(filePath),
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// AI SERVICES (Claude + OpenAI) — main process keeps API keys secure
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('ai:suggestImagePrompts', async (_, poemText) => {
  const apiKey = getSecureValue('claudeApiKey')
  if (!apiKey) throw new Error('Claude API key not configured')

  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })
  const model = store.get('claudeModel', 'claude-haiku-4-5-20251001')

  const message = await client.messages.create({
    model,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: `Given this poem, suggest 3 evocative image descriptions that would work as backgrounds for an Instagram poetry post. Each should be a vivid, detailed single paragraph suitable as a DALL-E image generation prompt. Return ONLY a JSON array of 3 strings, no other text.\n\nPoem:\n${poemText}`,
      },
    ],
  })

  const text = message.content[0].text.trim()
  const match = text.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Failed to parse Claude response')
  return JSON.parse(match[0])
})

ipcMain.handle('ai:suggestTextStyle', async (_, poemText, imageDescription) => {
  const apiKey = getSecureValue('claudeApiKey')
  if (!apiKey) throw new Error('Claude API key not configured')

  const Anthropic = require('@anthropic-ai/sdk')
  const client = new Anthropic({ apiKey })
  const model = store.get('claudeModel', 'claude-haiku-4-5-20251001')

  const message = await client.messages.create({
    model,
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: `You are styling poem text to overlay on an image for a social media post. Given the poem and image description, suggest text styling that makes the text readable and beautiful. Return ONLY a JSON object with these exact keys: fontFamily (one of "Georgia", "system-ui", "monospace"), fontSize (int 20-60), fontWeight ("normal" or "bold"), fontStyle ("normal" or "italic"), fontColor (hex string), fontOpacity (0-1 float), textX (0-100 int, horizontal % position), textY (0-100 int, vertical % position), textAlign ("left", "center", or "right"), textShadow (boolean).\n\nPoem:\n${poemText}\n\nImage description: ${imageDescription || 'unknown'}`,
      },
    ],
  })

  const text = message.content[0].text.trim()
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Failed to parse Claude response')
  return JSON.parse(match[0])
})

ipcMain.handle('ai:generateImage', async (_, prompt) => {
  const apiKey = getSecureValue('openaiApiKey')
  if (!apiKey) throw new Error('OpenAI API key not configured')

  const OpenAI = require('openai')
  const client = new OpenAI({ apiKey })

  const response = await client.images.generate({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
    response_format: 'b64_json',
  })

  return `data:image/png;base64,${response.data[0].b64_json}`
})

// ═══════════════════════════════════════════════════════════════════════════
// SOCIAL COMPOSER AUTO-SAVE
// ═══════════════════════════════════════════════════════════════════════════
function socialCacheDir(projectRoot) {
  return path.join(projectRoot, '.social-cache')
}

function socialKey(poemPath) {
  // Sanitize poem path for use as filename
  return poemPath.replace(/[\/\\]/g, '__').replace(/\.md$/, '')
}

ipcMain.handle('social:save', async (_, projectRoot, poemPath, state) => {
  const dir = socialCacheDir(projectRoot)
  await fs.mkdir(dir, { recursive: true })
  const key = socialKey(poemPath)

  // Save image data to file if present
  if (state.imageDataUrl) {
    const imgPath = path.join(dir, `${key}.img`)
    const base64 = state.imageDataUrl.split(',')[1]
    const mimeMatch = state.imageDataUrl.match(/^data:([^;]+);/)
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
    await fs.writeFile(imgPath, Buffer.from(base64, 'base64'))
    // Store mime type for restoration
    state = { ...state, _imageMime: mime, imageDataUrl: undefined }
  } else {
    // Remove old image file if image was cleared
    const imgPath = path.join(dir, `${key}.img`)
    await fs.unlink(imgPath).catch(() => {})
    state = { ...state, imageDataUrl: undefined }
  }

  // Save audio data to file if present
  if (state.audioBase64) {
    const audioPath = path.join(dir, `${key}.audio`)
    const base64 = state.audioBase64.split(',')[1] || state.audioBase64
    await fs.writeFile(audioPath, Buffer.from(base64, 'base64'))
    state = { ...state, audioBase64: undefined }
  } else {
    const audioPath = path.join(dir, `${key}.audio`)
    await fs.unlink(audioPath).catch(() => {})
    state = { ...state, audioBase64: undefined }
  }

  // Save JSON state
  const jsonPath = path.join(dir, `${key}.json`)
  await fs.writeFile(jsonPath, JSON.stringify(state, null, 2), 'utf-8')
  return true
})

ipcMain.handle('social:load', async (_, projectRoot, poemPath) => {
  const dir = socialCacheDir(projectRoot)
  const key = socialKey(poemPath)
  const jsonPath = path.join(dir, `${key}.json`)

  let state
  try {
    const text = await fs.readFile(jsonPath, 'utf-8')
    state = JSON.parse(text)
  } catch {
    return null // No saved state
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

  return state
})

ipcMain.handle('social:clear', async (_, projectRoot, poemPath) => {
  const dir = socialCacheDir(projectRoot)
  const key = socialKey(poemPath)
  await fs.unlink(path.join(dir, `${key}.json`)).catch(() => {})
  await fs.unlink(path.join(dir, `${key}.img`)).catch(() => {})
  await fs.unlink(path.join(dir, `${key}.audio`)).catch(() => {})
  return true
})

// ═══════════════════════════════════════════════════════════════════════════
// TEMP FILE + EXPORT HELPERS
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('fs:saveTempFile', async (_, arrayBuffer, filename) => {
  const dir = app.getPath('temp')
  const filePath = path.join(dir, filename)
  await fs.writeFile(filePath, Buffer.from(arrayBuffer))
  return filePath
})

ipcMain.handle('dialog:saveFile', async (_, options) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: options.defaultName || 'export',
    filters: options.filters || [{ name: 'All Files', extensions: ['*'] }],
  })
  if (result.canceled) return null
  return result.filePath
})

ipcMain.handle('fs:writeBase64', async (_, filePath, dataUrl) => {
  const base64 = dataUrl.split(',')[1]
  await fs.writeFile(filePath, Buffer.from(base64, 'base64'))
  return filePath
})

ipcMain.handle('fs:copyFile', async (_, src, dest) => {
  await fs.copyFile(src, dest)
  return dest
})

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO CREATION (image + audio → MP4 via ffmpeg)
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle(
  'video:createReel',
  async (_, imageDataUrl, audioArrayBuffer, duration) => {
    const ffmpegPath = require('ffmpeg-static')
    const ffmpeg = require('fluent-ffmpeg')
    ffmpeg.setFfmpegPath(ffmpegPath)

    const tempDir = app.getPath('temp')
    const ts = Date.now()

    // Save composite image to temp
    const imgPath = path.join(tempDir, `reel-img-${ts}.jpg`)
    const imgBase64 = imageDataUrl.split(',')[1]
    await fs.writeFile(imgPath, Buffer.from(imgBase64, 'base64'))

    // Save audio to temp
    const audioPath = path.join(tempDir, `reel-audio-${ts}.webm`)
    await fs.writeFile(audioPath, Buffer.from(audioArrayBuffer))

    const outputPath = path.join(tempDir, `reel-${ts}.mp4`)

    return new Promise((resolve, reject) => {
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
          // Clean up temp files
          await fs.unlink(imgPath).catch(() => {})
          await fs.unlink(audioPath).catch(() => {})
          resolve(outputPath)
        })
        .on('error', (err) => reject(err))
        .run()
    })
  },
)

