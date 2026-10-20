# Renders a GLB from four sides with headless Chrome and saves a PNG next to it (<name>.preview.png).
# Usage: powershell -File preview.ps1 <path-to-glb-relative-to-projects-root> [lambert]
# Example: powershell -File preview.ps1 kale-savunmasi/assets/models/raider.glb
param([Parameter(Mandatory)][string]$Glb, [string]$Lambert = '')

$root = 'D:\Claude Projeleri Master'
$port = 8792
$chrome = Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
$profileDir = Join-Path $env:TEMP 'glb-preview-profile'
$out = Join-Path $root (($Glb -replace '\.glb$', '.preview.png') -replace '/', '\')
# Chrome's --screenshot path must not contain spaces, so render to temp first
$tmpShot = Join-Path $env:TEMP 'glb-preview.png'

$server = Start-Process python -ArgumentList "-m http.server $port --bind 127.0.0.1" -WorkingDirectory $root -WindowStyle Hidden -PassThru
try {
  Start-Sleep -Milliseconds 800
  $url = "http://127.0.0.1:$port/claude-game-arena/tools/assets/viewer.html?src=/$Glb"
  if ($Lambert) { $url += '&lambert=1' }
  Start-Process $chrome -ArgumentList "--headless=new --user-data-dir=$profileDir --hide-scrollbars --window-size=1200,900 --virtual-time-budget=15000 --screenshot=$tmpShot $url" -Wait
  Move-Item -Force $tmpShot $out
  Write-Output $out
} finally {
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*glb-preview-profile*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}
