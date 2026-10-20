# Çini Ustası: code review (HTML + Godot 4)

Static review only: nothing was run (no Chrome, Godot, server). Every finding below comes from reading the code,
plus the screenshots already in `docs/`. Line numbers refer to:

- HTML: `D:\Claude Projeleri Master\cini-ustasi\index.html` (1912 lines, three.js 0.170 from jsDelivr)
- Godot: `D:\Claude Projeleri Master\cini-ustasi-godot` (Godot 4.7, GL Compatibility, v2.0.0, commit `7c9b0ab`)

Things I could not confirm by reading are marked **(unverified)**. Coordinates are world metres, Y up, both versions
share the same layout constants (`TABLE_Y 1.0`, `WALL_Z -4.2`, `KILN_POS (4.8,0,-3.0)`, `KILN_MOUTH (4.8,0.95,-2.1)`,
`BOARD_SIZE 3.6`).

Priority: **P0** = broken/crash/blocks progress, **P1** = clearly wrong for many players, **P2** = polish/minor.
No P0 was found in either version: both puzzle cores are sound (deterministic generation, correct edge evaluation,
optimal par for the generated solution, the Godot tests and bot check all 30 levels).

---

## 1. HTML bugs and broken features

### P1

**H1. Closing an overlay returns to the wrong screen (dead-end on an invisible board).** `index.html:1550-1553`
`closeOverlays()` goes to `playing` whenever `G.pz` exists and the current screen is not `title`. It does not remember
where the overlay was opened from.
- Repro A: finish any level → on the complete card press **Bölümler/Levels** → press **X** or **Esc**. You land in
  `playing` with the top bar, but `boardGroup.visible` is still `false` (set at the end of the `tokiln` phase,
  `:1442`, and only reset in `startLevel`, `:1393`). The board is solved and invisible; tapping where tiles were
  probably still rotates them (three.js raycasting ignores `.visible`, **unverified**) and can re-trigger `onSolved`.
- Repro B: play a level → Menu → **Ana ekran** → **Koleksiyon** (or Bölümler) → close. Expected: title. Actual: back
  inside the old level, skipping the title.
- Fix: port Godot's `_return_screen` logic (`game_state.gd:227-238`): in `showLevels/showCollection/showHowto/showMenu`
  store `G.returnTo = G.screen` only when the current screen is not an overlay (`'completing'` → `'playing'`), and in
  `closeOverlays()` go to `G.returnTo` (`'complete'` → `showComplete()` again, `'title'` → `showTitle()`, `'playing'`
  only if `G.pz && !G.seq && !isSolved(G.pz, G.slots)`).

**H2. On phones (portrait) the whole kiln sequence and the wall gallery happen off-screen.** `:903-912`, `:1432-1460`
`updateCamera()` pushes the camera back to fit the board width (`need = 2.75 / hTan`); at 390×844 that is ≈14 m and
the horizontal half-FOV is only ≈11°, so the kiln at x = 4.8 (and the gallery x -2.1…3.2) are outside the frustum.
`docs/phone-390.png` confirms: no kiln, no wall panels. The player sees the board fly off the right edge, then nothing
for ~5 s until the card appears.
- Fix: port Godot's `CameraRig.focus` (`camera_rig.gd:12-14, 57, 76`): add `CAM.focus` (Vector3) eased per frame;
  set `CAM.focus.set(KILN_MOUTH.x * 0.55, 0, 0)` at the start of `tokiln`, back to 0 at the start of `out`; apply it
  fully when `camera.aspect < 1`, at 0.35 otherwise. For the `out` phase on portrait also lerp the focus toward the
  destination slot (`gallerySlotPos`) so the panel is seen landing.

**H3. The window glass is hidden inside the back wall.** `:1158` (glass at `z = WALL_Z - 0.04 = -4.24`); the wall box
(`:972`) spans z -4.4…-4.2, so its front face covers the glass. Through the window frame you see wall colour, not sky
(visible in `docs/title.png` and `docs/chapter1-level10.png`). The light shaft "from the window" has no window.
- Fix: `glass.position.set(-4.0, 2.85, WALL_Z + 0.005)` (in front of the wall face, behind the frame bars which reach
  z -4.10). Same bug in Godot (G2).

**H4. Second finger during a tile drag leaves the tile stuck in the air (touch).** `:1682`
The two-pointer branch clears `ptr.down/tile/camDrag` but not `G.drag`/`ptr.dragging`. `endPointer` then returns at
`if (!ptr.down) return;` (`:1715`), so `G.drag` stays set and `updateTiles` keeps the tile lifted at the last finger
position until another drag starts.
- Repro: chapter 2 level on a phone, start dragging a tile, put a second finger down, lift both.
- Fix: in the `pointers.size === 2` branch add `G.drag = null; ptr.dragging = false;` (Godot already does this,
  `input_controller.gd:104-106`).

