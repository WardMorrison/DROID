const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const axios = require('axios');

let mainWindow;
let isVisible = false;

function createWindow() {
  // Get primary display dimensions
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;
  
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 600,
    height: 200,
    x: Math.round((screenWidth - 600) / 2),
    y: Math.round(screenHeight * 0.2), // Position in upper 20% of screen
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true
    }
  });

  mainWindow.loadFile('src/renderer/index.html');

  // Hide window instead of closing
  mainWindow.on('blur', () => {
    hideWindow();
  });

  // Development tools
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }
}

function showWindow() {
  if (!isVisible) {
    mainWindow.show();
    mainWindow.focus();
    isVisible = true;
  }
}

function hideWindow() {
  if (isVisible) {
    mainWindow.hide();
    isVisible = false;
  }
}

// IPC handlers
ipcMain.handle('execute-command', async (event, command) => {
  try {
    // First, get AI interpretation of the command
    const aiResponse = await getAIResponse(command);
    
    // Execute the command if AI provides a shell command
    if (aiResponse.shellCommand) {
      const result = await executeShellCommand(aiResponse.shellCommand);
      return {
        success: true,
        aiResponse: aiResponse.explanation,
        commandOutput: result
      };
    } else {
      return {
        success: false,
        aiResponse: aiResponse.explanation,
        needsClarification: true
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
});

ipcMain.handle('hide-window', () => {
  hideWindow();
});

// AI Integration with Ollama
async function getAIResponse(userCommand) {
  // Detect platform for appropriate commands
  const platform = process.platform;
  const isWindows = platform === 'win32';
  const isMac = platform === 'darwin';
  
  const platformInfo = isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux';
  
  const prompt = `You are DROID, a command execution assistant for ${platformInfo}. Convert this natural language request into a ${platformInfo} shell command.

User request: "${userCommand}"

Respond with JSON in this exact format:
{
  "shellCommand": "the actual command to execute (or null if you need clarification)",
  "explanation": "brief explanation of what this will do"
}

${isWindows ? `Windows Examples:
- "install chrome" -> {"shellCommand": "winget install Google.Chrome", "explanation": "Installing Google Chrome using Windows Package Manager"}
- "open calculator" -> {"shellCommand": "calc", "explanation": "Opening Windows Calculator"}
- "list files" -> {"shellCommand": "dir", "explanation": "Listing files in current directory"}` : ''}

${isMac ? `macOS Examples:
- "install chrome" -> {"shellCommand": "brew install --cask google-chrome", "explanation": "Installing Google Chrome using Homebrew"}
- "open calculator" -> {"shellCommand": "open -a Calculator", "explanation": "Opening macOS Calculator"}
- "list files" -> {"shellCommand": "ls -la", "explanation": "Listing files in current directory"}` : ''}

If the request is unclear or potentially dangerous, set shellCommand to null and explain what clarification you need.`;

  try {
    // Try multiple connection URLs for better compatibility
    const urls = [
      'http://127.0.0.1:11434/api/generate',
      'http://localhost:11434/api/generate',
      'http://[::1]:11434/api/generate'
    ];
    
    let response;
    let lastError;
    
    for (const url of urls) {
      try {
        response = await axios.post(url, {
          model: 'llama3.2:3b',
          prompt: prompt,
          stream: false,
          options: {
            temperature: 0.1,
            top_k: 10,
            top_p: 0.3,
            num_predict: 150
          }
        }, {
          timeout: 10000 // 10 second timeout
        });
        break; // Success, exit loop
      } catch (err) {
        lastError = err;
        continue; // Try next URL
      }
    }
    
    if (!response) {
      throw lastError;
    }

    const aiText = response.data.response;
    
    // Extract JSON from AI response
    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    } else {
      return {
        shellCommand: null,
        explanation: "I couldn't understand that request. Please try rephrasing."
      };
    }
  } catch (error) {
    console.error('Ollama API Error:', error);
    return {
      shellCommand: null,
      explanation: "AI service is not available. Make sure Ollama is running with 'ollama serve'"
    };
  }
}

// Execute shell commands safely
function executeShellCommand(command) {
  return new Promise((resolve, reject) => {
    const { exec } = require('child_process');
    
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

// App event handlers
app.whenReady().then(() => {
  createWindow();
  
  // Register global hotkey (Ctrl+Space)
  const ret = globalShortcut.register('CommandOrControl+Space', () => {
    if (isVisible) {
      hideWindow();
    } else {
      showWindow();
    }
  });

  if (!ret) {
    console.log('Global hotkey registration failed');
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});