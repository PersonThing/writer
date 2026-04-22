/**
 * UI store — transient UI state for modals, toast, context menu.
 * Uses a single $state object so properties can be mutated from other modules.
 */

export const ui = $state({
  // Context menu
  ctxVisible: false,
  ctxX: 0,
  ctxY: 0,
  ctxPath: null,
  ctxKind: 'file', // 'file' | 'folder'

  // Toast
  toastVisible: false,
  toastMessage: 'Saved',

  // Modals
  statusEditorOpen: false,
  cleanupOpen: false,
  helpOpen: false,

  // Modal dialog (confirm / prompt / alert)
  modal: null,

  // "Move to story" flow: path of the file being moved, or null.
  moveToStoryFor: null,

  // AI Insights overlay. When `insightsStoryId` is non-null the
  // InsightsView is mounted over the editor area.
  insightsStoryId: null,

  // App view
  appReady: false,
  activeTab:
    typeof location !== 'undefined' && location.hash === '#stories'
      ? 'short-stories'
      : 'poetry',

  // Dark mode
  darkMode:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('darkMode') === 'true'
      : false,

  // Sidebar collapsed
  sidebarCollapsed:
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('sidebarCollapsed') === 'true'
      : false,

  // Editor font-size multiplier (1.0 = default, 0.5 – 3.0).
  editorFontScale: (() => {
    if (typeof localStorage === 'undefined') return 1
    const v = parseFloat(localStorage.getItem('editorFontScale') || '1')
    if (!Number.isFinite(v)) return 1
    return Math.max(0.5, Math.min(3, v))
  })(),
})

export function openInsights(storyId) {
  ui.insightsStoryId = storyId
}
export function closeInsights() {
  ui.insightsStoryId = null
}

export function toggleSidebar() {
  ui.sidebarCollapsed = !ui.sidebarCollapsed
  localStorage.setItem('sidebarCollapsed', String(ui.sidebarCollapsed))
}

export function setEditorFontScale(scale) {
  const clamped = Math.max(0.5, Math.min(3, Number(scale) || 1))
  ui.editorFontScale = clamped
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('editorFontScale', String(clamped))
  }
}

// ── Context menu ─────────────────────────────────────────────────────────
export function showContextMenu(x, y, path, kind = 'file') {
  const vw = window.innerWidth
  const vh = window.innerHeight
  ui.ctxX = x + 190 > vw ? vw - 200 : x
  ui.ctxY = y + 230 > vh ? vh - 240 : y
  ui.ctxPath = path
  ui.ctxKind = kind
  ui.ctxVisible = true
}

export function hideContextMenu() {
  ui.ctxVisible = false
  ui.ctxPath = null
  ui.ctxKind = 'file'
}

// ── Toast ────────────────────────────────────────────────────────────────
let _toastTimer
export function showToast(msg = 'Saved') {
  ui.toastMessage = msg
  ui.toastVisible = true
  clearTimeout(_toastTimer)
  _toastTimer = setTimeout(() => {
    ui.toastVisible = false
  }, 1800)
}

// ── Dark mode ────────────────────────────────────────────────────────────
export function toggleDarkMode() {
  ui.darkMode = !ui.darkMode
  localStorage.setItem('darkMode', String(ui.darkMode))
}

// ── Modal dialogs (replaces confirm / prompt / alert) ────────────────────
// Modal state lives on `ui` so the ModalDialog component can react to it.
// Each function returns a Promise that resolves when the user responds.
let _modalResolve = null

function _openModal(
  type,
  message,
  {
    placeholder = '',
    defaultValue = '',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
  } = {},
) {
  return new Promise((resolve) => {
    _modalResolve = resolve
    ui.modal = {
      type,
      message,
      placeholder,
      defaultValue,
      inputValue: defaultValue,
      confirmLabel,
      cancelLabel,
    }
  })
}

export function modalResolve(value) {
  if (_modalResolve) {
    _modalResolve(value)
    _modalResolve = null
  }
  ui.modal = null
}

/** Like confirm() — resolves true/false */
export function modalConfirm(message, opts) {
  return _openModal('confirm', message, opts)
}

/** Like prompt() — resolves string or null */
export function modalPrompt(message, opts) {
  return _openModal('prompt', message, opts)
}

/** Like alert() — resolves undefined when dismissed */
export function modalAlert(message, opts) {
  return _openModal('alert', message, { confirmLabel: 'OK', ...opts })
}
