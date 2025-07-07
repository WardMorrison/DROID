; Custom installer actions for DROID

!macro customInstall
  SetOutPath $TEMP
  ; Check if Ollama is already installed
  ClearErrors
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall\Ollama" "DisplayName"
  IfErrors 0 SkipOllamaInstall
  ; Download and install Ollama
  DetailPrint "Downloading Ollama..."
  NSISdl::download "https://github.com/ollama/ollama/releases/latest/download/ollama-windows-amd64.exe" "$TEMP\ollama-installer.exe"
  Pop $R0
  StrCmp $R0 "success" +3
  MessageBox MB_OK "Failed to download Ollama. Please install manually from ollama.com"
  Goto SkipOllamaInstall
  DetailPrint "Installing Ollama..."
  ExecWait "$TEMP\ollama-installer.exe /S" $R0
  SkipOllamaInstall:
  ; Start Ollama service
  DetailPrint "Starting Ollama service..."
  ExecWait "sc create ollama binPath= '$PROGRAMFILES\Ollama\ollama.exe serve' start= auto"
  ExecWait "sc start ollama"
  ; Wait for service to start
  Sleep 3000
  ; Pull the AI model
  DetailPrint "Downloading AI model (this may take a few minutes)..."
  ExecWait "ollama pull llama3.2:3b" $R0
  ; Clean up
  Delete "$TEMP\ollama-installer.exe"
!macroend