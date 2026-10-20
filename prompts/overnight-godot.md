# Overnight pass: Godot remake (port HTML changes + fix + parity)

```text
You are improving the Godot 4.7 remake <GAME> in <GODOT_REPO> (GDScript, Compatibility renderer, 3D; web build made by
GitHub Actions on push). Its browser counterpart <HTML_REPO> was just improved (generated GLB models, icon PNGs, crest
logo, settings/pause structure, bug fixes, redesign). Bring those improvements into the Godot version without losing
any existing Godot feature, fix the Godot bugs from the review, and close the parity gaps.

READ FIRST
- Review: D:\Claude Projeleri Master\claude-game-arena\review\<review-file>.md (sections GODOT BUGS and PARITY TABLE).
- The HTML pass report / "PORT TO GODOT" list (pasted below by the orchestrator) and the HTML repo's docs/assets.md.
- Shared structure: D:\Claude Projeleri Master\claude-game-arena\docs\design-language.md.
- Heavy-process lock (MANDATORY, another agent works in parallel):
  D:\Claude Projeleri Master\claude-game-arena\docs\heavy-lock.md. Acquire it before EVERY godot_console run (import,
  tests, bot, Movie Maker), release right after.

ASSETS
- Copy the GLBs from <HTML_REPO>\assets\models into <GODOT_REPO>\assets\models (and icons/logo into assets\ui).
  Godot imports GLB natively; after copying run the headless import (with the lock). Apply the same rotations/scales
  the HTML uses (Godot is also +Y up; Godot's forward is -Z by convention, but use whatever axis this project's code
  uses — check how the procedural models are oriented). Use the GLB's texture with a material that matches the
  project's look (StandardMaterial3D, roughness ~0.9, or the project's existing shading); keep MultiMeshInstance3D /
  instancing where the project uses it for repeated objects. Keep the procedural models only if a GLB is worse.
- Icons/logo: use the PNGs as TextureRect/TextureButton icons, the crest on the title screen, and as the project icon.
- No new Higgsfield credits unless the orchestrator says so.

ORDER: P0/P1 Godot bugs → assets port → UI/design-language parity (settings, pause, keys, footer credit, focus) →
HTML improvements that apply → P2. Keep data in .tres, keep tests, add tests for fixed rules.

VERIFY (with the lock each time): headless import with no errors/warnings; tests "TESTS PASSED n/n" (n should grow if
you add tests); --auto bot full run, same or better result; Movie Maker frames (<=150 frames per run) of title, busy
gameplay, settings, pause, end, and a 390x780 portrait (temporary override.cfg, delete after) — look at them; replace
docs/*.png showcase images that are now outdated. Check the "Web" export preset is still valid (threads off).
Never claim something works that you did not check.

DOCUMENT: README.md (assets section: "models generated with Higgsfield Tripo, shared with the browser version",
features, settings, controls), a CHANGELOG section "2026-10-21 overnight pass".

RULES: work only inside <GODOT_REPO> (read-only access to <HTML_REPO>). Do not commit or push. No global installs, do
NOT install export templates. Stop every godot process you start.

FINAL REPORT (concise): bugs fixed, assets ported (with transforms), UI/parity changes, tests n/n, bot result, frames
checked, docs images replaced, what is NOT done or unverified.
```