**H5. Live HUD stars render grey (unverified cause).** `:43-44`, `:1513`
In `docs/chapter1-level10.png` (30 moves, par 46 → 3 stars) and `docs/phone-390.png` (0 moves) the `★★★` in the top
bar look grey/dark, although `#starsLive` is gold. Most likely the ★ glyph comes from a fallback font (Nunito has no
U+2605) and renders oddly at 17 px. Fix: draw the stars as inline SVG (like Godot's drawn `StarRow`) in
`starsHtml()`; that also removes the font dependency on the level cards and complete card.

### P2

**H6. Paint brushes: metal collar and tip float away from the handle.** `:1051-1056`
`cyl()` applies `rx` then `rz` then `ry` (`:950`), so the handle axis is `(sin a, 0, cos a)`, but collar and tip are
offset along `(sin a, 0, -cos a)`. Fix: `bz + Math.cos(a) * 0.5` and `bz + Math.cos(a) * 0.62`.
After the fix the brushes still overlap the board: brush 2 is centred at x -2.08 and the board base reaches x ±2.12
(`:1197`). Move them to `bx = -2.9 + i * 0.17`, `a = -0.1 + i * 0.1`, `bz = 1.45` (the free strip x -3.2…-2.12).
**H7. Other props clip into the board.** Cloth `:1062-1063` (x -2.70…-2.00 and -2.55…-2.05, board edge -2.12) and
paint pot 1 `:1045` (centre x 2.15, r 0.15 → 2.00…2.30, frame bar 1.80…2.10). Fix: cloth x -2.55 → -2.65 and width
0.5; pots shifted +0.25 in x (keep ≤ 3.05 so they stay on the 3.2 table edge).
**H8. Shelf plates: the coloured rims are tilted on a different axis than the plate and sit behind it.** `:1004-1006`
The disc is tilted with `rz` (normal ≈ (-0.976, 0.218, 0)), the torus with `rotateY(π/2 + 0.22)` (normal ≈ (0.976, 0,
-0.218)): 17.6° apart, and the rims are at x 5.57/5.567, i.e. on the wall side of the disc (front face x ≈ 5.533).
Fix: `tr.rotateY(-Math.PI / 2); tr.rotateZ(-0.22); tr.translate(5.52, py + 0.33, pz)` (same for `tr2`, x 5.515).
**H9. The kiln dome cuts through the lower right shelf.** Shelf `:997-998` (y 2.55, x 5.38…6.00, z -4…-1); dome
`:1024` (centre (4.8, 2.1, -3), r 0.86, so at y 2.55 it reaches x 5.53). The cat walks right over that spot. Fix: move
the kiln to x 4.55 (update `KILN_POS` and `KILN_MOUTH`), or raise the shelves to y 2.95/3.85 (and `cat y` 2.98).
**H10. Spark particles: the first wave never appears.** `:1784-1785`
A spark is respawned at the mouth only when `sparkLife[i] === dt` (float equality, practically never true after
starting negative) or when life > 1.2 s. So sparks sit at y = -5 with zero velocity for 1.2-2.0 s, i.e. they appear
only at the end of the 1.5 s `fire` phase. Fix: `const born = sparkLife[i] >= 0 && sparkLife[i] - dt < 0;` and use
`if (born || sparkLife[i] > 1.2)`.
**H11. Long SFX are cut at 1 s.** `:804` (noise buffer = 1 s, no loop) vs `whoosh` 1.4 s and `fire` 1.8 s (`:872-873`).
The rumble stops abruptly. Fix: `src.loop = true` in `noise()` (`:812`) or a 2 s buffer.
**H12. Hint can freeze and then lie.** `:1363-1364`
`solvePuzzle` runs on the main thread with a 6 million node limit; if it aborts it returns `null` and the toast says
"the board already looks right" without consuming a hint. In JS this is probably fast enough (**unverified** on
6×6 swap+flip boards from a messy state). Better and simpler: every level has a known valid solution (`pz.tiles[i]`
at slot i, rot 0, face 0; fixed tiles are already there), so `useHint` can plan against
`pz.tiles.map((t, i) => ({ t: i, rot: 0, face: 0 }))`: O(N), no search, never fails. Same for the bot (`:1823`).
**H13. A decoy back face may duplicate another tile.** `:392-397`
The decoy is only checked against its own front (`canonKey(back) !== canonKey(t.faces[0])`), not against the other
tiles' fronts (`keys`). Two identical-looking tiles can appear, and alternate solutions are possible (par and hints
still work, but it is confusing). Fix: also require `!keys.has(canonKey(back))` (keep `keys` in scope).
**H14. Generation fallback builds a partial board.** `:376` If all 400 attempts fail, `tiles = t` where `t` stops at
the first rejected tile, so the board has fewer than n² tiles and everything after crashes. Never triggers for the 30
fixed seeds (the bot and Godot tests solve them all); a daily seed hitting it is extremely unlikely (**unverified**).
Fix: keep the last *complete* attempt, or drop the duplicate check on the final attempt.
**H15. Replaying an old panel flies it to someone else's frame.** `:1463-1466` When the replayed panel is not among
the last 12 on the wall, `wallSlotFor` returns `list.length - 1`; the panel lands on the newest frame, then vanishes
in `rebuildWall`. Fix: on an improved replay set `entry.ts = Date.now()` (it then becomes the newest wall entry), or
fly it to the kiln shelf when it is not on the wall.
**H16. "This chapter doesn't allow swaps" toast is shown once per page load.** `:1704` `ptr.noSwapToasted` is never
reset. Fix: reset it in `pointerdown` (`:1685`).
**H17. Keyboard gaps.** `:1637-1648` Only Esc, Z, H, R. Esc does nothing on the title or complete card; no `P`
(pause), `M` (music), `X` (sound), `L` (language), no right-click alternative on keyboard (Godot uses `F` on the
hovered tile). See section 3.
**H18. Phone top bar takes three rows and buttons are 36 px.** `:143-149` (`docs/phone-390.png`: logo alone on row 1,
8 buttons on row 2, stats on row 3). Design wants ≥ 44 px touch targets. Fix: on < 640 px put the logo into the button
row (like Godot `hud.gd:121-135`) and drop Help/Music from the bar into the pause menu, which leaves 6 × 44 px buttons
(6·44 + 5·6 = 294 px + logo 30 fits in 370 px).
**H19. Undo of a hint does not give the hint back; Restart refills hints.** `:1344-1351`, `:1382` Undoing a hint
removes its moves from the count but the hint stays spent; R gives 3 fresh hints. Design choice, but inconsistent;
suggest `G.hints++` on undoing a `hint` entry. (Same in Godot `game_state.gd:380-389, 317-325`.)
**H20. "Board reshuffled" on Restart is not true.** `:533/551` + `:1383` Restart restores the same start position.
Rename to "Pano baştan başladı / Board reset". (Same string in Godot.)
**H21. No quality tier.** `:892-895` Always antialias + PCF soft shadows + up to 1.5 DPR; Low only with `?low`. On an
Intel UHD 620 at 1280×720 ×1.5 this is 1920×1080 with MSAA and a 1024 shadow map re-rendered every frame (**unverified
fps**). Fix: Low/High setting, default Low when `matchMedia('(pointer:coarse)').matches` or `navigator.hardwareConcurrency
<= 4`; additionally `renderer.shadowMap.autoUpdate = false` and `renderer.shadowMap.needsUpdate = true` only on frames
where a tile, the board or the cat moved (the scene is static most of the time).

