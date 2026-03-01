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

  // Toast
  toastVisible: false,
  toastMessage: 'Saved',

  // Modals
  statusEditorOpen: false,
  settingsOpen: false,
  cleanupOpen: false,
  helpOpen: false,

  // App view
  appReady: false,

  // Dark mode
  darkMode: typeof localStorage !== 'undefined'
    ? localStorage.getItem('darkMode') === 'true'
    : false,
});

// ── Context menu ─────────────────────────────────────────────────────────
export function showContextMenu(x, y, path) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  ui.ctxX = x + 190 > vw ? vw - 200 : x;
  ui.ctxY = y + 230 > vh ? vh - 240 : y;
  ui.ctxPath = path;
  ui.ctxVisible = true;
}

export function hideContextMenu() {
  ui.ctxVisible = false;
  ui.ctxPath = null;
}

// ── Toast ────────────────────────────────────────────────────────────────
let _toastTimer;
export function showToast(msg = 'Saved') {
  ui.toastMessage = msg;
  ui.toastVisible = true;
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { ui.toastVisible = false; }, 1800);
}

// ── Dark mode ────────────────────────────────────────────────────────────
export function toggleDarkMode() {
  ui.darkMode = !ui.darkMode;
  localStorage.setItem('darkMode', String(ui.darkMode));
}
