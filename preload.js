const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    exportLogs: () => ipcRenderer.send('export-logs')
});