### Checked and fine (HTML)
- Rules: rotate (tap, clockwise only), swap (drag, whole slot record travels), fixed tiles (never scrambled, rejected
  for rotate/swap/flip with a shake), flip (right-click / 520 ms long-press, only two-sided tiles), border band only on
  the outside, win check after every non-undo move. Par = optimal clicks for the generated solution (swaps =
  n − cycles, CW rotations, one flip each); stars 3 ≤ par, 2 ≤ ⌈1.6·par⌉+2, else 1.
- Unlocks (level i needs L(i)), daily unlocks after L1-L10 and uses the local date, `?level=` bypasses locks (test hook).
- Save: one `localStorage` key `cini-ustasi-v1`, all accesses in try/catch; `?fill` disables saving, `?fresh` clears.
- Leaks: `clearTiles` disposes tile materials and every cached tile texture; glow geometry, gallery geometry/frames and
  the transit texture are disposed on rebuild; shared tile geometry disposed when n changes. No leak found.
- Per-frame: ~55 draw calls in play (36 tiles + room/props/table/frame×4/gallery×2/glow/effects), dust 170 points
  updated on the CPU, hover raycast only on mouse move. Fine except the always-on shadow pass (H21).
- Audio: music/SFX toggles persist, music scheduler uses look-ahead, context suspended when the tab is hidden.
- Test hooks present: `?auto ?debug ?low ?lang ?sim ?level ?screen ?ch ?fill ?fresh ?noanim ?nohowto`, `window.cini`,
  `window.ciniSim(s)`. The `CORE BEGIN/END` block is meant to be extracted for Node tests, but no test file is in the
  repo (**unverified** whether one exists elsewhere).

---

## 2. Dead / unnecessary code (verified by search)

### HTML
| Line | What |
|---|---|
| 418 | `slots.findIndex(s => s.t === p);` result discarded (the next statement does the work) |
| 1200 | `const frameMat = …` never used (each bar gets its own material at `:1209`) |
| 865 | `Sound.click()` never called |
| 1256 | `G.intro` never read (tiles use `tl.intro`) |
| 1825 | `B.solved = 0` never read |
| 530/548, 537/555 | i18n keys `hint`, `undo`, `menu`, `dailyBest` never looked up (both languages) |
| 1031 | `+ (i % 3) * 0.0` no-op term |
| 417 | Comment promises "every double-sided tile has a wrong face"; not implemented |

