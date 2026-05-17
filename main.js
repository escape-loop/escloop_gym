const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const waitOn = require('wait-on');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let serverProcess;

const PORT = 54321; // Fixed high port for the local backend

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true, // Show immediately with a dark background to indicate loading
    backgroundColor: '#1E1E1E', // Match your dark theme
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    // In production, Vite moves public assets directly into the dist folder
    icon: path.join(__dirname, process.env.NODE_ENV === 'production' ? 'client/dist/icon-1.ico' : 'client/public/icon-1.ico')
  });

  // Completely removes the menu bar
  mainWindow.setMenu(null);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });

  // Setup IPC handler for exporting logs
  ipcMain.on('export-logs', async (event) => {
    const fs = require('fs');
    const os = require('os');
    const logPath = path.join(app.getPath('userData'), 'gym_server_debug.log');
    const desktopPath = path.join(os.homedir(), 'Desktop', 'gym_server_debug.log');

    // Ask for confirmation
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Yes, Export', 'Cancel'],
      title: 'Export Diagnostic Logs',
      message: 'Did the application encounter an error?',
      detail: 'This will copy the hidden server logs to your Desktop so you can share them with support.'
    });

    if (response === 0) { // 'Yes, Export' clicked
      if (fs.existsSync(logPath)) {
        fs.copyFileSync(logPath, desktopPath);
        dialog.showMessageBox(mainWindow, {
          type: 'info',
          title: 'Success',
          message: 'Logs have been saved to your Desktop!'
        });
      } else {
        dialog.showMessageBox(mainWindow, {
          type: 'error',
          title: 'Not Found',
          message: 'No log file was found. The server may not have started yet.'
        });
      }
    }
  });
}

function startServer() {
  const serverPath = path.join(__dirname, 'server', 'server.js');
  
  console.log('Starting Node.js backend...');
  
  // Set env vars for the backend
  const env = { 
    ...process.env, 
    PORT: PORT.toString(),
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1'
  };

  serverProcess = spawn(process.execPath, [serverPath], { env });

  const fs = require('fs');
  const logPath = path.join(app.getPath('userData'), 'gym_server_debug.log');
  fs.writeFileSync(logPath, '--- Server Startup Log ---\n');

  serverProcess.stdout.on('data', (data) => {
    const msg = `[Server]: ${data}`;
    console.log(msg);
    fs.appendFileSync(logPath, msg);
  });

  serverProcess.stderr.on('data', (data) => {
    const msg = `[Server Error]: ${data}`;
    console.error(msg);
    fs.appendFileSync(logPath, msg);
  });
}

app.on('ready', () => {
  createWindow();
  startServer();

  // Auto Updater - register ALL listeners before checking
  autoUpdater.on('checking-for-update', () => {
    console.log('[AutoUpdater] Checking for update...');
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[AutoUpdater] App is up to date.');
  });

  autoUpdater.on('error', (err) => {
    console.error('[AutoUpdater] Error:', err.message);
  });

  autoUpdater.on('update-available', () => {
    dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Available',
      message: 'A new version is available! It is currently downloading in the background. Check your taskbar icon for progress...',
      buttons: ['Okay']
    });
  });

  // Show a progress bar on the application's taskbar icon
  autoUpdater.on('download-progress', (progressObj) => {
    if (mainWindow) {
      mainWindow.setProgressBar(progressObj.percent / 100);
    }
  });
  
  autoUpdater.on('update-downloaded', async () => {
    if (mainWindow) {
      mainWindow.setProgressBar(-1); // Remove the progress bar
    }
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready',
      message: 'The new version has been downloaded. Would you like to restart the application now to apply the updates?',
      buttons: ['Restart Now', 'Later']
    });
    
    if (response === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  // Check AFTER all listeners are registered
  autoUpdater.checkForUpdatesAndNotify();

  // Wait for the local server to be ready before loading the URL
  waitOn({
    resources: [`tcp:127.0.0.1:${PORT}`],
    timeout: 120000, // 120 seconds
  }).then(() => {
    console.log('Backend is ready. Loading frontend...');
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    mainWindow.maximize();
    mainWindow.show();
  }).catch((err) => {
    console.error('Failed to wait for backend:', err);
    // Even if it fails, try to load
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    mainWindow.show();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('activate', function () {
  if (mainWindow === null) {
    createWindow();
  }
});
