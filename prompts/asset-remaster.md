# Asset remaster brief (round-1 browser games)

Shared brief for replacing the procedural placeholder assets of a round-1 game with generated assets, game by game.
The orchestrator fills in `<GAME>`, `<REPO>`, `<BUDGET>` and the game's inventory notes.

```text
Remaster the in-game assets of <GAME> (single-file Three.js r170 game in <REPO>\index.html). Read the whole
index.html, README.md and the inventory notes below first. Goal: replace weak procedural models, icons and textures
with higher-quality generated assets that match the game's existing look, without breaking gameplay, performance or
the game's tests.

TOOLS (verified by the orchestrator):
- Higgsfield MCP (mcp__claude_ai_higgsfield__*), already paid for by the user. Credit cap for this game: <BUDGET>
  credits. Check `balance` before and after and report the exact credits you spent. Always pass get_cost:true first
  when unsure. Do not buy credits, change plans or create projects.
  - 3D: generate_3d with model "tripo_3d" (text-to-3D, ~5 credits standard textures, 7.5 detailed). Use pbr:false,
    texture:true, face_limit to cap triangles. Prompt style that worked: "Low-poly stylized <thing> game asset, ...,
    toy-like clay look, flat simple colours, chunky proportions", negative_prompt "realistic, photoreal, base,
    pedestal, ground". Output is one mesh + one baseColor texture, height normalised to 1, often facing +X.
  - 2D: generate_image with model "gpt_image_2_5" (quality "high", resolution "1k"/"2k", background "transparent" for
    icons/sprites; ~0.5-2.75 credits) or "recraft_v4_1" with model_type "vector" for flat icons (~2.5). Generate icon
    SETS as one sheet (e.g. a 4x3 grid on a plain background) and slice it, so the style is consistent and cheap.
    remove_background exists for cut-outs.
  - Wait with jobs_wait. Results are https URLs: download with curl into
    C:\Users\furki\AppData\Local\Temp\claude\C--Windows-System32\e020d264-42ec-4e58-bcc7-962ef6c5a716\scratchpad\raw\<game>\
    (raw files never go into the repo).
  - Audio generation is NOT available for standalone use (the music/SFX models are reserved); improve audio in code
    only if it is cheap and clearly better, otherwise leave it.
- glTF processing, installed in D:\Claude Projeleri Master\claude-game-arena\tools\assets (run from there):
  `pnpm exec gltf-transform center in.glb out.glb --pivot below`, `resize --width 256 --height 256`, `webp`,
  `simplify --ratio 0.5`, `inspect`. sharp is installed for slicing/resizing images (node script).
- Preview a GLB from four sides: from that folder run
  `powershell -NoProfile -ExecutionPolicy Bypass -File preview.ps1 <repo-folder>/assets/models/<name>.glb lambert`
  (path relative to D:\Claude Projeleri Master), then look at the PNG it prints with the Read tool.

RULES FOR ASSETS
- Match the game: same palette, flat/low-poly toy look, readable from the game camera. Look at every result; regenerate
  (within budget) when it is off-style, wrong, broken or unreadable. Never ship an asset you have not looked at.
- Files: <REPO>\assets\models\<name>.glb (textures 256-1024 px WebP inside the GLB), <REPO>\assets\ui\<name>.png|webp
  (icons/logo), <REPO>\assets\textures\<name>.webp. Lower-case kebab-case names. Keep the total under ~4 MB per game.
- Performance target stays 60 fps on an Intel UHD 620 at 1280x720: keep triangle budgets (instanced objects ~300-1500
  tris, hero objects up to ~6000), keep InstancedMesh where the game uses it (take the GLB's geometry + texture into one
  InstancedMesh with MeshLambertMaterial({ map }), so instanceColor tints still work), keep draw calls low, keep `?low`.
- Normalise each model in code (or with gltf-transform): pivot at the base, +Y up, the game's forward axis, the size the
  game expects (match the old procedural model's footprint and any gameplay/collision dimensions exactly).

RULES FOR INTEGRATION
- Keep the procedural builders as the FALLBACK: load assets with GLTFLoader / TextureLoader / <img> at start-up
  (show the existing title screen with a small "loading assets" state, disable Play until done or failed), and if any
  asset fails to load (e.g. the page is opened from file://, where Chrome blocks fetch), keep the old procedural look.
  The game must never break because an asset is missing.
- Keep every existing test hook working (?auto, ?debug, ?sim=N, ?low, window.* hooks): the bot run must still finish
  with zero JS errors.
- Do not change game rules or balance.
- Only work inside <REPO> (plus the scratchpad raw folder and the tools folder above). Do not commit or push.
- One heavy process at a time (8 GB RAM). Kill every Chrome/python/node process you start (headless Chrome leaks:
  stop only processes whose command line contains your own --user-data-dir).

VERIFY (serve the folder over http: `python -m http.server <port>` in <REPO>, headless Chrome screenshots with
--virtual-time-budget, screenshot path without spaces, URL unquoted):
- Screenshots of the title, a busy gameplay moment, the phone layout (390 px wide iframe wrapper or 500 px window), and
  close-ups of the new models in the game camera. Look at them.
- ?auto bot run with ?debug: zero JS errors, draw calls and fps in budget (report numbers before vs after).
- file:// fallback: open index.html via file:/// and confirm it still runs with the procedural look and no errors.

DOCUMENT
- <REPO>\docs\assets.md (English): a table per asset: name, category, what it replaced and why, tool/model used
  (with the prompt), file path, format/size/triangles, QC result, integrated yes/no, remaining issues. Separate
  sections for done / failed / not started. Credits spent.
- Update README.md: an "Assets" section (generated with Higgsfield: Tripo text-to-3D and GPT Image, processed with
  glTF-Transform; procedural fallback when opened from file://), and fix any sentence that says the game has no asset
  files. Keep the "built by <model>" credit and add "assets remastered by Claude Opus 5.5 (orchestrator)".
- Put 2-3 new screenshots in docs\ (e.g. docs\remaster-*.png).

FINAL REPORT: credits spent (balance before/after), every asset generated (kept or rejected), integration changes,
verification numbers (draw calls, fps, errors, bot result), screenshots paths, known issues.
```
