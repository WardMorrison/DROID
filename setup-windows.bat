@echo off
echo Setting up DROID for Windows...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ERROR: Node.js is not installed. Please install Node.js from nodejs.org
    pause
    exit /b 1
)

echo Node.js found: 
node --version
echo.

REM Check if Ollama is installed
where ollama >nul 2>nul
if %errorlevel% neq 0 (
    echo Ollama not found. Installing Ollama...
    
    REM Download Ollama installer
    echo Downloading Ollama installer...
    powershell -Command "& {Invoke-WebRequest -Uri 'https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.exe' -OutFile 'ollama-installer.exe'}"
    
    REM Install Ollama
    echo Installing Ollama...
    ollama-installer.exe /S
    
    REM Clean up
    del ollama-installer.exe
    
    REM Add to PATH (requires restart)
    echo Adding Ollama to PATH...
    setx PATH "%PATH%;%USERPROFILE%\AppData\Local\Programs\Ollama"
    
    echo.
    echo Ollama installed! You may need to restart your command prompt.
    echo.
) else (
    echo Ollama found:
    ollama --version
    echo.
)

REM Start Ollama service
echo Starting Ollama service...
start /B ollama serve
timeout /t 5 /nobreak >nul

REM Pull the AI model
echo Pulling AI model (this may take a few minutes)...
ollama pull llama3.2:3b

REM Install npm dependencies
echo Installing Node.js dependencies...
call npm install

REM Build the application
echo Building DROID for Windows...
call npm run build:win

echo.
echo Setup complete! 
echo.
echo To run DROID:
echo   npm run dev        (development mode)
echo   npm run build:win  (build for Windows)
echo.
echo The Windows installer will be in the 'dist' folder.
echo.
pause