const { app, BrowserWindow, ipcMain, dialog, safeStorage, net } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

const store = new Store();
let mainWindow;

// ═══════════════════════════════════════════════════════════════════════════
// WINDOW
// ═══════════════════════════════════════════════════════════════════════════
function createWindow() {
  const bounds = store.get('windowBounds', { width: 1200, height: 800 });
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
  });

  // In dev, electron-vite serves from dev server; in production, load built files
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('close', () => {
    store.set('windowBounds', mainWindow.getBounds());
  });
}

app.whenReady().then(() => {
  createWindow();
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ═══════════════════════════════════════════════════════════════════════════
// FILE SYSTEM IPC
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('dialog:openDirectory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (result.canceled) return null;
  const dirPath = result.filePaths[0];
  store.set('lastDirectory', dirPath);
  return dirPath;
});

ipcMain.handle('store:getLastDirectory', () => {
  return store.get('lastDirectory', null);
});

ipcMain.handle('fs:scanDirectory', async (_, dirPath) => {
  const files = {};  // relPath → { modified }
  const dirs = {};   // relPath → true

  async function scan(dir, prefix) {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.name === 'poems-meta.json') continue;
      if (['INDEX.html', 'watch_poems.ps1', 'start_watcher.vbs'].includes(entry.name)) continue;

      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        dirs[rel] = true;
        await scan(full, rel);
      } else if (entry.name.endsWith('.md')) {
        try {
          const stat = await fs.stat(full);
          files[rel] = { modified: stat.mtimeMs };
        } catch { /* skip unreadable */ }
      }
    }
  }

  await scan(dirPath, '');
  return { files, dirs };
});

ipcMain.handle('fs:readFile', async (_, filePath) => {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (e) {
    if (e.code === 'ENOENT') return '';
    throw e;
  }
});

ipcMain.handle('fs:writeFile', async (_, filePath, content) => {
  await fs.writeFile(filePath, content, 'utf-8');
  const stat = await fs.stat(filePath);
  return stat.mtimeMs;
});

ipcMain.handle('fs:deleteFile', async (_, filePath) => {
  await fs.unlink(filePath);
});

ipcMain.handle('fs:renameFile', async (_, oldPath, newPath) => {
  await fs.rename(oldPath, newPath);
});

// ═══════════════════════════════════════════════════════════════════════════
// SECURE STORAGE
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('secure:set', (_, key, value) => {
  if (!safeStorage.isEncryptionAvailable()) {
    store.set(`secure.${key}`, value);
    return;
  }
  const encrypted = safeStorage.encryptString(value);
  store.set(`secure.${key}`, encrypted.toString('base64'));
  store.set(`secure.${key}_enc`, true);
});

ipcMain.handle('secure:get', (_, key) => {
  const val = store.get(`secure.${key}`);
  if (!val) return null;
  if (!store.get(`secure.${key}_enc`)) return val;
  try {
    const buffer = Buffer.from(val, 'base64');
    return safeStorage.decryptString(buffer);
  } catch {
    return null;
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// INSTAGRAM OAUTH (placeholder — needs Facebook App ID)
// ═══════════════════════════════════════════════════════════════════════════
ipcMain.handle('auth:instagram', async () => {
  const clientId = store.get('facebookAppId', '');
  if (!clientId) throw new Error('Facebook App ID not configured');

  const redirectUri = 'https://localhost/callback';
  const scope = 'instagram_basic,instagram_content_publish,pages_show_list';

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?`
    + `client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`
    + `&scope=${scope}&response_type=code`;

  return new Promise((resolve, reject) => {
    const authWin = new BrowserWindow({
      width: 600, height: 700,
      parent: mainWindow,
      modal: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true },
    });

    authWin.loadURL(authUrl);

    authWin.webContents.on('will-redirect', async (_, url) => {
      if (!url.startsWith(redirectUri)) return;
      const code = new URL(url).searchParams.get('code');
      authWin.close();

      if (code) {
        resolve({ code });
      } else {
        reject(new Error('No authorization code received'));
      }
    });

    authWin.on('closed', () => reject(new Error('Auth window closed')));
  });
});
