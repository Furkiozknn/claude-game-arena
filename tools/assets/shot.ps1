# Headless Chrome screenshot that waits for Chrome to finish, then kills only its own processes.
# Usage: powershell -File shot.ps1 <url> <out.png (no spaces)> [w] [h] [virtual-ms]
param([Parameter(Mandatory)][string]$Url, [Parameter(Mandatory)][string]$Out, [int]$W = 1280, [int]$H = 720, [int]$Vt = 12000)
$chrome = Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
$tag = 'shot-prof-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
$prof = Join-Path $env:TEMP $tag
try {
  Start-Process $chrome -ArgumentList "--headless=new --user-data-dir=$prof --hide-scrollbars --mute-audio --window-size=$W,$H --virtual-time-budget=$Vt --screenshot=$Out `"$Url`"" -Wait
} finally {
  Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like "*$tag*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  Remove-Item -Recurse -Force $prof -ErrorAction SilentlyContinue
}
Write-Output $Out
