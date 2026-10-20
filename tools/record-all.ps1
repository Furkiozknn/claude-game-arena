# Records one gameplay clip per game (one Chrome at a time; the PC is weak).
# Output: media\<name>.mp4 and media\<name>.gif in the hub repo.
$ErrorActionPreference = 'Continue'
$hub = Split-Path $PSScriptRoot -Parent
$media = Join-Path $hub 'media'
New-Item -ItemType Directory -Force $media | Out-Null
# Live GitHub Pages builds, so the generated assets load (file:// falls back to the procedural look)
$root = 'https://furkiozknn.github.io'
$clips = @(
  @{ name = 'hisar';       url = "$root/kale-savunmasi/?auto&sim=640&lang=en&cam=2,30,34,6,0"; secs = 10; warm = 14 },
  @{ name = 'cay-ocagi';   url = "$root/cay-ocagi/?auto&sim=1000&lang=en";                     secs = 10; warm = 14 },
  @{ name = 'cini-ustasi'; url = "$root/cini-ustasi/?auto&fresh&nohowto&level=1&lang=en";       secs = 12; warm = 14 },
  @{ name = 'marti';       url = "$root/marti/?auto&sim=45&lang=en";                            secs = 10; warm = 14 }
)
# Shared heavy-process lock (docs/heavy-lock.md): other agents may run Chrome or Godot at the same time
$lock = Join-Path $hub '.heavy.lock'
$only = $args
foreach ($c in $clips) {
  if ($only.Count -and $only -notcontains $c.name) { continue }
  while ($true) {
    try { $fs = [IO.File]::Open($lock, 'CreateNew'); $fs.Close(); break }
    catch { if (((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes -gt 12) { [IO.File]::Delete($lock) }; Start-Sleep -Seconds 10 }
  }
  $t0 = Get-Date
  # ffmpeg cannot write to a path with spaces through the concat step reliably, so render to a temp name first
  $tmp = Join-Path $env:TEMP "clip-$($c.name)"
  node (Join-Path $PSScriptRoot 'capture.mjs') $c.url $tmp $c.secs $c.warm 2>&1 | ForEach-Object { "[$($c.name)] $_" }
  foreach ($ext in 'mp4', 'gif') { if (Test-Path "$tmp.$ext") { Move-Item "$tmp.$ext" (Join-Path $media "$($c.name).$ext") -Force } }
  [IO.File]::Delete($lock)
  "[$($c.name)] done in $([math]::Round(((Get-Date) - $t0).TotalMinutes, 1)) min"
}
Get-ChildItem $media | ForEach-Object { "{0} {1} KB" -f $_.Name, [math]::Round($_.Length / 1KB) }
