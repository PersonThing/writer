const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // File system
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (dirPath) => ipcRenderer.invoke('fs:scanDirectory', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('fs:writeFile', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  renameFile: (oldPath, newPath) => ipcRenderer.invoke('fs:renameFile', oldPath, newPath),

  // Config
  getLastDirectory: () => ipcRenderer.invoke('store:getLastDirectory'),

  // Secure storage
  secureSet: (key, val) => ipcRenderer.invoke('secure:set', key, val),
  secureGet: (key) => ipcRenderer.invoke('secure:get', key),

  // Auth
  startInstagramAuth: () => ipcRenderer.invoke('auth:instagram'),

  // Convenience
  setClaudeKey: (key) => ipcRenderer.invoke('secure:set', 'claudeApiKey', key),
  getClaudeKey: () => ipcRenderer.invoke('secure:get', 'claudeApiKey'),
});