### Godot
| File:line | What |
|---|---|
| `scripts/core/move.gd:48-60` | `Move.to_dict()` only calls itself |
| `scripts/render/mesh_builder.gd:18-23` | `MeshBuilder.clear()` never called |
| `scripts/render/board_picture.gd:18-20` | `BoardPicture.set_puzzle()` never called |
| `scripts/ui/icon_button.gd:57-62` | icon kinds `"back"` and `"sound"` drawn but no button uses them (used: close, help, hint, menu, restart, settings, undo) |
| `scripts/autoload/audio.gd:102, 143-146` | `"click"` SFX synthesised at start-up, never played |
| `scripts/game/world_builder.gd:112` | `refs["shaft"]` stored, never read |
| `scripts/autoload/loc.gd` | keys `loading`, `hint`, `undo`, `menu`, `dailyBest`, `firing`, `glazing`, `on`, `off` never looked up |
| `scripts/autoload/game_state.gd:486` | `progress_changed.emit()` right after `save_progress()` already emitted it: UI refreshes twice per solve |

---

## 3. Design-language gaps (vs `docs/design-language.md`) and plan

| Rule | HTML | Godot | Plan |
|---|---|---|---|
| Loading "n/N", Play disabled until ready | spinner only (no assets yet) | none (synth runs in background) | Add when GLBs land: title card shows `Atölye hazırlanıyor… 3/7`, Play disabled until loaded or 8 s timeout |
| Title: crest image | logo = a painted tile | same (baked once) | Generated crest (asset T6) in both |
| Title: Play + Continue (when save) | one button, label switches | same | Two buttons: **Devam et** (next unfinished) and **Oyna** → level select, or keep one + add Continue only when a save exists |
| Title: Settings | missing | ✓ | HTML: add Settings screen (below) |
| Title footer "Claude Game Arena · built by <model>" | missing | missing | HTML: `<a href="../">Claude Game Arena · built by Claude …</a>`; Godot: plain Label |
| HUD: logo+name, stats, icons pause/sound/language | ✓ (SVG icons) + extra hint/undo/restart/help/music | no sound icon (settings icon instead) | Godot: add a sound toggle IconButton (the unused `"sound"` icon exists); HTML: fine |
| Pause: Resume, Restart, Settings, Main menu; frozen, dimmed + blurred | no Settings, dim only | ✓ items, dim only | HTML: add Settings button; both: blur (`backdrop-filter: blur(6px)` on `.overlay`; Godot: a `BackBufferCopy` + blur shader on the dim rect, or skip on Low) |
| Settings: master/music/sfx, language, quality, fullscreen, saved | **missing** | ✓ | HTML: new `#settingsScreen` card with 3 range inputs (gain nodes `master/musicBus/sfxBus`), TR/EN, Low/High (reload-free: pixel ratio, shadows, dust count, TEX_SIZE on next level), fullscreen via `requestFullscreen()` |
| End: title, 2-4 stats, **new-record highlight**, Play again, **Main menu** | no record highlight, no Main menu | same | Both: "Yeni rekor!" badge when `improved && prev`; add **Ana ekran** button |
| Toasts under the top bar, good/bad/info | bottom, one style | bottom, one style | Both: move below the bar (`top: 76px` / Godot `PRESET_TOP_WIDE` offset 70), add variants (deny = bad, hint/new piece = good) |
| Keys P/Esc, M, X, L, F11/F, Enter/Space | Esc, Z, H, R | Esc, Z, H, R, L, F(=flip) | HTML: add P, M, X, L. Godot: add P, M, X; keep F = flip (document it as the Hisar-style exception) |
| Every button keyboard-reachable with a visible focus ring, ≥ 44 px | native buttons (Tab works), default ring, 36-40 px | **every** Button/IconButton/level card/slider has `FOCUS_NONE` and an empty focus style (`ui_theme.gd:77,143,175,219,238`, `icon_button.gd:14`, `levels_screen.gd:74,127`, `settings_screen.gd:35,70`) | Godot: `FOCUS_ALL` + a 2 px turquoise focus StyleBox, `grab_focus()` on the primary button when a card opens. HTML: `.btn:focus-visible, .ibtn:focus-visible{outline:3px solid var(--turq)}`, 44 px buttons on touch |
| Save keys `arena.cini.settings` / `arena.cini.save` | `cini-ustasi-v1` (progress + settings mixed) | `user://progress.json`, `user://settings.cfg` (allowed) | HTML: split into `arena.cini.settings` `{master,music,sfx,lang,quality}` and `arena.cini.save` `{best,collection,seenHowto,dailyToastShown}`, migrate from `cini-ustasi-v1` once |
| Defaults master 0.8 / music 0.6 / sfx 0.8, language from browser/OS | sound/music on, `lang='tr'` (`:1888`) | 1.0 / 0.8 / 1.0, `lang="tr"` (`settings.gd:9-12`) | HTML: `navigator.language.startsWith('tr')`; Godot: `OS.get_locale_language() == "tr"` on first run |
| Quality High desktop / Low phones | `?low` only | Low on web, High native | HTML: auto Low on coarse pointer (H21) |
| Generated assets with procedural fallback, `?noassets` | none yet | none yet | See section 6 |
| Test hooks | all but `?noassets` | all + `--web-sim --stats --speed --restart-at` | HTML: add `?noassets` together with assets |

