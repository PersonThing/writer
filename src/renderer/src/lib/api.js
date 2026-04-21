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

// ── Auth ─────────────────────────────────────────────────────────────────

export async function getAuthState() {
  const res = await fetch('/auth/me')
  if (res.ok) {
    return { user: await res.json(), testLoginAvailable: false, allowedEmails: [] }
  }
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}))
    return {
      user: null,
      testLoginAvailable: !!body.testLoginAvailable,
      allowedEmails: body.allowedEmails || [],
    }
  }
  throw new Error(res.statusText)
}

export async function testLogin(email) {
  const res = await fetch('/auth/test-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error((await res.json()).error || res.statusText)
  return res.json()
}

export async function logout() {
  await fetch('/auth/logout', { method: 'POST' })
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

export async function reorderFiles(paths) {
  await post('/api/reorder-files', { paths })
}

export async function copyFile(sourcePath) {
  const result = await post('/api/copy-file', { sourcePath })
  return result.path
}

export async function renameFolder(oldPath, newPath) {
  await post('/api/rename-folder', { oldPath, newPath })
}

export async function setMeta(filePath, patch) {
  await post('/api/set-meta', { path: filePath, ...patch })
}

// ── Statuses ───────────────────────────────────────────────────────────────

export async function getStatuses() {
  return get('/api/statuses')
}

export async function saveStatuses(statuses) {
  await post('/api/statuses', { statuses })
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

