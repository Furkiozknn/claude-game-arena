# Overnight pass: HTML game (review fixes + redesign + assets)

```text
You are improving the round-1 browser game <GAME> in <REPO> (single index.html, Three.js r170, served on GitHub Pages).
The user asked for a thorough, honest overnight pass: find and fix everything broken, remove dead code, complete
missing systems, and redesign for a professional look and feel, consistent with the other arena games.

READ FIRST
- The review of this game: D:\Claude Projeleri Master\claude-game-arena\review\<review-file>.md (bugs P0/P1/P2, dead
  code, design-language gaps, parity notes, redesign ideas). Re-check each finding against the code before acting.
- Shared structure: D:\Claude Projeleri Master\claude-game-arena\docs\design-language.md.
- Asset rules and tools: D:\Claude Projeleri Master\claude-game-arena\prompts\asset-remaster.md (Higgsfield credit cap
  for this pass: <BUDGET> credits — check `balance` before/after and report exactly).
- Reference implementation already done: D:\Claude Projeleri Master\kale-savunmasi (asset loader with fallback,
  ?noassets, icon PNGs, crest) and the tools in D:\Claude Projeleri Master\claude-game-arena\tools\assets.
- Heavy-process lock (MANDATORY, another agent works in parallel):
  D:\Claude Projeleri Master\claude-game-arena\docs\heavy-lock.md. Acquire it before every headless Chrome / ffmpeg /
  python-server+Chrome test, release right after. Never run heavy steps without it.

ORDER OF WORK
1. P0 and P1 bugs from the review (verify each, fix, note the fix).
2. Finish/complete missing systems from design-language.md: Settings panel (master/music/sfx sliders, TR/EN, Low/High
   quality, fullscreen), Pause menu (Resume/Restart/Settings/Main menu), Continue where the game has a run to resume
   (only if it is natural for the genre), consistent keys (P/Esc, M, X or game-specific, L), visible focus, 44 px touch
   targets, footer credit "Claude Game Arena · built by <model> · assets remastered" linking to
   https://furkiozknn.github.io/claude-game-arena/, settings saved under arena.<game>.settings (migrate old keys).
3. Assets (within budget): the high-value list from the review/asset plan. Look at every generated result.
4. Redesign: the top ideas from the review that you can finish and verify. Prefer fewer, finished improvements over
   many half-done ones. Do not change game rules/balance unless the review shows a real bug.
5. Remove verified dead code. P2 polish if time remains.

VERIFY (with the lock): ?auto bot run with ?debug: zero JS errors, bot result same or better than before (record the
before result first), draw calls/fps on the real GPU (tools/assets/fps.mjs) before vs after; screenshots of title,
gameplay, settings, pause, end screen, phone layout; file:// fallback still runs; ?noassets runs. Look at every
screenshot. Never claim something works that you did not check — list unverified items explicitly.

DOCUMENT: update docs/assets.md (asset table, credits), README.md (features, controls, settings, assets, flags), and add
a CHANGELOG section "2026-10-21 overnight pass" to README.md listing fixes, new systems, redesign, removed code.
Replace docs screenshots that are now outdated (keep file names referenced by README valid).

RULES: work only inside <REPO> (plus the scratchpad raw folder and claude-game-arena/tools/assets). Do not commit or
push (the orchestrator does after review). No global installs. Stop every process you start.

FINAL REPORT (concise): fixed bugs (id → fix), new systems, assets (kept/rejected, credits before/after), redesign
changes, removed code, verification numbers (before/after), screenshot paths, what is NOT done or unverified, and a
"PORT TO GODOT" list: every change the Godot version should receive (with file paths of new assets and any
rotation/scale numbers).
```
