// Thin wrapper around window.api exposed by preload.js
// Provides clean imports and a centralized place for error handling

const api = window.api

export const openDirectory = () => api.openDirectory()
export const scanDirectory = (dirPath) => api.scanDirectory(dirPath)
export const readFile = (filePath) => api.readFile(filePath)
export const writeFile = (filePath, content) => api.writeFile(filePath, content)
export const deleteFile = (filePath) => api.deleteFile(filePath)
export const renameFile = (oldPath, newPath) => api.renameFile(oldPath, newPath)
export const getLastDirectory = () => api.getLastDirectory()
export const secureSet = (key, val) => api.secureSet(key, val)
export const secureGet = (key) => api.secureGet(key)
export const startInstagramAuth = () => api.startInstagramAuth()
export const setClaudeKey = (key) => api.setClaudeKey(key)
export const getClaudeKey = () => api.getClaudeKey()
