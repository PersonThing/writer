// Web API layer — fetch() calls to the Express server

async function post(url, body = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

async function get(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// ── Root path (fixed, from server .env) ────────────────────────────────────

export async function getRootPath() {
  const result = await get('/api/root')
  return result.path
}

// ── File system ────────────────────────────────────────────────────────────

export async function scanDirectory() {
  return post('/api/scan-directory')
}

export async function searchFiles(query) {
  const result = await post('/api/search', { query })
  return result.matches
}

export async function readFile(filePath) {
  const result = await post('/api/read-file', { path: filePath })
  return result.content
}

export async function writeFile(filePath, content) {
  const result = await post('/api/write-file', { path: filePath, content })
  return result.modified
}

export async function deleteFile(filePath) {
  await post('/api/delete-file', { path: filePath })
}

export async function renameFile(oldPath, newPath) {
  await post('/api/rename-file', { oldPath, newPath })
}

export async function createFolder(name) {
  await post('/api/create-folder', { name })
}

export async function moveFile(oldPath, newPath) {
  await post('/api/move-file', { oldPath, newPath })
}

export async function renameFolder(oldPath, newPath) {
  await post('/api/rename-folder', { oldPath, newPath })
}

// ── Stories ───────────────────────────────────────────────────────────────

export async function createStory(name) {
  await post('/api/create-story', { name })
}

export async function deleteFolder(folderPath) {
  await post('/api/delete-folder', { path: folderPath })
}

// ── Config ─────────────────────────────────────────────────────────────────

export async function configSet(key, val) {
  await post('/api/config/set', { key, value: val })
}

export async function configGet(key, defaultVal) {
  const result = await post('/api/config/get', { key, defaultValue: defaultVal })
  return result.value
}

// ── Secure storage ─────────────────────────────────────────────────────────

export async function secureSet(key, val) {
  await post('/api/secure/set', { key, value: val })
}

export async function secureGet(key) {
  const result = await post('/api/secure/get', { key })
  return result.value
}

export async function setClaudeKey(key) {
  return secureSet('claudeApiKey', key)
}

export async function getClaudeKey() {
  return secureGet('claudeApiKey')
}

export async function setOpenAIKey(key) {
  return secureSet('openaiApiKey', key)
}

export async function getOpenAIKey() {
  return secureGet('openaiApiKey')
}

// ── Image upload ───────────────────────────────────────────────────────────

export async function openImage() {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/jpeg,image/png,image/webp'
    input.onchange = async () => {
      const file = input.files[0]
      if (!file) return resolve(null)

      const formData = new FormData()
      formData.append('image', file)

      const res = await fetch('/api/upload-image', {
        method: 'POST',
        body: formData,
      })
      if (!res.ok) return resolve(null)
      const data = await res.json()
      resolve(data)
    }
    input.click()
  })
}

// ── AI services ────────────────────────────────────────────────────────────

export async function aiListModels() {
  return post('/api/ai/list-models')
}

export async function aiSuggestImagePrompts(text) {
  return post('/api/ai/suggest-image-prompts', { text })
}

export async function aiSuggestTextStyle(text, desc) {
  return post('/api/ai/suggest-text-style', { text, description: desc })
}

export async function aiGenerateImage(prompt) {
  const result = await post('/api/ai/generate-image', { prompt })
  return result.dataUrl
}

// ── File helpers ───────────────────────────────────────────────────────────

export async function saveTempFile(buf, name) {
  return name
}

export async function saveFileDialog(opts) {
  return opts.defaultName || 'export'
}

export async function writeBase64(filePath, dataUrl) {
  const result = await post('/api/write-base64', { path: filePath, dataUrl })
  return result.path
}

export async function copyFile(src, dest) {
  return dest
}

// ── Video creation ─────────────────────────────────────────────────────────

export async function createReel(imageDataUrl, audioArrayBuffer, duration) {
  const audioBase64 = btoa(
    String.fromCharCode(...new Uint8Array(audioArrayBuffer)),
  )
  const result = await post('/api/video/create-reel', {
    imageDataUrl,
    audioBase64,
    duration,
  })
  return result.dataUrl
}