---

## 4. Godot bugs

### P1
**G1. Hint runs a GDScript backtracking solver on the main thread.** `scripts/autoload/game_state.gd:443-463`
The solver is ~50-100× slower than the JS one and the test only requires each level to solve in < 15 s
(`tests/run_tests.gd:243`), which suggests some levels take seconds. A hint on a 6×6 board from a messy state can
freeze the game, worst in the web build (no threads). Same in the bot (`bot.gd:91-93`).
Fix (same as H12): plan the hint against `puzzle.solution()` with `PuzzleCore.plan_hint(puzzle, slots,
puzzle.solution())`; it is always valid because fixed tiles sit at home. Keep the solver only for tests.
**G2. Window glass hidden inside the wall.** `scripts/game/world_builder.gd:98` (`WALL_Z - 0.04`); confirmed in
`docs/board.png` (wall colour inside the frame). Fix: `WALL_Z + 0.005`.

### P2
**G3. Brushes all point straight along +Z and collar/tip float.** `world_builder.gd:301-307` + `mesh_builder.gd:60-69`
`_basis()` applies Y first, then X, then Z. For a cylinder, a Y rotation applied first only spins it about its own
axis, so `Vector3(PI/2, a, 0)` gives every handle the axis +Z (visible as parallel sticks in `docs/board.png`), while
collars/tips are offset along `(sin a, 0, -cos a)`. The comment "same order as the round-1 helpers" is true for
`box()` but not for the HTML `cyl()` (X, Z, then Y). Fix: in `cylinder()` build `Basis(UP, rot.y) * Basis(BACK, rot.z)
* Basis(RIGHT, rot.x)` (X applied first); the only cylinder call with both X and Y set is the brushes, so nothing else
changes. Then use `bz + cos(a) * 0.5 / 0.62` and the new positions from H6.
**G4. Plate rims hidden inside the plates.** `world_builder.gd:246-248` Rim tori at x 5.57/5.567 with tube 0.025 lie
behind the disc front face (x ≈ 5.533); only a sliver past r 0.3 shows. Fix: x 5.52/5.515.
**G5. Props clip into the board; kiln dome cuts the shelf.** `world_builder.gd:294-297, 314-315, 236-239, 264` Same
numbers and fixes as H7 and H9.
**G6. Restart re-bakes the whole tile atlas and the tiles vanish for a few frames.** `main.gd:199-203`,
`board.gd:187-203` `restart_level()` emits `level_started`, which calls `build_tiles`, which clears all tiles and
awaits a new SubViewport capture (≥ 3 frames). Fix: cache the last atlas in `Board` keyed by `pz` (same object on
restart) and reuse it; only rebuild the TileNodes.
**G7. Opening the collection bakes every panel at once and the cache thrashes.** `collection_screen.gd:58-59, 80`,
`texture_baker.gd:85-98` Each entry starts its own SubViewport bake in the same frame: 30+ viewports × 36 tiles × ~40
2D draw commands in one frame on the web build (**unverified** hitch size). The cache is wiped completely when it holds
> 40 entries (`:95-96`), so once the collection passes ~40 panels (30 levels + 10 dailies) every opening re-bakes all.
Fix: bake sequentially (await one before starting the next) and use an LRU (drop the oldest key) instead of `clear()`.
**G8. Wall gallery costs ~36 draw calls.** `gallery.gd:9-54` Each of up to 12 pieces is 3 MeshInstances with their
own materials. HTML uses one atlas quad mesh + one merged frame mesh (2 calls). Fix: port the HTML atlas approach
(`index.html:1219-1224, 1477-1500`): bake the 12 pictures into one 6×2 atlas and build one ArrayMesh with MeshBuilder.
**G9. No keyboard focus anywhere** (see section 3). With `FOCUS_NONE` on every control, Enter/Space/Tab do nothing
and gamepad users (the project maps joypad buttons) cannot leave the title screen.
**G10. Esc does nothing on the title or complete screen; no P/M/X keys.** `game_state.gd:274-287`,
`input_controller.gd:70-85`, `project.godot [input]`.
**G11. Replay of an off-wall panel lands on the wrong frame.** `game_state.gd:199-204` (same as H15).
**G12. Decoy may duplicate another tile; generation fallback is partial.** `puzzle_core.gd:139-148, 107-108` (same as
H13/H14).
**G13. Atlas bleeding on the tile bevel at distance (unverified visually).** `texture_baker.gd:59-81` +
`tile_node.gd:34-47` Tile UVs run exactly 0…1 of each atlas cell and the atlas has mipmaps, so lower mips mix the
neighbouring cell into the bevel ring. Fix: 4 px padding per cell (draw the face at `cell-8` with a 4 px margin and
shrink `uv1_scale` accordingly) or disable mipmaps on the atlas.
**G14. No reflections on the glaze.** `main.gd:128-149` Ambient is a flat colour and there is no sky/reflection probe,
so roughness 0.32 tiles look matte (same in HTML: no `scene.environment`). Fix: section 6 T7 or a cheap
`ProceduralSkyMaterial` assigned to `env.sky` with `reflected_light_source = REFLECTION_SOURCE_SKY` while
`background_mode` stays `BG_COLOR`.

