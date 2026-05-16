const { app, BrowserWindow } = require('electron');
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
    show: false, // Wait until server is ready to show
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: path.join(__dirname, 'client/public/favicon.ico')
  });

  // Completely removes the menu bar
  mainWindow.setMenu(null);

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

function startServer() {
  const serverPath = path.join(__dirname, 'server', 'server.js');
  
  console.log('Starting Node.js backend...');
  
  // Set env vars for the backend
  const env = { 
    ...process.env, 
    PORT: PORT.toString(),
    NODE_ENV: 'production' 
  };

  serverProcess = spawn('node', [serverPath], { env });

  serverProcess.stdout.on('data', (data) => {
    console.log(`[Server]: ${data}`);
  });

  serverProcess.stderr.on('data', (data) => {
    console.error(`[Server Error]: ${data}`);
  });
}

app.on('ready', () => {
  createWindow();
  startServer();

  // Setup Auto Updater
  autoUpdater.checkForUpdatesAndNotify();

  autoUpdater.on('update-available', () => {
    console.log('[AutoUpdater] Update available.');
  });
  
  autoUpdater.on('update-downloaded', () => {
    console.log('[AutoUpdater] Update downloaded. Installing now...');
    autoUpdater.quitAndInstall(false, true); // (isSilent, isForceRunAfter)
  });

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
