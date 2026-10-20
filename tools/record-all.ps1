# Records one gameplay clip per game (one Chrome at a time; the PC is weak).
# Output: media\<name>.mp4 and media\<name>.gif in the hub repo.
$ErrorActionPreference = 'Continue'
$hub = Split-Path $PSScriptRoot -Parent
$media = Join-Path $hub 'media'
New-Item -ItemType Directory -Force $media | Out-Null
$root = 'file:///D:/Claude%20Projeleri%20Master'
$clips = @(
  @{ name = 'hisar';       url = "$root/kale-savunmasi/index.html?auto&sim=640&lang=en&cam=2,30,34,6,0"; secs = 10; warm = 4 },
  @{ name = 'cay-ocagi';   url = "$root/cay-ocagi/index.html?auto&sim=1000&lang=en";                     secs = 10; warm = 4 },
  @{ name = 'cini-ustasi'; url = "$root/cini-ustasi/index.html?auto&fresh&nohowto&level=1&lang=en";       secs = 12; warm = 3 },
  @{ name = 'marti';       url = "$root/marti/index.html?auto&sim=150&lang=en";                            secs = 10; warm = 4 }
)
foreach ($c in $clips) {
  $t0 = Get-Date
  # ffmpeg cannot write to a path with spaces through the concat step reliably, so render to a temp name first
  $tmp = Join-Path $env:TEMP "clip-$($c.name)"
  node (Join-Path $PSScriptRoot 'capture.mjs') $c.url $tmp $c.secs $c.warm 2>&1 | ForEach-Object { "[$($c.name)] $_" }
  foreach ($ext in 'mp4', 'gif') { if (Test-Path "$tmp.$ext") { Move-Item "$tmp.$ext" (Join-Path $media "$($c.name).$ext") -Force } }
  "[$($c.name)] done in $([math]::Round(((Get-Date) - $t0).TotalMinutes, 1)) min"
}
Get-ChildItem $media | ForEach-Object { "{0} {1} KB" -f $_.Name, [math]::Round($_.Length / 1KB) }
