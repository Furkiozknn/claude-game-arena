# Round 2 brief: remake your round-1 game in Godot 4

Every model gets this same brief for its own game. The round-1 HTML version is the design reference; the goal of
round 2 is a **sturdier, higher-quality** version made with a real game engine.

```text
Remake the game <GAME> (your own round-1 browser game, source: <PATH>/index.html) as a Godot 4 project.
Do not ask questions, build it end to end. Read the round-1 index.html first: keep its rules, content, names,
Turkish/English text and identity, then make it better than the HTML version, not just equal.

ENGINE: Godot 4.7.2 standard (GDScript only, no C#), 3D with the Compatibility renderer (fast on an Intel UHD 620
iGPU and the only renderer that runs on the web without extra headers). Project in <REPO_DIR>, main scene
res://scenes/main.tscn. Typed GDScript everywhere (`var speed: float`, `func f(x: int) -> void`), snake_case files,
PascalCase class_name, all input through the Input Map (keyboard + mouse + touch, gamepad where it fits).

BETTER THAN ROUND 1 (pick what fits the game, do most of it):
- Look: real materials and lighting (baked or simple dynamic, one shadowed light), a coherent palette, an
  environment with fog and tonemapping, particles (CPUParticles3D), animation with tweens and AnimationPlayer,
  camera feel (smoothing, small shake). Still procedural or CC0 assets only; no copyrighted assets.
- Feel: menus with transitions, pause, settings (master/music/sfx volume, language TR/EN, quality: low/high,
  fullscreen), juice on every important action, readable feedback.
- Sturdiness: game data (enemies, levels, menu items, upgrades) in Resource files (.tres) separate from code,
  a save system (user://), no errors or warnings in the Output, clean scene tree.
- Audio: music and sound effects generated in code (AudioStreamGenerator or pre-synthesised AudioStreamWAV) or CC0.

TEST AND SELF-CHECK:
- A GameState autoload with get_state_text() -> String returning the current state as JSON.
- An autoplay bot started with the user argument `--auto` (godot ... -- --auto) that plays the full game.
- A headless test scene res://tests/run_tests.tscn that runs unit tests for the core rules and prints one final line
  "TESTS PASSED n/n" or "TESTS FAILED k/n" and exits with code 0 or 1. Command:
  godot_console --headless --path <REPO_DIR> --scene res://tests/run_tests.tscn
- Visual check WITHOUT export templates: Godot's Movie Maker renders frames with the real GPU, e.g.
  godot_console --path <REPO_DIR> --write-movie <TMP>\frames\f.png --fixed-fps 30 --quit-after 600 -- --auto
  (also a fixed-time flag of your own so you can jump to interesting moments). Look at the PNGs with the Read tool.
  Check the title, a busy gameplay moment, every menu, the end screen, the English UI and a 390x780 portrait window
  (--resolution 390x780).
- Run `godot_console --headless --path <REPO_DIR> --import` after adding files; it must finish without errors.

WEB: add an export preset named exactly "Web" (export_presets.cfg) with output build/web/index.html, thread support
OFF (variant/thread_support=false; GitHub Pages cannot send the headers threads need), VRAM compression for desktop
and mobile. The orchestrator builds the web version in GitHub Actions (export templates are not installed locally),
so make sure the project needs no editor-only step to export.

RULES: work only inside <REPO_DIR>; do not read the other models' games; do not commit, push or publish; do not install
anything globally; one heavy process at a time (8 GB RAM); stop every godot/chrome process you started before you
finish; a .gitignore that ignores .godot/ and build/ but keeps .uid files.
```