### Checked and fine (Godot)
`Mulberry32` matches JS bit-for-bit (unsigned 32-bit `imul`, FNV-1a), so seeds produce the same boards as the HTML.
Screen state machine with `_return_screen` is correct (the HTML H1 bug does not exist here). Pinch cancels a drag.
Settings persist; `--no-save` never touches disk or the window. Audio synthesis is spread one job per frame. Bakes
check a generation counter before applying results. Tests cover RNG, generation, evaluation, plans, solver, hints,
stars, daily, progress merge, state flow, undo/hint and synth.

---

## 5. Parity table (HTML vs Godot)

| Feature | HTML | Godot | Better | Port |
|---|---|---|---|---|
| Puzzle core, 30 levels, daily, par/stars | identical (same RNG/seeds) | identical | = | — |
| Overlay return logic | buggy (H1) | correct | Godot | Godot → HTML |
| Kiln camera focus / portrait framing | none | `CameraRig.focus` | Godot | Godot → HTML |
| Camera idle drift + shake on fire | none | yes | Godot | Godot → HTML (5 lines) |
| Settings screen (volumes, lang, quality, fullscreen) | none | yes | Godot | Godot → HTML |
| Quality tier (web Low default) | `?low` only | auto Low on web + setting | Godot | Godot → HTML |
| Sound / music toggle buttons | HUD + title, persisted | sliders only | HTML (design wants a HUD sound icon) | HTML → Godot |
| Language key `L` | no | yes | Godot | Godot → HTML |
| Keyboard focus / button navigation | native buttons | none (`FOCUS_NONE`) | HTML | HTML → Godot |
| Phone HUD | 3 rows, 36 px | 2 rows, 40 px | Godot | Godot → HTML |
| Stars | ★ glyph (renders grey, H5) | drawn `StarRow` with pop animation | Godot | Godot → HTML (SVG) |
| Logo | painted once into two canvases | baked once into a texture | = | — |
| Tile textures | one CanvasTexture per face (up to 44) | one atlas per level | Godot (fewer binds) | optional |
| Restart | instant | re-bakes atlas (G6) | HTML | fix Godot |
| Wall gallery | atlas, 2 draw calls | 36 nodes | HTML | HTML → Godot |
| Collection screen | sync canvases, 224 px | async bakes, LRU missing (G7) | HTML (simpler) | fix Godot |
| Audio | live WebAudio, delay room | pre-synthesised WAVs, delay bus | = (Godot cheaper per note) | — |
| Sparks | broken first wave (H10) | CPUParticles3D correct | Godot | fix HTML |
| Long SFX | cut at 1 s (H11) | full length | Godot | fix HTML |
| Touch pinch during drag | stuck tile (H4) | handled | Godot | Godot → HTML |
| Hint/bot | JS solver | GDScript solver (slow, G1) | HTML | both → use home solution |
| Pause menu | no Settings | has Settings | Godot | Godot → HTML |
| How-to text | `<kbd>` key caps | plain text | HTML | HTML → Godot (RichTextLabel or drawn caps) |
| Loading screen / CDN failure message | yes (20 s timeout) | none needed | = | — |
| Fullscreen | browser only | setting | Godot | Godot → HTML |
| Test hooks | URL flags, `window.cini`, `ciniSim` | CLI args, `get_state_text`, 30+ headless tests, CI | Godot | add a Node test for the CORE block to HTML |
| Window/brush/plate/shelf clipping | bugs H3/H6-H9 | same bugs G2-G5 | = | fix both |

---

## 6. Asset plan (~45 credits)

### What must stay procedural
The **tile faces** (and therefore the board picture, the gallery pictures, the collection and the logo-tile fallback)
must stay procedural:
- Each face is composed at runtime from 4 edge ids (21 kinds: border + 5 shapes × 4 colours) plus a centre ornament
  (plain/fixed/flip). Generated art cannot guarantee that the same motif is pixel-identical on every tile and meets its
  twin exactly at the edge midpoint, which is the whole puzzle.
