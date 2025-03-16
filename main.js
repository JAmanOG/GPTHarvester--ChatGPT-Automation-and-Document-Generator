const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const url = require('url');
// import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
// import path from 'path';
// import fs from 'fs';
// import url from 'url';
const { runChatGPTAutomation, setupChromeProfile } = require('./chatgpt-bot.js');

// Handle creating/removing shortcuts on Windows when installing/uninstalling
if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'assets/icon.png')
  });

  // Load the index.html of the app
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // Open DevTools in development mode
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

// When Electron has finished initialization
app.whenReady().then(() => {
  createWindow();

  app.on('activate', function() {
    // On macOS, re-create a window when the dock icon is clicked and no other windows are open
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', function() {
  if (process.platform !== 'darwin') app.quit();
});

// Handle IPC messages from the renderer process
ipcMain.handle('run-chatgpt-automation', async (event, questions, options) => {
  try {
    const progressCallback = (progress) => {
      mainWindow.webContents.send('automation-progress', progress);
    };
    
    const results = await runChatGPTAutomation(questions, {
      ...options,
      progressCallback
    });
    
    return { success: true, results };
  } catch (error) {
    console.error('Automation error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('select-chrome-path', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Executables', extensions: ['exe'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('open-results-folder', () => {
  shell.showItemInFolder(path.resolve('./chatgpt_responses.docx'));
});

ipcMain.handle('load-saved-questions', () => {
  try {
    const savedQuestionsPath = path.join(app.getPath('userData'), 'saved_questions.json');
    if (fs.existsSync(savedQuestionsPath)) {
      return JSON.parse(fs.readFileSync(savedQuestionsPath, 'utf8'));
    }
  } catch (error) {
    console.error('Error loading saved questions:', error);
  }
  return [];
});

ipcMain.handle('save-questions', (event, questions) => {
    try {
      const savedQuestionsPath = path.join(app.getPath('userData'), 'saved_questions.json');
      console.log('Saving questions to:', savedQuestionsPath);
      fs.writeFileSync(savedQuestionsPath, JSON.stringify(questions, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving questions:', error);
      return false;
    }
  });
  
  ipcMain.handle('setup-chrome-profile', async (event, chromePath) => {
    try {
      return await setupChromeProfile(chromePath);
    } catch (error) {
      console.error("Error in setup-chrome-profile handler:", error);
      return false;
    }
  });
  
  ipcMain.handle('open-external-link', (event, url) => {
    shell.openExternal(url);
  });