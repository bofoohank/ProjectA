const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('frameVault', {
  chooseFolders: () => ipcRenderer.invoke('library:choose-folders'),
  scan: () => ipcRenderer.invoke('library:scan'),
  getState: () => ipcRenderer.invoke('library:get-state'),
  updateItem: (id, patch) => ipcRenderer.invoke('library:update-item', id, patch),
  addCollection: (name) => ipcRenderer.invoke('library:add-collection', name),
  reveal: (path) => ipcRenderer.invoke('file:reveal', path),
  dragFile: (path, icon) => ipcRenderer.send('file:drag', path, icon),
  onDragError: (callback) => ipcRenderer.on('drag:error', (_, message) => callback(message)),
  onScanProgress: (callback) => ipcRenderer.on('scan:progress', (_, data) => callback(data))
});
