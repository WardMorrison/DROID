// setup.js
// This script will check for Ollama and install the llama model if needed

const { execSync } = require('child_process');

function isOllamaInstalled() {
  try {
    execSync('ollama --version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function installOllama() {
  if (process.platform === 'darwin') {
    execSync('brew install ollama', { stdio: 'inherit' });
  } else if (process.platform === 'linux') {
    execSync('curl -fsSL https://ollama.com/install.sh | sh', { stdio: 'inherit' });
  } else if (process.platform === 'win32') {
    console.log('Please install Ollama manually from https://ollama.com/download');
    process.exit(1);
  }
}

function isModelInstalled(model) {
  try {
    const result = execSync(`ollama list | grep ${model}`);
    return result.toString().includes(model);
  } catch {
    return false;
  }
}

function pullModel(model) {
  execSync(`ollama pull ${model}`, { stdio: 'inherit' });
}

const modelName = 'llama3.2:3b';

if (!isOllamaInstalled()) {
  console.log('Ollama not found. Installing...');
  installOllama();
}

if (!isModelInstalled(modelName)) {
  console.log(`Model ${modelName} not found. Downloading...`);
  pullModel(modelName);
} else {
  console.log(`Model ${modelName} is already installed.`);
}

console.log('Setup complete.');
