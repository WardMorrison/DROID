const { app, BrowserWindow, globalShortcut, ipcMain, screen } = require('electron');
const path = require('path');
const axios = require('axios');
const Groq = require('groq-sdk');

let mainWindow;
let isVisible = false;
let useLocal = false; // Default to cloud API

// Initialize Groq client (will be set up after API key is configured)
let groqClient = null;

// Configuration for AI services
const AI_CONFIG = {
  // Default to free Groq API, fallback to local Ollama
  groqApiKey: process.env.GROQ_API_KEY || 'gsk_demo_key_for_testing', // Users will need to set this
  ollamaUrl: 'http://127.0.0.1:11434', // Use IPv4 explicitly
  localModel: 'llama3.2:3b'
};

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
    // First try cloud API, fallback to local
    const aiResponse = await getAIResponse(command);
    
    // Execute the command if AI provides a shell command
    if (aiResponse.shellCommand) {
      const result = await executeShellCommand(aiResponse.shellCommand);
      return {
        success: true,
        aiResponse: aiResponse.explanation,
        commandOutput: result,
        usedLocal: useLocal
      };
    } else {
      return {
        success: false,
        aiResponse: aiResponse.explanation,
        needsClarification: true,
        usedLocal: useLocal
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      usedLocal: useLocal
    };
  }
});

ipcMain.handle('hide-window', () => {
  hideWindow();
});

ipcMain.handle('toggle-ai-mode', () => {
  useLocal = !useLocal;
  return { useLocal, message: useLocal ? 'Switched to Local AI' : 'Switched to Cloud AI' };
});

ipcMain.handle('get-ai-status', () => {
  return { useLocal, groqAvailable: !!groqClient };
});

// AI Integration with Cloud + Local fallback
async function getAIResponse(userCommand) {
  // Detect platform for appropriate commands
  const platform = process.platform;
  const isWindows = platform === 'win32';
  const isMac = platform === 'darwin';
  
  const platformInfo = isWindows ? 'Windows' : isMac ? 'macOS' : 'Linux';
  
  const basePrompt = `You are DROID, a command execution assistant for ${platformInfo}. Convert this natural language request into a ${platformInfo} shell command.

User request: "${userCommand}"

Respond with JSON in this exact format:
{
  "shellCommand": "the actual command to execute (or null if you need clarification)",
  "explanation": "brief explanation of what this will do"
}

${isWindows ? `Windows Examples:
- "install chrome" -> {"shellCommand": "winget install Google.Chrome", "explanation": "Installing Google Chrome using Windows Package Manager"}
- "open calculator" -> {"shellCommand": "calc", "explanation": "Opening Windows Calculator"}
- "list files" -> {"shellCommand": "dir", "explanation": "Listing files in current directory"}
- "show processes" -> {"shellCommand": "tasklist", "explanation": "Showing running processes"}` : ''}

${isMac ? `macOS Examples:
- "install chrome" -> {"shellCommand": "brew install --cask google-chrome", "explanation": "Installing Google Chrome using Homebrew"}
- "open calculator" -> {"shellCommand": "open -a Calculator", "explanation": "Opening macOS Calculator"}
- "list files" -> {"shellCommand": "ls -la", "explanation": "Listing files in current directory"}
- "show processes" -> {"shellCommand": "ps aux", "explanation": "Showing running processes"}` : ''}

If the request is unclear or potentially dangerous, set shellCommand to null and explain what clarification you need.`;

  // Try cloud API first, then local fallback
  if (!useLocal) {
    try {
      return await getGroqResponse(basePrompt);
    } catch (error) {
      console.log('Cloud API failed, trying local...', error.message);
      useLocal = true; // Auto-switch to local on failure
    }
  }
  
  // Try local Ollama
  try {
    return await getOllamaResponse(basePrompt);
  } catch (error) {
    console.error('Both AI services failed:', error);
    return {
      shellCommand: null,
      explanation: "AI services are not available. Please check your internet connection or install Ollama locally."
    };
  }
}

// Cloud AI using Groq (FREE)
async function getGroqResponse(prompt) {
  if (!groqClient) {
    groqClient = new Groq({
      apiKey: AI_CONFIG.groqApiKey
    });
  }
  
  const completion = await groqClient.chat.completions.create({
    messages: [
      { role: "system", content: "You are DROID, a helpful command execution assistant. Always respond with valid JSON." },
      { role: "user", content: prompt }
    ],
    model: "llama3-8b-8192", // Fast, free model
    temperature: 0.1,
    max_tokens: 150
  });
  
  const aiText = completion.choices[0]?.message?.content || '';
  
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
}

// Local AI using Ollama (PRIVATE)
async function getOllamaResponse(prompt) {
  const response = await axios.post(`${AI_CONFIG.ollamaUrl}/api/generate`, {
    model: AI_CONFIG.localModel,
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
  
  // Initialize Groq client
  if (AI_CONFIG.groqApiKey && AI_CONFIG.groqApiKey !== 'gsk_demo_key_for_testing') {
    groqClient = new Groq({
      apiKey: AI_CONFIG.groqApiKey
    });
  }
  
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