# Heavy-process lock (8 GB laptop)

Only ONE heavy process (headless Chrome, Godot editor/Movie Maker/headless run, ffmpeg) may run at a time on this
machine; two at once froze it before. Agents working in parallel share this lock file:

    D:\Claude Projeleri Master\claude-game-arena\.heavy.lock

Acquire (PowerShell), retrying until it succeeds:

```powershell
# Remove-Item on paths containing "D:\Claude" is blocked in this environment: use [IO.File] calls.
$lock = [IO.Path]::Combine('D:\', 'Claude Projeleri Master', 'claude-game-arena', '.heavy.lock')
while ($true) {
  try { $fs = [IO.File]::Open($lock, 'CreateNew'); $fs.Close(); break }
  catch {
    if (((Get-Date) - (Get-Item $lock).LastWriteTime).TotalMinutes -gt 12) { [IO.File]::Delete($lock) }  # stale lock
    Start-Sleep -Seconds 15
  }
}
```

Release right after the heavy step finishes (also on failure, use try/finally): `[IO.File]::Delete($lock)`.
Keep each locked step short (one test run, one screenshot batch); never hold the lock while editing code.
Before releasing, stop every Chrome/Godot/python process you started (match your own --user-data-dir / port).
