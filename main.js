const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const waitOn = require('wait-on');
const { autoUpdater } = require('electron-updater');

let mainWindow;
let serverProcess;
let updateNotified = false; // Guard: only show update dialog once per session

const PORT = 54321;

// ─────────────────────────────────────────────────────────────────────────────
// LOGGING — writes BOTH main-process and server-process events to one log file
// ─────────────────────────────────────────────────────────────────────────────
function getLogPath() {
  return path.join(app.getPath('userData'), 'gym_server_debug.log');
}

function logToFile(msg) {
  try {
    const line = `[${new Date().toISOString()}] ${msg}\n`;
    fs.appendFileSync(getLogPath(), line);
  } catch (e) { /* ignore write errors */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// WINDOW
// ─────────────────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: true,
    backgroundColor: '#1E1E1E',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'client/dist/icon-1.ico')
  });

  mainWindow.setMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // IPC: export logs to Desktop on demand
  ipcMain.on('export-logs', async () => {
    const os = require('os');
    const logPath = getLogPath();
    const desktopPath = path.join(os.homedir(), 'Desktop', 'gym_server_debug.log');

    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'question',
      buttons: ['Yes, Export', 'Cancel'],
      title: 'Export Diagnostic Logs',
      message: 'Did the application encounter an error?',
      detail: 'This will copy the hidden server logs to your Desktop so you can share them with support.'
    });

    if (response === 0) {
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

// ─────────────────────────────────────────────────────────────────────────────
// SERVER
// ─────────────────────────────────────────────────────────────────────────────
function startServer() {
  // Initialize the log file (clears old log on each startup)
  fs.writeFileSync(getLogPath(), `--- App Started: ${new Date().toISOString()} ---\n`);
  logToFile(`[Main] App version: ${app.getVersion()}`);
  logToFile('[Main] Starting backend server...');

  const serverPath = path.join(__dirname, 'server', 'server.js');
  const env = {
    ...process.env,
    PORT: PORT.toString(),
    NODE_ENV: 'production',
    ELECTRON_RUN_AS_NODE: '1'
  };

  serverProcess = spawn(process.execPath, [serverPath], { env });

  serverProcess.stdout.on('data', (data) => {
    logToFile(`[Server] ${data.toString().trim()}`);
  });

  serverProcess.stderr.on('data', (data) => {
    logToFile(`[Server ERROR] ${data.toString().trim()}`);
  });

  serverProcess.on('exit', (code) => {
    logToFile(`[Server] Process exited with code ${code}`);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTO UPDATER — all events logged to file so export button reveals exactly
// what is happening even if client/server are completely crashed
// ─────────────────────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  autoUpdater.autoDownload = true;          // Always download in background
  autoUpdater.autoInstallOnAppQuit = false; // We control restarts via dialog

  autoUpdater.on('checking-for-update', () => {
    logToFile('[AutoUpdater] Checking for update...');
  });

  autoUpdater.on('update-not-available', (info) => {
    logToFile(`[AutoUpdater] App is up to date. Current: ${app.getVersion()}, Latest: ${info.version}`);
  });

  autoUpdater.on('update-available', (info) => {
    logToFile(`[AutoUpdater] Update available: ${info.version}`);
    if (updateNotified) {
      logToFile('[AutoUpdater] Dialog already shown this session. Skipping.');
      return;
    }
    updateNotified = true;
    if (mainWindow) {
      dialog.showMessageBox(mainWindow, {
        type: 'info',
        title: 'Update Available',
        message: `Version ${info.version} is available!\n\nIt is downloading in the background. Watch your taskbar icon for progress.`,
        buttons: ['Okay']
      });
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
    const percent = Math.round(progressObj.percent);
    logToFile(`[AutoUpdater] Download progress: ${percent}% (${Math.round(progressObj.transferred / 1024)}KB / ${Math.round(progressObj.total / 1024)}KB)`);
    if (mainWindow) {
      mainWindow.setProgressBar(progressObj.percent / 100);
    }
  });

  autoUpdater.on('update-downloaded', async (info) => {
    logToFile(`[AutoUpdater] Download complete: ${info.version}. Waiting for user to confirm restart.`);
    if (mainWindow) {
      mainWindow.setProgressBar(-1);
    }
    const { response } = await dialog.showMessageBox(mainWindow, {
      type: 'info',
      title: 'Update Ready to Install',
      message: `Version ${info.version} has been downloaded.\n\nWould you like to restart the application now to apply the update?`,
      buttons: ['Restart Now', 'Later']
    });
    if (response === 0) {
      logToFile('[AutoUpdater] User chose to restart. Installing...');
      autoUpdater.quitAndInstall(false, true);
    } else {
      logToFile('[AutoUpdater] User chose Later. Will install on next restart.');
    }
  });

  autoUpdater.on('error', (err) => {
    logToFile(`[AutoUpdater ERROR] ${err.message}`);
    logToFile(`[AutoUpdater ERROR STACK] ${err.stack}`);
  });

  // Run check immediately on startup, then every 30 minutes
  function runCheck() {
    logToFile('[AutoUpdater] Initiating check...');
    autoUpdater.checkForUpdates().catch((err) => {
      logToFile(`[AutoUpdater] checkForUpdates() rejected: ${err.message}`);
    });
  }

  runCheck(); // Check on startup
  setInterval(runCheck, 30 * 60 * 1000); // Check every 30 minutes
}

// ─────────────────────────────────────────────────────────────────────────────
// APP LIFECYCLE
// ─────────────────────────────────────────────────────────────────────────────
app.on('ready', () => {
  createWindow();
  startServer();   // Initializes log file first, THEN starts server
  setupAutoUpdater(); // Now runs with log file guaranteed to exist

  waitOn({
    resources: [`tcp:127.0.0.1:${PORT}`],
    timeout: 120000,
  }).then(() => {
    logToFile('[Main] Backend ready. Loading frontend...');
    if (mainWindow) {
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
      mainWindow.maximize();
      mainWindow.show();
    }
  }).catch((err) => {
    logToFile(`[Main ERROR] Backend did not start in time: ${err.message}`);
    if (mainWindow) {
      mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
      mainWindow.show();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  logToFile('[Main] App quitting. Killing backend server.');
  if (serverProcess) {
    serverProcess.kill();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
