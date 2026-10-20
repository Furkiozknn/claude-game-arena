# Claude Game Arena: shared design language

The eight games (four Three.js browser games, four Godot 4 remakes) keep their own identity (palette, font, art),
but share one structure so they feel like one collection and so a change in one game maps cleanly onto the others.

## 1. Screens and flow (every game, both engines)

| Screen | Must have |
|---|---|
| Loading | The title card shows "Loading… n/N" while assets load; Play is disabled until done (or a timeout); never a blank page. |
| Title | Generated crest/logo image, game name, one-line subtitle, short how-to, **Play**, **Continue** (when a save exists), **Settings**, language toggle, best result, small footer "Claude Game Arena · built by <model>" linking to the arena page (HTML) / shown as text (Godot). |
| HUD | One glass top bar: logo + name on the left, game stats in the middle, icon buttons on the right (speed if the game has it, pause, sound, language). Icons are images or drawn shapes, never OS emoji. |
| Pause | Resume, Restart, Settings, Main menu. The game is frozen behind a dimmed, blurred backdrop. |
| Settings | Master / music / effects volume sliders, language (TR / EN), quality (Low / High), fullscreen. Saved. Same order in every game. |
| End | Result title, 2-4 key stats, new-record highlight, **Play again** and **Main menu** (plus game-specific: Endless, Next level). |
| Toasts | Short messages in a stack under the top bar; `good`, `bad`, `info` variants. |

## 2. Controls (same keys everywhere where the action exists)

| Action | Key |
|---|---|
| Pause / back | `P` or `Esc` |
| Music on/off | `M` |
| Sound effects on/off | `X` (Hisar historically `S` = sell, so Hisar keeps `S` for sell and uses `X` for sound) |
| Language | `L` |
| Fullscreen | `F11` in the browser / `F` where free (Hisar uses `F` for speed: keep it) |
| Confirm | `Enter` / `Space` on focused buttons |

Every button is reachable with the keyboard (visible focus ring) and is at least 44 px tall on touch screens.

## 3. Settings and save keys

- HTML: `localStorage` keys `arena.<game>.settings` (`{ master, music, sfx, lang, quality }`) and `arena.<game>.save` /
  `.best`. Read old keys once for migration. Every access in try/catch.
- Godot: `user://settings.cfg` and `user://save.json` (or the game's existing save file), `--no-save` for tests.
- Defaults: master 0.8, music 0.6, sfx 0.8, language from the browser/OS (`tr*` → TR, else EN), quality High on desktop,
  Low on phones/web where the game's own measurements say so.

## 4. Visual rules

- Each game keeps its palette and font. Shared: glass panels (blurred, 14-18 px radius, soft shadow), one accent colour
  per game for primary buttons, consistent spacing (8 px grid), the same icon sizes (20 px in buttons, 24-28 px in the HUD).
- Generated assets (Higgsfield Tripo / GPT Image) are processed with glTF-Transform: pivot at the base, WebP textures
  256-1024 px, MeshLambert/vertex-colour look in Three.js, matching materials in Godot.
- HTML: procedural builders stay as the fallback when assets cannot load (`file://`, `?noassets`).
- Performance: 60 fps on an Intel UHD 620 at 1280x720 (desktop), `?low` / Low quality for weaker devices.

## 5. Test hooks (keep in every game)

HTML: `?auto` (bot), `?debug` (draw calls, fps, errors), `?sim=N`, `?low`, `?lang=`, `?noassets`, a `window.<game>` state
object. Godot: `--auto`, `--no-save`, `GameState.get_state_text()`, `res://tests/run_tests.tscn` printing
`TESTS PASSED n/n`.
