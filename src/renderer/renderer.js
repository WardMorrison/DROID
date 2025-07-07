const { ipcRenderer } = require('electron');

const commandInput = document.getElementById('commandInput');
const responseArea = document.getElementById('responseArea');
const responseText = document.getElementById('responseText');
const commandOutput = document.getElementById('commandOutput');
const aiToggle = document.getElementById('aiToggle');

let isProcessing = false;

// Focus input when window shows
window.addEventListener('load', async () => {
    commandInput.focus();
    await updateAIStatus();
});

// AI toggle functionality
aiToggle.addEventListener('click', async () => {
    const result = await ipcRenderer.invoke('toggle-ai-mode');
    updateAIToggle(result.useLocal);
    showResponse(result.message, '', 'success');
});

async function updateAIStatus() {
    const status = await ipcRenderer.invoke('get-ai-status');
    updateAIToggle(status.useLocal);
}

function updateAIToggle(useLocal) {
    aiToggle.textContent = useLocal ? 'LOCAL' : 'CLOUD';
    aiToggle.className = `ai-toggle ${useLocal ? 'local' : 'cloud'}`;
}

// Handle input events
commandInput.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !isProcessing) {
        const command = commandInput.value.trim();
        if (command) {
            await executeCommand(command);
        }
    } else if (e.key === 'Escape') {
        await hideWindow();
    }
});

// Clear input when focused
commandInput.addEventListener('focus', () => {
    commandInput.select();
});

async function executeCommand(command) {
    if (isProcessing) return;
    
    isProcessing = true;
    
    // Show loading state
    showResponse('Processing...', '', 'loading');
    
    try {
        const result = await ipcRenderer.invoke('execute-command', command);
        
        if (result.success) {
            showResponse(
                result.aiResponse, 
                result.commandOutput || '', 
                'success'
            );
            
            // Clear input after successful execution
            setTimeout(() => {
                commandInput.value = '';
                hideWindow();
            }, 2000);
            
        } else if (result.needsClarification) {
            showResponse(result.aiResponse, '', 'error');
            // Keep input focused for clarification
            commandInput.focus();
            
        } else {
            showResponse(
                result.error || 'Command failed', 
                '', 
                'error'
            );
        }
        
    } catch (error) {
        showResponse('Error: ' + error.message, '', 'error');
    }
    
    isProcessing = false;
}

function showResponse(text, output, type = '') {
    responseText.textContent = text;
    responseText.className = `response-text ${type}`;
    
    if (output) {
        commandOutput.textContent = output;
        commandOutput.style.display = 'block';
    } else {
        commandOutput.style.display = 'none';
    }
    
    responseArea.classList.add('show');
    
    // Auto-hide response after some time for non-error messages
    if (type !== 'error') {
        setTimeout(() => {
            responseArea.classList.remove('show');
        }, 5000);
    }
}

async function hideWindow() {
    await ipcRenderer.invoke('hide-window');
    // Clear response when hiding
    responseArea.classList.remove('show');
    commandInput.value = '';
}

// Handle window focus/blur
window.addEventListener('blur', () => {
    setTimeout(hideWindow, 100);
});

window.addEventListener('focus', () => {
    commandInput.focus();
});