- The motif must start at the edge midpoint and taper inward so four motifs never collide; the colour must be one of
  four exact palette values so "same shape + same colour" stays readable (and colour-blind-checkable by shape).
- Faces are rotated 90° in play; any lighting baked into a generated image would rotate with it.
- Both engines bake the same painter (`paintTile` / `MotifPainter`) so the kiln picture, wall and collection match.
Allowed: a grayscale glaze crackle overlay (T9) multiplied onto the procedural face.

### Tier 1 (≈ 25 credits)

| # | Asset | Tool | Cr | Spec (from the code) |
|---|---|---|---|---|
| A1 | **Kiln** GLB | Tripo text-to-3D | 5 | Prompt: "small traditional Anatolian pottery kiln, brick body with lime plaster, domed top, short chimney at back-left, arched firing mouth at the front with a dark open interior, stone plinth, stylised low-poly game asset, warm terracotta". Size **2.1 (x) × 3.75 (y, chimney top) × 2.1 (z)**: plinth 2.1×0.2×2.1, body 1.7×1.9×1.7 (y 0.2-2.1), dome r 0.86 (top y 2.96), chimney r 0.2 at local (-0.3, 2.45-3.75, -0.35). **Pivot at the base centre**, mouth facing **+Z**, mouth-opening centre at local **(0, 0.95, +0.9)**, opening ≈ 0.9 × 0.7, hearth ledge top at y 0.6 sticking out to z +1.25. Interior at least 0.4 deep (the board, 0.93 m wide at scale 0.22, slides to local (0, 0.85, +0.6)). Width above y 2.49 ≤ 1.16 m from the centre on +x, or move the kiln to x 4.55 (H9). Keep the procedural glow quad at local (0, 0.95, 1.0) and the point light at (0, 1.05, 1.4). ≤ 8k tris, one 1024 WebP texture |
| A2 | **Cat** GLB (sitting) | Tripo | 5 | Prompt: "cute stylised dark grey tabby cat sitting loaf-style, tail curled around its paws, yellow eyes, low-poly game asset". **0.32 long × 0.38 tall × 0.2 wide**, pivot at the bottom centre, facing **+X** (current cat convention, head at +x). A static mesh walking looks wrong, so replace the walk with "appears, sits, breathes (scale.y 1 ± 0.015 at 0.3 Hz), turns its head (whole body yaw ± 0.3 rad), leaves". Move it where people see it: the **stool top (-4.2, 0.63, 1.4)**, yaw facing the board (visible in both landscape screenshots), or the sill (-3.4, 2.0, -4.0). Fallback: today's box cat |
| A3 | **Brush jar + paint pots** GLB | Tripo | 5 | Prompt: "Iznik-style ceramic jar with five paint brushes and four small paint pots (cobalt blue, turquoise, coral red, emerald green) on a small wooden tray, stylised low-poly". Footprint ≤ **0.85 × 0.55**, height ≤ 0.45, pivot at the base centre. Place at **(2.65, 1.0, 1.5)** (free space x 2.2-3.1 between the board frame and the table edge). Replaces the procedural pots and brushes (and their bugs H6/H7) |
| T1 | Table wood, tileable | GPT Image | 1 | 1024², "seamless top-down worn walnut workbench planks running left-right, flat even light". HTML: replace `woodTexture()` map (`:1151`), repeat (1.5, 1); Godot: `table.material_override.albedo_texture`, keep triplanar scale 0.32 |
| T2 | Terracotta floor, tileable | GPT Image | 1 | 1024² containing **2×2 handmade terracotta tiles with thin dark grout**, seamless. One 16×12 plane at y 0 (x -8…8, z -5…7) with repeat (8, 6); removes 192 floor quads + 30 grout boxes from the room mesh |
| T3 | Lime plaster wall, tileable | GPT Image | 1 | 1024², "seamless warm cream lime plaster, subtle trowel marks, no shadows". Split the 3 wall boxes (`:972-974` / `world_builder.gd:197-199`) into their own mesh: back wall 12.4×5.2 repeat (4, 1.7), side walls 12×5.2 repeat (4, 1.7) |
| T4 | Window view | GPT Image | 1.5 | **1536×1024** (glass is 2.6×1.7), "view through a window: İznik lake and green hills at golden hour, Ottoman tiled roofs and one slender minaret, soft painterly". Unlit material on the glass quad at **(-4.0, 2.85, WALL_Z + 0.005)** after the H3/G2 fix |
| T5 | Kilim | GPT Image | 1 | **1024×1152** (rug 1.6 wide × 1.8 tall), "flat-woven Anatolian kilim, red, ochre, cobalt and cream geometric motifs, straight front view, whole rug edge to edge with fringes". Replace the 9 bands + 4 stripes (`:993-995`) with one 0.04×1.8×1.6 box at (-5.95, 2.4, -3.1), texture on the +X face |
| T6 | **Crest / logo** | GPT Image (high) | 2.75 | 1024² transparent PNG, "emblem: round Iznik tile medallion with a tulip and carnation, cobalt and turquoise on white glaze, thin gold ring, no text". Exports: 256 px WebP (title card, 110-120 px CSS @2x) and 64 px (HUD 30 px @2x), favicon 32. Name text stays real text (generated lettering is unreliable) |
| T7 | Reflection panorama | GPT Image | 2 | 2048×1024 equirectangular, "360° panorama inside a warm cosy pottery workshop, soft window light". Reflections only: HTML `PMREMGenerator.fromEquirectangular` → `scene.environment`, `environmentIntensity ≈ 0.35`, background unchanged (zero-credit alternative for HTML only: `RoomEnvironment` from three/addons). Godot: `env.sky = Sky` with `PanoramaSkyMaterial`, `reflected_light_source = REFLECTION_SOURCE_SKY`, `background_mode` stays `BG_COLOR`. Fixes the matte glaze in both |

