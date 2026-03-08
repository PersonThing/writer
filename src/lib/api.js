// API layer — calls the Express backend over HTTP
// Replaces the Electron preload IPC bridge

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

async function put(url, body = {}) {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

// ── Directory browsing (replaces Electron dialog) ────────────────────────
export async function browseDirectories(dirPath) {
  const data = await post('/api/browse', { path: dirPath })
  return data
}

export async function openDirectory(dirPath) {
  // In the web version, the caller provides the path directly
  await put('/api/directories', { path: dirPath })
  return dirPath
}

export async function getLastDirectory() {
  const data = await get('/api/directories')
  return data.value
}

// ── File system ──────────────────────────────────────────────────────────
export async function scanDirectory(dirPath) {
  return post('/api/scan', { path: dirPath })
}

export async function readFile(filePath) {
  const data = await post('/api/fs/read', { path: filePath })
  return data.content
}

export async function writeFile(filePath, content) {
  const data = await post('/api/fs/write', { path: filePath, content })
  return data.modified
}

export async function deleteFile(filePath) {
  await post('/api/fs/delete', { path: filePath })
}

export async function renameFile(oldPath, newPath) {
  await post('/api/fs/rename', { oldPath, newPath })
}

// ── Config ───────────────────────────────────────────────────────────────
export async function configSet(key, val) {
  await put(`/api/config/${encodeURIComponent(key)}`, { value: val })
}

export async function configGet(key, defaultVal) {
  const data = await get(`/api/config/${encodeURIComponent(key)}`)
  return data.value !== null ? data.value : (defaultVal ?? null)
}

// ── Secure storage ───────────────────────────────────────────────────────
export async function secureSet(key, val) {
  await put(`/api/secure/${encodeURIComponent(key)}`, { value: val })
}

export async function secureGet(key) {
  const data = await get(`/api/secure/${encodeURIComponent(key)}`)
  return data.value
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

// ── Image upload (replaces Electron dialog:openImage) ────────────────────
export async function uploadImage(file) {
  const res = await fetch('/api/upload/image', {
    method: 'POST',
    headers: { 'Content-Type': file.type },
    body: file,
  })
  if (!res.ok) throw new Error('Upload failed')
  return res.json()
}

// ── AI services ──────────────────────────────────────────────────────────
export async function aiListModels() {
  const data = await get('/api/ai/models')
  return data.models
}

export async function aiSuggestImagePrompts(text) {
  const data = await post('/api/ai/suggest-image-prompts', { text })
  return data.suggestions
}

export async function aiSuggestTextStyle(text, desc) {
  const data = await post('/api/ai/suggest-text-style', {
    text,
    description: desc,
  })
  return data.style
}

export async function aiGenerateImage(prompt) {
  const data = await post('/api/ai/generate-image', { prompt })
  return data.dataUrl
}

// ── Export (browser download) ────────────────────────────────────────────
export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename || 'export.jpg'
  a.click()
}

// ── Video creation ───────────────────────────────────────────────────────
export async function createReel(imageDataUrl, audioBlob, duration) {
  // Convert audio blob to base64 for JSON transfer
  const audioBuffer = await audioBlob.arrayBuffer()
  const bytes = new Uint8Array(audioBuffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  const audioBase64 = `data:audio/webm;base64,${btoa(binary)}`

  const res = await fetch('/api/video/create-reel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl, audioBase64, duration }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Video creation failed' }))
    throw new Error(err.error)
  }
  return res.blob()
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── Social composer auto-save ────────────────────────────────────────────
export async function socialSave(projectRoot, poemPath, state) {
  return post('/api/social/save', { projectRoot, poemPath, state })
}

export async function socialLoad(projectRoot, poemPath) {
  const data = await post('/api/social/load', { projectRoot, poemPath })
  return data.state
}

export async function socialClear(projectRoot, poemPath) {
  return post('/api/social/clear', { projectRoot, poemPath })
}
