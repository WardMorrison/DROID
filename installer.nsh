; Custom installer actions for DROID

Section "Install Ollama" SEC_OLLAMA
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
  
SectionEnd

; Custom page for Ollama installation
Function .onInit
  ; Check if running on Windows
  ReadRegStr $R0 HKLM "SOFTWARE\Microsoft\Windows NT\CurrentVersion" "CurrentVersion"
  IfErrors 0 +3
  MessageBox MB_OK "This application requires Windows 10 or later."
  Quit
FunctionEnd

; Post-installation actions
Function .onInstSuccess
  ; Create desktop shortcut
  CreateShortCut "$DESKTOP\DROID.lnk" "$INSTDIR\DROID.exe"
  
  ; Add to startup (optional)
  MessageBox MB_YESNO "Would you like DROID to start automatically with Windows?" IDNO +2
  CreateShortCut "$SMSTARTUP\DROID.lnk" "$INSTDIR\DROID.exe"
  
  ; Show completion message
  MessageBox MB_OK "DROID has been installed successfully!$\n$\nPress Ctrl+Space to activate DROID anywhere in Windows."
FunctionEnd