Subtotal ≈ 25.25.

### Tier 2 (≈ 11 credits)
| # | Asset | Cr | Spec |
|---|---|---|---|
| A4 | Terracotta pot with geranium | 5 | 0.25 × 0.35 tall, pivot base, on the sill at (-4.9, 2.0, -4.06) replacing the box plant (`:988-989`) |
| A5 | Copper ibrik (ewer) + small Iznik plate | 5 | ≤ 0.4 × 0.45, pivot base, on the table at (-2.65, 1.0, -0.5) (left strip) — fills the empty left side of the table, which is on screen, unlike the right-wall shelves |
| T9 | Glaze crackle overlay | 0.5 | 256² grayscale tileable, multiplied at 10-15 % onto tile faces / used as roughness variation |

Running total ≈ 36. Keep **≈ 9 credits as re-roll reserve**: Tripo results often need a second try (wrong pivot,
closed kiln mouth). Not recommended: a generated icon set (the current SVG / drawn icons are crisp at 20-24 px and
already consistent), or GLBs for the right-wall shelves (they sit at the screen edge, H9).

### Processing and integration (both engines)
- `gltf-transform` per GLB: `center --pivot below`, `resize` to the sizes above, `simplify --ratio 0.5` if > 8k tris,
  `webp --slots baseColor` at 512-1024, `prune`, `dedup`. Target < 600 KB each.
- HTML: `GLTFLoader` from `three@0.170.0/examples/jsm/`, `MeshLambertMaterial` look (copy `map`, keep
  `vertexColors` off), the loading counter on the title card, procedural builders kept as the fallback for
  `file://`, load errors and `?noassets`. The kiln, plant and pots must move out of the single merged room mesh into
  their own merged meshes so the procedural versions can be hidden when the GLB arrives.
- Godot: `res://assets/models/*.glb` (import: no LODs, `StandardMaterial3D`, roughness 0.85), `res://assets/tex/*.webp`
  (VRAM compressed, already enabled for desktop+mobile). Load with `ResourceLoader.exists()` and fall back to
  `WorldBuilder`'s procedural nodes; keep the web build's Low tier on 512 px textures.

---

## 7. Redesign ideas (ranked by impact ÷ effort, each ≤ ~1 h per version)

1. **Instant hints from the known solution** (H12/G1). 15 min each. Removes the freeze risk and the bogus "board looks
   right" toast; the bot gets faster too.
2. **Fix the room bugs in one pass**: window glass, brushes, plate rims, prop/board clipping, kiln vs shelf (H3, H6-H9,
   G2-G5). 30 min each. Biggest visual gain for zero credits; the room stops looking broken in screenshots.
3. **HTML: kiln camera focus + portrait framing** (H2). 40 min. The payoff moment of every level becomes visible on
   phones.
4. **HTML: screen return logic + keys + Esc everywhere** (H1, H17). 40 min. Removes the invisible-board dead-end.
5. **Glaze reflections** (T7 or RoomEnvironment / ProceduralSky). 20 min each. Tiles finally look like glazed ceramic.
6. **HTML: Settings screen + design-language save keys + language from the browser.** 1 h. Closes most section-3
   gaps; copy Godot's layout and order.
7. **Matched-edge progress in the HUD** ("Kenar 18/24"): the glow already computes `matched`; showing the count gives
   a clear sense of progress on 6×6 boards. 15 min each.
8. **Godot: keyboard focus pass** (`FOCUS_ALL`, focus style, `grab_focus` on open) + P/M/X keys + HUD sound toggle.
   1 h.
9. **Godot: atlas gallery + sequential collection bakes + atlas reuse on restart** (G6-G8). 1 h. Smoother web build.
10. **New-record highlight and Main-menu button on the complete card** (both). 20 min each.
11. **Crest + footer + split Play/Continue** on the title (T6). 30 min each once the image exists.
12. **Cat relocation to the stool with a sitting GLB** (A2): the cat is currently at the far right screen edge,
    half under the HUD; on the stool it is a visible, charming detail. 30 min each.
