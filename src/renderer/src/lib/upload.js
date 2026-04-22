/**
 * Shared upload pipeline used by both the sidebar upload button and
 * drag-drop drops. Filters to accepted extensions, posts through the
 * upload API, refreshes project state, and surfaces the summary in
 * the toast / modal-alert UIs.
 */
import * as api from './api.js'
import { project } from './stores/project.svelte.js'
import { showToast, modalAlert } from './stores/ui.svelte.js'

export const ALLOWED_EXTS = ['md', 'txt', 'docx']

export function extOf(name) {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function isAllowedFile(file) {
  return ALLOWED_EXTS.includes(extOf(file.name))
}

/**
 * Upload the given File objects into `targetFolder` (empty string =
 * project root). Rejected files are reported in a modal; saved files
 * trigger a toast; server-side errors are listed in a modal.
 *
 * Returns { saved: number, rejected: number, errors: number } for the
 * caller's convenience.
 */
export async function handleFileUploads(files, targetFolder = '') {
  const accepted = files.filter(isAllowedFile)
  const rejected = files.filter((f) => !isAllowedFile(f))

  if (rejected.length) {
    await modalAlert(
      `Skipped ${rejected.length} unsupported file(s):\n` +
        rejected.map((f) => f.name).join('\n') +
        `\n\nAllowed: .${ALLOWED_EXTS.join(', .')}`,
    )
  }
  if (!accepted.length) {
    return { saved: 0, rejected: rejected.length, errors: 0 }
  }

  try {
    const results = await api.uploadFiles(accepted, targetFolder)
    await project.scanAll()
    if (targetFolder.startsWith('_stories/')) await project.scanStories()
    const saved = results.filter((r) => r.saved).length
    const errors = results.filter((r) => r.error && !r.skipped)
    if (saved) showToast(`Uploaded ${saved} file${saved === 1 ? '' : 's'}`)
    if (errors.length) {
      await modalAlert(
        'Errors:\n' + errors.map((r) => `${r.original}: ${r.error}`).join('\n'),
      )
    }
    return { saved, rejected: rejected.length, errors: errors.length }
  } catch (err) {
    await modalAlert('Upload failed: ' + err.message)
    return { saved: 0, rejected: rejected.length, errors: 1 }
  }
}
