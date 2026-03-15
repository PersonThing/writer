const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // File system
  openDirectory: () => ipcRenderer.invoke('dialog:openDirectory'),
  scanDirectory: (dirPath) => ipcRenderer.invoke('fs:scanDirectory', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('fs:readFile', filePath),
  writeFile: (filePath, content) =>
    ipcRenderer.invoke('fs:writeFile', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('fs:deleteFile', filePath),
  renameFile: (oldPath, newPath) =>
    ipcRenderer.invoke('fs:renameFile', oldPath, newPath),

  // Config
  getLastDirectory: () => ipcRenderer.invoke('store:getLastDirectory'),
  configSet: (key, val) => ipcRenderer.invoke('config:set', key, val),
  configGet: (key, defaultVal) =>
    ipcRenderer.invoke('config:get', key, defaultVal),

  // Secure storage
  secureSet: (key, val) => ipcRenderer.invoke('secure:set', key, val),
  secureGet: (key) => ipcRenderer.invoke('secure:get', key),

  // Convenience
  setClaudeKey: (key) => ipcRenderer.invoke('secure:set', 'claudeApiKey', key),
  getClaudeKey: () => ipcRenderer.invoke('secure:get', 'claudeApiKey'),
  setOpenAIKey: (key) => ipcRenderer.invoke('secure:set', 'openaiApiKey', key),
  getOpenAIKey: () => ipcRenderer.invoke('secure:get', 'openaiApiKey'),

  // Image dialog
  openImage: () => ipcRenderer.invoke('dialog:openImage'),

  // AI services
  aiListModels: () => ipcRenderer.invoke('ai:listModels'),
  aiSuggestImagePrompts: (text) =>
    ipcRenderer.invoke('ai:suggestImagePrompts', text),
  aiSuggestTextStyle: (text, desc) =>
    ipcRenderer.invoke('ai:suggestTextStyle', text, desc),
  aiGenerateImage: (prompt) => ipcRenderer.invoke('ai:generateImage', prompt),

  // File helpers
  saveTempFile: (arrayBuffer, filename) =>
    ipcRenderer.invoke('fs:saveTempFile', arrayBuffer, filename),
  saveFileDialog: (options) => ipcRenderer.invoke('dialog:saveFile', options),
  writeBase64: (filePath, dataUrl) =>
    ipcRenderer.invoke('fs:writeBase64', filePath, dataUrl),
  copyFile: (src, dest) => ipcRenderer.invoke('fs:copyFile', src, dest),

  // Video creation
  createReel: (imageDataUrl, audioArrayBuffer, duration) =>
    ipcRenderer.invoke('video:createReel', imageDataUrl, audioArrayBuffer, duration),
})
