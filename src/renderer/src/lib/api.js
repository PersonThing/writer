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

// ── File upload (external drag-drop into sidebar) ─────────────────────────

export async function uploadFiles(files, targetFolder = '') {
  const formData = new FormData()
  for (const f of files) formData.append('files', f)
  formData.append('targetFolder', targetFolder)

  const res = await fetch('/api/upload-files', {
    method: 'POST',
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  const data = await res.json()
  return data.results
}

