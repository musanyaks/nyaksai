const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('nyaksai', {
  desktop: true,
  platform: process.platform,
  onCapture: (cb) => ipcRenderer.on('nyaksai:capture', () => cb()),
})
