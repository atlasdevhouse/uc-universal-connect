# UC Windows Agent — Connects to Vercel backend
# Runs silently, registers device, sends heartbeats
# Install: Place in AppData, run via Task Scheduler or registry

$ErrorActionPreference = "SilentlyContinue"

# === CONFIG ===
$SERVER = "https://uc-universal-connect-omega.vercel.app"
$HEARTBEAT_INTERVAL = 30  # seconds
$DEVICE_ID = "$env:COMPUTERNAME-$(Get-WmiObject Win32_ComputerSystemProduct | Select -ExpandProperty UUID)"

# === GATHER SYSTEM INFO ===
function Get-DeviceInfo {
    $os = (Get-WmiObject Win32_OperatingSystem).Caption
    $ip = (Get-NetIPAddress -AddressFamily IPv4 | Where { $_.IPAddress -ne "127.0.0.1" } | Select -First 1).IPAddress
    $screen = (Get-WmiObject Win32_VideoController | Select -First 1)
    $resolution = "$($screen.CurrentHorizontalResolution)x$($screen.CurrentVerticalResolution)"
    
    return @{
        deviceId   = $DEVICE_ID
        name       = $env:COMPUTERNAME
        os         = $os
        ip         = $ip
        resolution = $resolution
        userId     = "jay"
    }
}

# === REGISTER / HEARTBEAT ===
function Send-Heartbeat {
    $info = Get-DeviceInfo
    $json = $info | ConvertTo-Json -Compress
    
    try {
        $response = Invoke-RestMethod -Uri "$SERVER/api/devices" `
            -Method POST `
            -Body $json `
            -ContentType "application/json" `
            -TimeoutSec 10
        return $true
    } catch {
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
    
    $stream = New-Object System.IO.MemoryStream
    $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $bitmap.Dispose()
    
    $bytes = $stream.ToArray()
    $stream.Dispose()
    
    return [Convert]::ToBase64String($bytes)
}

# === HTTP LISTENER FOR REMOTE CONTROL ===
function Start-ControlListener {
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add("http://+:8765/")
    
    try {
        $listener.Start()
    } catch {
        # Fallback to localhost if no admin
        $listener = New-Object System.Net.HttpListener
        $listener.Prefixes.Add("http://localhost:8765/")
        $listener.Start()
    }
    
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response
        
        $response.Headers.Add("Access-Control-Allow-Origin", "*")
        $response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        $response.Headers.Add("Access-Control-Allow-Headers", "Content-Type")
        
        if ($request.HttpMethod -eq "OPTIONS") {
            $response.StatusCode = 200
            $response.Close()
            continue
        }
        
        $path = $request.Url.AbsolutePath
        $result = ""
        
        switch ($path) {
            "/health" {
                $result = '{"status":"ok","agent":"uc-windows","version":"2.0"}'
            }
            "/screenshot" {
                $base64 = Get-Screenshot
                $result = "{`"image`":`"$base64`"}"
            }
            "/click" {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                [System.Windows.Forms.Cursor]::Position = New-Object System.Drawing.Point($body.x, $body.y)
                
                $signature = '[DllImport("user32.dll")] public static extern void mouse_event(int f,int x,int y,int d,int i);'
                $mouseApi = Add-Type -MemberDefinition $signature -Name "WinMouse" -Namespace "UC" -PassThru
                $mouseApi::mouse_event(0x0002, 0, 0, 0, 0)  # down
                $mouseApi::mouse_event(0x0004, 0, 0, 0, 0)  # up
                
                $result = '{"ok":true}'
            }
            "/type" {
                $reader = New-Object System.IO.StreamReader($request.InputStream)
                $body = $reader.ReadToEnd() | ConvertFrom-Json
                [System.Windows.Forms.SendKeys]::SendWait($body.text)
                $result = '{"ok":true}'
            }
            "/info" {
                $info = Get-DeviceInfo
                $result = $info | ConvertTo-Json -Compress
            }
            default {
                $response.StatusCode = 404
                $result = '{"error":"not found"}'
            }
        }
        
        $buffer = [System.Text.Encoding]::UTF8.GetBytes($result)
        $response.ContentType = "application/json"
        $response.ContentLength64 = $buffer.Length
        $response.OutputStream.Write($buffer, 0, $buffer.Length)
        $response.Close()
    }
}

# === MAIN LOOP ===
Write-Host "UC Agent starting..."
Write-Host "Server: $SERVER"
Write-Host "Device: $DEVICE_ID"

# Start control listener in background
$listenerJob = Start-Job -ScriptBlock ${function:Start-ControlListener}

# Heartbeat loop
while ($true) {
    $ok = Send-Heartbeat
    if ($ok) {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Heartbeat OK"
    } else {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Heartbeat FAILED - retrying..."
    }
    Start-Sleep -Seconds $HEARTBEAT_INTERVAL
}
