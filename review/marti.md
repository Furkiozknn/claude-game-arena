# Martı review (HTML + Godot 4)

Static code review only. Nothing was run (no browser, no Godot). Everything below comes from reading
`marti/index.html` (1867 lines, commit b8cbe21), every script and resource in `marti-godot` (commit 233b3d9,
clean tree), the README screenshots, and `docs/design-language.md`. Findings that come from reasoning, not
from code that can be read directly, are labelled **(derived)**. Anything I could not confirm is labelled
**unverified**.

Severity: **P0** = the game plays wrong for every player. **P1** = a visible bug or a broken feature.
**P2** = polish, edge case or cost.

---

## 1. HTML bugs and broken features

### P0

**H1. Steering is mirrored (keys and pointer) (derived)**
- Where: `keyControls` l.1319-1320 (`lf → S.tx -=`, `rt → S.tx +=`), `pointerSteer` l.1327
  (`S.tx = nx * CORR`), camera l.1244-1248.
- Why: the camera sits at `z = S.d - 19` and looks along **+z** (`lookAt(…, S.d + 14)`). For a Three.js camera,
  `zAxis = eye - target ≈ (0, +, -1)` and `xAxis = up × zAxis = (0,1,0) × (0,0,-1) = (-1, 0, 0)`. So screen-right
  is world **-x**. Right arrow / D raises `S.tx` (+x), which moves the gull to the **left** of the screen. Moving the
  mouse or a finger to the right side (`nx > 0`) also sends the gull to the screen-left shore.
- Repro: start a run (`?run`), hold the Right arrow: the gull drifts toward the left shore. Move the mouse to
  the right edge: the gull goes to the left edge.
- Fix (inputs only; the bank already follows `G.vx`, so it stays correct):
  ```js
  if (lf) S.tx += dt * 18;            // l.1319
  if (rt) S.tx -= dt * 18;            // l.1320
  S.tx = -nx * CORR;                  // l.1327
  ```
  The bot works in world coordinates, so it does not change. Note: `wingR`/`wristR` (x>0) show on the
  screen-left side. That is only a naming issue.

### P1

**H2. Touch: a tap to dive also teleports the steering target**
- Where: `pointerdown` l.1337-1339 calls `pointerSteer(e)` (absolute position) before `pointerup` l.1349 decides
  it was a tap.
- Repro (phone): fly at the top left, tap the bottom right to dive. The gull dives *and* flies to the bottom
  right, because the tap set `S.tx`/`S.tyBase`.
- Fix: steer touch by relative drag. On `pointerdown`, store `ptrStart` plus `S.tx` and `S.tyBase`. On `pointermove`, set
  `S.tx = clamp(tx0 - dx / innerWidth * 2 * CORR * 1.4, ±CORR)` (the minus sign comes from H1) and
  `S.tyBase = ty0 - dy / innerHeight * (YMAX - 3) * 1.4`. Do not steer on `pointerdown` for touch.

**H3. Ferry cabin, tanker bridge block and fishing cabin are not solid**
- Where: `BOAT_BOXES` l.468-473 compared with `boatGeo` l.440-463.
  - Ferry: the box stops at `y1: 2.6`, but the cabin (l.443-444) spans y 2.3-4.75, x ±2.65, z -5.65..2.65. The gull
    flies through the yellow cabin at y≈3.5 without a hit.
  - Tanker: the white block 4×5×5 at z -13 (l.458) is wider than the funnel box (`hw: 1.1`, l.471).
  - Fishing: the cabin (l.453, y 1.4-2.8) sits above the hull box (`y1: 1.8`).
  - Sail: the sail panel (l.463, y 4-16, z -2.8..1.2) has no box. Only the mast is solid.
- Fix:
  ```js
  ferry:   [{ ox:0, oz:0, y0:0, y1:2.6, hw:3, hd:7.5 }, { ox:0, oz:-1.5, y0:2.6, y1:4.5, hw:2.65, hd:4.15 }],
  tanker:  [..., { ox:0, oz:-13, y0:3.4, y1:8.5, hw:2, hd:2.5 }],
  fishing: [..., { ox:0, oz:-0.8, y0:1.4, y1:2.8, hw:0.9, hd:0.9 }],
  sail:    [..., { ox:0.05, oz:-0.8, y0:4, y1:16, hw:0.15, hd:2 }],
  ```
  Keep the ferry cabin top at 4.5 or lower. The deck simit at y 5.3 minus GY 0.55 = 4.75 must stay grabbable.

**H4. Fireworks are hidden by fog**
- Where: `M.fx` l.349 has no `fog:false`, and `fireworkBurst` l.1285 puts bursts at `S.d + 140..240`. The fog runs
  110 → 320 (l.311), so the bursts are 15-60% fogged into the sky colour.
- Fix: give fireworks their own `Points` + material copy with `fog:false`. Keeping one shared material and only
  setting `fog:false` would also un-fog near splashes, which is acceptable too.

**H5. At night the whole house cube glows instead of its windows**
- Where: l.1168-1169 sets `M.house.emissive`, the material of all 700 house instances.
- Fix (one extra draw call): build `winGeo` = 4 dark quads per side, 0.02 proud of a unit box (two rows of two
  windows, size 0.18×0.22, on the faces x=±0.5 and z=±0.5). Use `IM.win = makeInst(winGeo, M.win, 700)` with
  `M.win = MeshLambertMaterial({ color:0x1e293b, emissive:0 })`. Every frame (or when dirty), call
  `setInst(IM.win, PR.house.map(h => ({...h, c: undefined})))`, or add a `noColor` flag to `setInst`. Ramp
  `M.win.emissive` to `#FFB347 * night` and leave `M.house.emissive` black.

**H6. Music piles up after the tab was hidden. Music keeps playing during pause.**
- Where: `scheduleMusic` l.1524-1531 schedules every missed step, including steps whose `t` is in the past. The
  browser slows `setInterval` to about 1 s in hidden tabs, so about 8 steps fire at once in clumps. When the tab
  comes back, the backlog plays as one burst. `togglePause` l.1439 never touches audio.
- Fix: at the top of `scheduleMusic`, add `if (AU.next < AU.ctx.currentTime) AU.next = AU.ctx.currentTime + 0.05;`.
  In `togglePause` and `visibilitychange`, call `AU.ctx.suspend()` / `resume()`.

**H7. When the CDN fails, the title card is a dead end**
- Where: the importmap l.16-21 and the module l.194. The `error`/`unhandledrejection` handlers (l.233-234) live
  *inside* the module, so they never run if `three` fails to load. The static title card shows a "Başla"
  button with no handler, an empty how-to list and an empty tagline.
- Repro: open the page offline, or block jsdelivr.
- Fix: add a classic `<script>` before the module:
  `setTimeout(() => { if (!window.marti) { fatal.style.display='flex'; fatal.textContent='Could not load the game (network). / Oyun yüklenemedi.'; } }, 8000)`.
  Also disable `#bStart` until the module enables it. This also covers the design rule "Loading… n/N".

**H8. The sound button text is Turkish only, and the HUD uses text glyphs**
- Where: l.138-141: `II`, `♪`, `SES` (stays "SES" in English), `EN`. The design rule is no OS glyphs or emoji.
- Fix: inline SVG icons (pause bars, note, speaker, globe, gear), 20 px, with an `aria-label` per language. See §3.

### P2

| # | Where | What and how to reproduce | Fix |
|---|---|---|---|
| H9 | l.417 `roofGeo` | A 4-sided cone has its corners on the ±x/±z axes, so every roof is turned 45° against its box (diamond look; visible in `docs/close.png`). | `new THREE.ConeGeometry(0.72, 0.8, 4).rotateY(Math.PI/4).translate(0,0.4,0)`. Radius 0.72 then gives about 2% overhang per unit; the existing `sx: w*1.2` gives the eave. |
| H10 | l.797-803 | Mosque domes sit straight on sloped ground with no building under them. The hemisphere floats or sinks on slopes. Minarets use the dome's `y` (l.801-802), not the ground height at their own x/z, so they float or sink too. | Add a body: `mosqueBodyGeo` = box 1×0.45×1 (cream `#EFE6D2`) as its own instanced mesh with the same matrices, and put the dome on top (`y + 0.45*sy`). Use `terrH(x±4.5, z…)` for each minaret. Better: the mosque GLB (§6). |
| H11 | l.415, l.804-807 | Balloons have no basket. | Merge into `balloonGeo`: sphere r1.3 (white vertex colour, tinted by the instance), 4 rope boxes 0.04×1.2, basket box 0.6×0.5×0.6 (`#8B5A2B`) at y -2.1. Switch the IM to `M.vc`. The basket gets tinted by the instance colour (acceptable). |
| H12 | l.1192-1198, `setInst` l.543 | Fish never pitch along their leap. `_ang` is set but unused, and `setInst` only rotates about y. | Add `_eu.set(o.rx||0, o.r||0, 0, 'YXZ'); _iq.setFromEuler(_eu)` in `setInst`. For fish use `rx = -0.9 * Math.cos(clamp(u,0,2) * Math.PI/2)` (nose up while rising, down while falling). |
| H13 | l.886, l.1187 | The rival flock has no wing motion (black "planes", visible in `docs/phone_run.png`). Hostile flocks fly -z, but their member offsets (`oz -2.5, -5`) are not mirrored, so the V points backwards. | Mirror the formation with `oz * Math.sign(f.vz)`. For flapping, add `onBeforeCompile` on a cloned `M.vc`: `transformed.y += max(abs(position.x) - 0.6, 0.) * 0.35 * sin(uTime*9. + instPhase)` with an `InstancedBufferAttribute('instPhase')`. About 15 lines, still one draw call. |
| H14 | l.823 | The mansion is always `rotation.y = PI/2`, so its windowed front (+z) faces +x. On the right shore (x>0) it shows its back to the strait. | `m.rotation.y = side < 0 ? Math.PI/2 : -Math.PI/2`. Use the same rule for every asset with a front. |
| H15 | l.1674, l.1684 | The `dist` mission shows a raw float on the title ("1234.5678901") with no "/3000". The game-over line shows the same float. | `Math.round(p)` and `p + '/' + def.goal + ' m'`. |
| H16 | l.1422-1438 | Game over plays no sound. "Out of stamina" is completely silent. The run's `reason` is never shown, even though the I18N keys `crash`/`energy` exist. | Add `sfxOver()` (three falling triangle notes, 0.12 s apart) and duck `AU.mus` to 0.15 for 1.5 s. Add a subtitle `tx(reason)` under the title of `#over`. |
| H17 | l.479-480, l.237 | Bridge towers can never be hit: tower inner face 23.7 − GX 1.0 = 22.7 > CORR 20. The README and how-to say "dodge bridge towers". The hangers (l.493-496) look solid but are not. Fishing lines (l.497) are at x ±34..45, outside the corridor. | Either widen CORR near bridges or move the towers to ±22 (this changes `BR`, the cable curve and the bot box), or change the text. Add hanger boxes (every 3 u, hw 0.09 + GX), or accept them as forgiving and say so. |
| H18 | l.1267, l.1269 | `hemi.color` and `sun.color` jump at `p = 0.5`, a visible lighting pop at about 85 s. | `hemi.color.lerpColors(A, B, smooth(0.45,0.7,p))`, and the same for `sun.color`. |
| H19 | l.1256 vs l.1270 | The sun disc is at +x (screen-left, see H1), but the directional light comes from `G.x - 30` (screen-right). Shadows point toward the visible sun. | Put the light on the disc side: `sun.position.set(G.x + 30, 70, S.d + 45)`. |
| H20 | l.1139-1142 | Title attract mode advances `S.t`, so after about 2.5 minutes on the title screen it is night with fireworks off, and `diffK` reaches maximum. | Pin the attract clock: `S.t = Math.min(S.t, 60)` while on the title, or use a separate `attractT`. |
| H21 | l.1299-1301 | Key auto-repeat: holding Space (dive) when the run ends restarts the run after 0.6 s while Space is still held. | `if (e.repeat) return;` before the start/restart branches. |
| H22 | l.1118-1119 | `stealFood` can end the run inside `checkHits`, and then `checkPickups` still runs in the same step (`S.lives > 0`). The score can change after the run was saved. | `if (S.state !== 'playing') return;` after `checkHits()`. |
| H23 | l.1467-1471 | Missions load once at boot. If a session crosses midnight, progress is added to yesterday's `MS` while `dailyIds()` returns today's set. | In `missionAdd`/`missionSet`, call `missionsLoad()` when `MS.date !== dayKey()`. |
| H24 | l.282 | The language defaults to TR. The design asks for the browser language. | `navigator.language.startsWith('tr') ? 'tr' : 'en'` when nothing is saved. |
| H25 | l.48-49, l.113 | `.ibtn` is about 28-30 px tall (phone). The design asks for 44 px touch targets. No `:focus-visible` style anywhere. The top bar wraps to two rows on a 390 px phone (`docs/phone_run.png`). | 44 px buttons at `pointer:coarse`, add `:focus-visible{outline:2px solid var(--accent2)}`, and on phones hide `#sBest` in the bar or move the icons to a second glass pill. |
| H26 | l.1679 | The 🥯 emoji stands in for simit (a bagel, and an OS emoji). | A small inline SVG ring (gold circle with a sesame-dot stroke). |
| H27 | head l.1-21 | No `<link rel="icon">`, so `/favicon.ico` returns 404. No logo art. | A favicon made from the crest (§6) as a data URI, or a 64 px PNG. |
| H28 | l.1415 | "İyi uçuşlar!" / "Have a good flight!" is hard-coded instead of an I18N key. | Move it to `I18N.*.fly`. |

**Leaks (checked):** none on the GPU. Boats, bridges, storms, power-ups and specials create a `new THREE.Mesh` per
spawn and only `scene.remove` it (l.909-913, l.920, l.1055), but every one shares a module-level geometry and
material (`BOAT_GEO`, `BRIDGE_GEO`, `stormGeo`, `PWR_GEO`, `SPECIAL_GEO`, `M.vc`). Removed meshes are only JS
garbage, and `dispose()` would be wrong here because it would free the shared buffers. Only plain
`Object3D`s are created per spawn.

**Per-frame CPU cost (P2, for a UHD 620 laptop):**
- `updateTerrain` (l.659-676, called every frame from l.1156) recomputes 2×24×44 = 2,112 vertices with `terrH`
  and re-uploads about 25 KB, although the land is static in world space and the window only moves every
  `LZ = 10` units. Fix: `if (z0 === lastLandZ0) return;` at the top.
- `updateWater` (l.677-691) is 50×64 = 3,200 vertices with 3 `sin` each, plus a colour lerp and about 77 KB of upload per
  frame. This is fine on desktop. On `?low`, use `WSTEP = 10` and update every second frame.
- While paused, `renderFrame` l.1781 calls `updateWaterOnly()`, but `WT` does not advance, so it rebuilds the
  identical water every frame for nothing. Delete it, or advance `WT` while paused.
- `setInst` for houses, roofs, trees, domes, minarets and clouds (l.1159-1166) recomposes about 400 static
  matrices every frame. Add a `PR.dirty` flag set in `spawnShoreBand`/`cull`/`clearWorld`. Only balloons
  move (they bob).
- `simits.filter().map()`, `obsKites.map()` ×2, `flockArr`, `fishArr` (l.1181-1196) allocate new arrays
  every frame. Reuse arrays.
- `martiSim` (l.1829) runs `frameLogic` → `updateVisuals` for every simulated step (water, terrain, all instance
  matrices, `floatText` DOM nodes). `?sim=600` does 36,000 full visual updates. Skip `updateVisuals` while
  `simming` (collisions only use simulation data: boats move in `simStep`, kite `cx` is set at l.1115).
- `bestScore()` parses `localStorage` JSON every 0.1 s in `updateHud` l.1750. Cache it after `saveHigh`.

**Test hooks (checked):** `?auto` (bot, auto-restart after 2.5 s), `?debug` (#dbg with FPS, draw calls,
triangles, errors), `?sim=N` (martiSim), `?low` (no shadows, half the particles), `?lang`, undocumented `?run`,
`window.marti` (= S, with `S.G`, `S.runs`). Missing against the design: `?noassets`. `?low` keeps pixel ratio 1.5
(use 1.0).

---

## 2. Dead or unnecessary code (HTML, verified with grep)

| Line(s) | Code | Note |
|---|---|---|
| 1146 | `if (S.state === 'paused') updateWaterOnly();` inside `frameLogic` | Unreachable: `renderFrame` l.1780 only calls `frameLogic` when not paused. |
| 1148, 1781 | `updateWaterOnly()` | Redraws identical water (WT is frozen), see the CPU notes. |
| 1177 | `for (const b of obsBridges) b.mesh.visible = true;` | Never set to false anywhere. |
| 1180 | `k.cx = …` in `updateVisuals` | Duplicates l.1115 in `simStep`. |
| 1126 and 1237 | two dive-splash spawners | Same effect from two places. Keep one. |
| 1385-1386 | `const ahead = p.fish ? 0 : 0; void ahead;` | No-op. |
| 1351, 1437 | `void e;`, `void reason;` | Lint silencers. `reason` should be shown (H16). |
| 763-764, 1409, 1412 | `S.bestAtStart`, `S.runStartWT`, `S.horn`, `S.lastBank`, `S.lastSimitTime`, `S.wt` | Written or initialised, never read. (`S.newBest` is only read by external tests through `window.marti`; keep it.) |
| 260-261 | I18N keys `crash`, `energy`, `left`, `fish`, `steals`, `fishN` (both languages) | Never used through `tx()`. `crash`/`energy` become used if H16 is done. |
| 1758-1760, 1846 | `renderHudLabels()` | `applyLang` already fills `[data-i18n="stamina"]`. |
| 1418-1421, 1852-1853 | `spawnBandsAhead()` and the boot block | Copies of the spawn loops at l.1098-1099. One helper is enough. |
| 817 | `SPECIAL_MAT` | Every entry is `M.vc`. |
| 1196 | `c: '#FFFFFF', sx:1, sy:1, sz:1` for fish | Creates and refreshes an `instanceColor` buffer that is always white. |
| 1059 | comment "the fixed-step simulation" | It is variable-step (`dt` clamped to 0.05, l.1777). The comment is wrong. |

---

## 3. Design-language gaps (HTML) and plan

| Rule | Now | Plan |
|---|---|---|
| Loading | No loading state; a dead Start button if the CDN fails (H7) | Title card shows `Loading… n/N` (n = Three + font + GLBs), Start disabled until ready or 10 s, then the procedural fallback. |
| Title | Text logo, tagline, how-to, Start, missions, highs | Add the crest image (§6), **Settings** button, language toggle (TR/EN pill), best score line, footer `Claude Game Arena · built by Claude Haiku 5.5` linking to the arena page. "Continue" does not apply (endless run, no mid-run save); write that down rather than faking it. |
| HUD | Glass bar with text logo, stats, text buttons `II ♪ SES EN` | Crest 28 px + "Martı", stats, SVG icon buttons in the order: pause, music, sound, language, settings (gear). 24 px icons, 44 px hit area on touch. |
| Pause | Resume, Main menu; dimmed but not blurred | Add **Restart** and **Settings**; `#pause{backdrop-filter:blur(6px)}`; suspend `AU.ctx`. |
| Settings | Missing | New card: master / music / effects sliders (gains `AU.bus`, `AU.mus`, `AU.sfx`), language TR/EN, quality Low/High (shadows, pixel ratio 1.0/1.5, FX_N), fullscreen (`requestFullscreen`). Same order as the other games. |
| End | Title, 4 stats, new record, Retry, Main menu | Add the reason subtitle (H16), sound, and rename "Tekrar dene" to "Tekrar oyna / Play again" to match the arena. |
| Toasts | `''`, `gold`, `bad` | Rename to `info`, `good`, `bad` (CSS aliases), keep the stack under the bar. |
| Keys | P/Esc, M, X, L, Enter/Space | Add `F` for fullscreen (free in Martı). Add `e.repeat` guards (H21). |
| Save keys | `marti.highs`, `marti.missions`, `marti.lang`, `marti.music`, `marti.sfx` | `arena.marti.settings` = `{master:.8, music:.6, sfx:.8, lang, quality}`, `arena.marti.best` (highs), `arena.marti.save` (missions). On first load, read the old keys once, write the new ones, and keep the old ones. |
| Defaults | TR, full volumes | Browser language, volumes from the design defaults, quality Low when `matchMedia('(pointer:coarse)')`. |
| Assets | None (all procedural) | GLTFLoader + `?noassets` flag; keep every procedural builder as the fallback (also used on `file://`). |
| Visual grid | Mostly 6/8/10/12 px | Snap to 8 px in the paddings and gaps you touch; leave the rest. |

---

## 4. Godot bugs (`marti-godot`)

### P0

**G1. Steering is mirrored, the same as H1 (derived)**
- Where: `game_world.gd` `_keyboard_steer` l.292 (`target_x + axis.x …`), `set_pointer_target` l.220, camera
  `look_at` l.466.
- Why: `Basis.looking_at(dir=(0,0,1))` gives `z = (0,0,-1)` and `x = up × z = (-1,0,0)`, so the camera's right is
  world -x. `steer_right` and the pointer's right half both send the gull screen-left.
- Fix: `target_x = clampf(target_x - axis.x * dt * 18.0, …)` and
  `target_x = -clampf(screen_pos.x / size.x * 2.0 - 1.0, -1.0, 1.0) * cfg.corridor`. Then add a test to
  `run_tests.gd` that the camera's right axis, dotted with the steering delta, is greater than 0.

### P1

**G2. Hit spam during invulnerability**
- Where: `_on_hit` l.335-339 together with `GameState.take_hit` l.180-182, which returns `true` while
  `invuln > 0`.
- What: after the first hit, every frame the gull still overlaps a hazard (tanker hull 36 u, bridge deck, ferry)
  is treated as "absorbed". Each of those frames spawns a 16-particle `CPUParticles3D` node and plays `hit`.
  At 30 u/s along a tanker that is about 70 bursts and a hit-sound machine-gun that uses up all 6 SFX voices.
  HTML returns silently (l.968).
- Fix: `if GameState.invuln > 0.0: return` as the first line of `_on_hit`, or have `take_hit` return
  `-1/0/1` (ignored / absorbed by shield / life lost).

**G3. Simit and the tailwind/gold power-ups lie flat**
- Where: `TorusMesh` l.756-760 and l.874-877. Godot's `TorusMesh` lies in the XZ plane. l.589 and l.603 only spin
  them about Y, so the spin cannot be seen and from the chase camera they read as discs. The ferry deck
  shows a stack of flat rings in `docs/day.png`.
- Fix: `Basis(Vector3.UP, a) * Basis(Vector3.RIGHT, PI / 2)` in l.589. Bake the X rotation into the power mesh,
  or set the node basis the same way in l.603.

**G4. Tanker superstructure has no collision (regression from HTML)**
- Where: `boat_type.gd` `collision_boxes` l.35-39 returns only the hull AABB plus a mast. The tanker's 4×5×5
  cabin (y 3.2-8.2, z -13) and the ferry cabin (y 2.6-4.8) are not solid. HTML had at least the funnel box.
- Fix: add the cabin AABB when `cabin_size.y > 0.5`:
  `AABB(Vector3(-cabin_size.x/2, height, cabin_z - cabin_size.z/2), cabin_size)`. Clamp the ferry cabin top to
  4.5 (simit at 5.3).

**G5. Water and land swim and crawl**
- Where: l.430-432 moves the water and land planes continuously (`d + …`), while the shaders sample world-space
  waves and terrain at the vertices. The 5-unit grid slides under the function, so the wave facets and hill
  silhouettes wobble every frame. HTML snaps (`floor(... / WZ) * WZ`).
- Fix: `water.position.z = snappedf(d + WATER_LEN * 0.5 - WATER_BACK, WATER_LEN / 112.0)`, and do the same for
  land. (Visual severity unverified.)

**G6. Music loop has a gap of about 1 s**
- Where: `sound.gd` l.42 sizes the buffer `bars + RATE` (1 extra second), and `_finish_music` l.141-142 loops
  over the whole buffer. Every 7.74 s the beat stops for about 1 s (only decay tails play).
- Fix: `loop_end = int(MUSIC_BARS * 16 * STEP * RATE)`. Fold the tail back onto the start
  (`buf[i] += buf[i + L]` for `i < RATE`) so that pads ring across the seam.

**G7. On touch, dragging to steer always dives (unverified on a device)**
- Where: `main.gd` l.235 maps `MOUSE_BUTTON_LEFT` to `dive`. With the default
  `input_devices/pointing/emulate_mouse_from_touch = true`, a finger down produces an emulated left button, so
  `Input.is_action_pressed("dive")` (l.254, l.428) stays true for the whole drag.
- Fix: in `_setup_input_map`, skip the mouse event when `DisplayServer.is_touchscreen_available()`.
  Dive on touch then comes only from `dive_tap()`. Also apply the relative-drag idea from H2.

### P2

| # | Where | What | Fix |
|---|---|---|---|
| G8 | `game_ui.gd` l.441-444 | The hint labels on the title and pause cards are set once and never updated by `apply_texts`, so the old language stays after L. | Keep references and set them in `apply_texts`. |
| G9 | `game_world.gd` l.491 | `_house_mat.emission_enabled` is toggled at runtime. This changes the material's shader variant, so expect a compile hitch at dusk and again on the next run (WebGL). Unverified. | Leave `emission_enabled = true` and only change `emission`. |
| G10 | `game_world.gd` l.491-492 | The whole house glows at night (the same as H5). | A second MultiMesh "windows" reusing the house transforms, with an emissive material. |
| G11 | l.648-652, `fx.gd` l.21-27 | Fireworks at 140-240 u are fogged (fog 110-320). | `mat.disable_fog = true` on a separate firework material (the property exists in 4.3+; check the name in 4.7: unverified). |
| G12 | `sound.gd` l.154 | `horn` is synthesised but never played. The ferry horn from HTML is missing. | In `_move_entities`, the first time a ferry is within 90 u ahead: `Sound.play("horn")`, then set a flag on the obstacle. |
| G13 | l.98-100, l.739-749 | The dome is a full ellipsoid centred 0.6 above ground (half buried). Minarets are plain white cylinders with no balcony or cap, use the dome's `dy`, and have no building. | Port HTML's `minaretGeo` (balcony and blue cone) and add a body box, or use the mosque GLB. |
| G14 | l.790-798, l.185, l.621 | Flock birds are flat boxes with no flapping. The hostile V points the wrong way (offsets not mirrored with `speed < 0`). | `m.z * signf(o.speed)`. For flapping, a `ShaderMaterial` with `INSTANCE_CUSTOM` phase (`mm.use_custom_data = true`) and `VERTEX.y += max(abs(VERTEX.x) - 0.5, 0.0) * 0.35 * sin(TIME * 9.0 + INSTANCE_CUSTOM.x)`. |
| G15 | l.32, l.106 | Cloud props are about half the HTML size (about 1 u of puffs × 2.4-4.4 scale) and read as white dots in `docs/day.png`. | Scale ×2 (size 5-9 wide) or raise the puff radii. |
| G16 | l.595-596 | Fish never pitch (the same as H12). | `Basis.from_euler(Vector3(-0.9 * cos(clampf(u,0,2) * PI/2), 0, 0))`. |
| G17 | `save_system.gd` l.148-157 + `game_state.gd` l.120 | `stat_changed("dist")` fires every frame, and `mission_track` then calls `daily_ids()`, which builds a new RNG, array and shuffle each frame. | Cache `daily_ids` per date key. |
| G18 | `game_world.gd` l.315 | `Bot.hazard_boxes` allocates `Box` objects for every obstacle every frame in `_check_hits`. | Fine for now. Use a pooled array if profiling shows it. |
| G19 | `game_world.gd` l.473-492 | The sky shader uniforms change every frame. With the sky as background and reflections using it, Godot may re-filter the radiance map each frame (unverified for the Compatibility renderer). | Update the sky only when `p` changed by more than 0.002, or set `env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED` (the water fakes its fresnel already). |
| G20 | `main.gd` | No pause on focus loss or a hidden tab. HTML has it. | `_notification(NOTIFICATION_APPLICATION_FOCUS_OUT)` → `toggle_pause()` while playing. |
| G21 | `game_ui.gd` l.553-560, `main.gd` l.163 | Slider changes are saved only by the Back button. Leaving settings with Esc (pause → settings → Esc resumes) loses them on the next launch. | `Save.save_all()` in `_on_slider` on `drag_ended`, or in `resume_run`. |
| G22 | `game_world.gd` l.277-278 and l.444-445 | Two dive-splash spawners (the same duplication as HTML). | Keep one. |
| G23 | `game_world.gd` l.210-213 | The second loop sets the props to shadow OFF again (they are already in `_mm`). | Delete l.212-213. |
| G24 | `game_world.gd` l.179 | `gull.scale = Vector3.ONE * 1.0`. HTML uses 1.1 with the same hitbox. | 1.1 for parity, or document the choice. |
| G25 | `save_system.gd` l.31, l.36 | Defaults master 1.0 and language "tr". The design asks for 0.8 and the OS locale. | `0.8`, `"tr" if OS.get_locale_language() == "tr" else "en"`. |
| G26 | `game_ui.gd` l.646-647 | Icon buttons are 34 px and `FOCUS_NONE`. | 44 px on touch, and allow focus. |
| G27 | `loc.gd` | Unused keys: `fly`, `crash`, `energy`, `on`, `off`, `left`, `lives`, `stamina`, `reason_crash`, `reason_energy`. `other_lang_button()` l.73 is never called. | Use `fly` (start toast) and `reason_*` (end card), delete the rest. |
| G28 | `fx.gd` l.63 | The trail emits along `Vector3.BACK` (+z = forward). Harmless (the gull outruns it), but the name is wrong. | `Vector3.FORWARD`, or leave it with a comment. |
| G29 | `game_world.gd` | The bridge in `docs/day.png` looks washed out, and the left half of the cable seems missing. Unverified (could be fog plus the angle). | Check with `--d0=850 --screen=hud`. |

Godot verified OK: MultiMeshes for repeated props (props only rewritten when dirty, better than HTML), shared
boat, bridge and storm meshes, freed with `queue_free` on cull, `Fx.burst` nodes free themselves on `finished`,
`take_hit`/`end_run` guard re-entry, `is_action_pressed` ignores key echo, unit tests cover the rules (not
steering, not collision geometry).

---

## 5. Parity table (HTML vs Godot)

| Feature / content / UI | HTML | Godot | Better | Port |
|---|---|---|---|---|
| Steering direction | mirrored (H1) | mirrored (G1) | — | fix both |
| Gull model | ball + box sticks, edge-on from behind | tapered panels, grey back, fan tail, dihedral 0.3, pitch 0.5 | Godot | Godot gull shapes → HTML (until GLB) |
| Sky | flat colour ramp, sphere sun, Points stars | gradient sky shader, sun glow, moon, hashed stars, 7 day keys with sun elevation | Godot | Godot sky → HTML (inverted sphere + ShaderMaterial gradient) |
| Water / land | CPU rebuilt per frame, snapped grid | vertex shader, fresnel, sliding grid (G5) | Godot after G5 | the shader idea → HTML optional |
| Tonemap / glow | none | filmic + glow | Godot | — |
| Specials: yalı row, stone tower, lighthouse | yes (l.502-523, 811-826) | missing | HTML | → Godot (or both via GLB §6) |
| Ferry passengers holding simit, red waterline stripe, roof slab | yes (l.440-450) | plain boxes | HTML | → Godot |
| Tanker funnel + collision | yes | white block, no collision (G4) | HTML | → Godot |
| Fishing lines under the bridge | yes (l.497) | missing | HTML | → Godot |
| Minaret balcony + blue cap | yes | plain cylinder | HTML | → Godot |
| Roofs | pyramids, 45° off (H9) | flat slabs | HTML after H9 | → Godot |
| Domes | hemisphere on ground | buried ellipsoid | HTML | both need a body |
| Clouds | big, 3 puffs | small, 4 puffs | HTML size, Godot shape | scale Godot ×2 |
| Storm cloud | 4 grey spheres | 8 dark puffs | Godot | → HTML |
| Simit orientation | upright, spinning | flat (G3) | HTML | → Godot |
| Particles | one `Points` (1 draw call) | a `CPUParticles3D` node per burst | HTML (cost) | — |
| Feather trail / idle feathers | idle feathers drifting | trail behind the gull | both fine | — |
| Music | 16-step sequencer, layers build with speed | static 7.7 s loop, gap (G6), no layering | HTML | layering → Godot (two loops: base + arp/pad, cross-fade by speed) |
| Ferry horn | yes | never played (G12) | HTML | → Godot |
| Game-over sound | no | no | — | add to both |
| Start toast "İyi uçuşlar" | yes | no (`fly` key unused) | HTML | → Godot |
| Settings screen (volumes, language, quality, fullscreen) | missing | yes | Godot | → HTML |
| HUD icons | text glyphs, "SES" | drawn icons (pause, note, speaker, globe) | Godot | → HTML as SVG |
| Lives | feather SVGs (matches the prompt) | gull-head dots | HTML | feathers → Godot |
| Chips | pill chips | one yellow text label | HTML | → Godot |
| HUD logo | text logo in the bar | none | HTML | → Godot |
| Pause buttons | Resume, Menu | Resume, Settings, Menu | Godot | both add Restart |
| Auto-pause on a hidden tab | yes | no (G20) | HTML | → Godot |
| Gamepad | no | yes | Godot | → HTML (Gamepad API, optional) |
| Daily mission pick | `hashStr` + mulberry | `String.hash()` + RNG | — | different sets on the same day. Port the HTML hash to GDScript if cross-version parity matters. |
| Mission text formatting | float bug (H15) | rounded | Godot | → HTML |
| Test hooks | `?auto ?debug ?sim ?low ?lang ?run`, `window.marti`, `martiSim` | `--auto --auto-quit --no-save --lang --t0 --d0 --screen --end-after --trace`, unit tests | Godot (tests), HTML (draw-call overlay) | `--t0/--d0` → HTML as `?t0=&d0=`; debug overlay → Godot (`--debug` Label with FPS and draw calls) |
| Portrait camera | FOV widening | FOV widening + full follow in portrait | Godot | → HTML |
| Gull scale | 1.1 | 1.0 | — | align to 1.1 |

---

## 6. Asset plan (budget about 80 Higgsfield credits)

Conventions for both engines (derived from the code): **+Y up, +Z forward** (the gull flies +z; glTF's front is
+Z, so no rotation is needed on import). World units ≈ metres. Normalize the size in code from the bounding box,
so Tripo's arbitrary scale does not matter. Process with glTF-Transform: `weld`, `simplify` to the triangle budget,
`resize` textures to 256-512, `webp`, then `center --pivot below` (base pivot) **except** where a centre pivot is
stated. HTML: replace the GLB materials with `MeshLambertMaterial({ map, vertexColors? })`. Godot: import the
`.glb`, take the mesh from the first `MeshInstance3D` for MultiMeshes, and use `StandardMaterial3D` with
`vertex_color_use_as_albedo = true` + the albedo texture, so that MultiMesh instance colours still tint.
Keep every procedural builder as the fallback (`?noassets`, `file://`).

| # | Asset | Tool / credits | Target size (model space) | Pivot / forward | Code hook and constraints |
|---|---|---|---|---|---|
| 1 | **Gull body** (wings removed or folded flat, white body, grey back, yellow beak with red spot, black eyes) | Tripo 5 | length 3.6 (tail z -1.8 → beak z +1.8), height about 1.3 (legs tucked), width 1.25 | **centre of the torso** at (0,0,0); +Z beak | HTML `bodyMesh` l.698 in `gBody`, group scale 1.1 (l.695). Godot `_body` children. ≤1,500 tris. Hitbox stays world GX 1.0, GY 0.55, GZ 1.3 (l.927). |
| 2 | **Gull wing**, one right wing, spread flat, grey top, black tip with white spots | Tripo 5 | root at x=0 → tip x=2.95; chord about 1.3 at the root, 0.8 at the tip (leading edge z≈+0.6, trailing z≈-0.7); thickness ≤0.15; top face +Y | **origin = shoulder** (root, mid-chord) | Split at runtime by triangle centroid: `x < 1.5` → inner (parent `wingR` at **(+0.45, 0.15, 0.25)**), `x ≥ 1.5` → outer, translated by −1.5 (parent `wristR` at **(1.5, 0, 0)** relative to the shoulder). Left wing = the same geometries with `mesh.scale.x = -1` under `wingL` (−0.45, 0.15, 0.25) / `wristL` (−1.5, 0, 0). The animation (l.1222-1236) stays unchanged. Godot: change shoulders from ±0.3 to **±0.45** and the wrist from 1.25 to **1.5** so one GLB serves both; keep `DIHEDRAL 0.3`/`PITCH 0.5`. ≤400 tris per wing. |
| 3 | **Rival gull glide pose** | 0 credits | span 7.3 (wings flat, tips ±3.65), body as #1 | centre; +Z | Merge #1 + #2 (shoulder 0, wrist 0) into one geometry at load. HTML `IM.flock` cap 80 (l.567), Godot `flock` cap 120. White/grey vertex colours so the instance colour `#2B2F36` tints rivals. ≤2,000 tris (80 × 2k = 160k, OK). Flap via the shader from H13/G14. |
| 4 | **Simit** (sesame ring) | Tripo 5 | outer diameter 2.34, tube Ø0.64; ring in the **XY plane** (hole along Z) | **centre**; faces the camera | HTML `IM.simit` cap 160 (l.568) = **one mesh, one material**. Godot `simit` MultiMesh cap 200 (rotate if the GLB comes out flat). ≤300 tris. The texture can be baked to vertex colours to avoid a map. |
| 5 | **Golden simit** power-up | 0 | #4 × 1.3, gold `#F59E0B` emissive 0.2 | centre | Replaces `PWR_GEO.gold` (l.410) / Godot torus "gold". |
| 6 | **Tailwind** power-up | 0 | keep the procedural torus R 1.2 (l.409) + add 3 swirl arcs | centre | The Godot torus must be rotated upright (G3). |
| 7 | **Shield feather** | Tripo 5 | length 2.2 along +Y, width 0.7, flat | **centre**; spins about Y | `PWR_GEO.shield` l.411, Godot `_make_power("shield")`. ≤200 tris. |
| 8 | **Fish** (silver-blue, mid-leap) | Tripo 5 | length 2.5 (tail z -1.3 → head z +1.2), height 0.9, width 0.55 | **centre**; +Z head | HTML `IM.fish` cap 40, Godot cap 60. ≤200 tris. Pitch per H12/G16. |
| 9 | **Ferry** (Istanbul şehir hatları vapuru, white hull, black-and-yellow funnel) | Tripo 5 | **6 wide × ≈4.75 tall × 15 long**; hull 0-2.2, upper deck and cabin ≤4.5 between z -5.65..2.65; bow +Z | **waterline centre** (hull bottom y=0) | `BOAT_GEO.ferry` l.467 / `ferry.tres`. Collision `BOAT_BOXES.ferry` l.469 plus the cabin box (H3/G4). The deck simit at y 5.3, z -4/1/6 must float clear above. Keep the passenger row procedural (z 5.6, l.445-450) or bake it in. ≤2,500 tris. |
| 10 | **Fishing boat** (wooden, small wheelhouse, mast) | Tripo 5 | 3 × 6.4 (mast top) × 6; hull ≤1.4, wheelhouse ≤2.8 at z -0.8, mast at z +0.9 | waterline centre; +Z bow | Boxes l.470 (+ cabin box). ≤800 tris. |
| 11 | **Sailboat** | Tripo 5 | 2.6 × 23 × 7; mast at z +0.5, sail between y 4-16 | waterline centre; +Z bow | Boxes l.472 (+ sail box). ≤600 tris. |
| 12 | Tanker | 0 (keep procedural) | 9 × 10.5 × 36 | — | Fix collision only (H3/G4). |
| 13 | **Mosque** (merged body + main dome + 2 minarets) | Tripo 5 | footprint about 10 × 10, minarets ≈20-23 tall (same as now: dome r3.2 × h2.6, minarets at local (+4.5, -2.5) and (-0.5, +3.5), heights 19.7 / 22.6) | **base centre** at ground; front +Z | One InstancedMesh (cap 40 → 20 is enough), **no instance tint**. Rotate `side < 0 ? +PI/2 : -PI/2` to face the water. Place at `y = terrH(x,z) - 0.3` so the base sinks into slopes. ≤3,000 tris. Replaces `IM.dome` + `IM.minaret` (HTML l.561-562) and Godot `dome`/`minaret`. |
| 14 | **Galata tower** | Tripo 5 | Ø7.6 base, height 26 (cone top) | base centre; front +Z | Replaces `TOWER_GEO` l.513 (placed at x ±60-74, l.812). Godot: new special. ≤1,500 tris. |
| 15 | **Maiden's tower on its islet** (replaces "lighthouse on a tiny island") | Tripo 5 | islet Ø≤6, tower height about 16 | base centre at the waterline | Replaces `LIGHTHOUSE_GEO` l.518. Place at **|x| = 31** (corridor 20 + wing 3.7 → 23.7, ≥4 u clearance) at `y = -0.3`, no collision. Placement: verify visually. ≤1,500 tris. |
| 16 | **Yalı** (wooden waterfront mansion, 2 floors, bay windows) | Tripo 5 | **18 wide × 6.6 tall × 4.4 deep** (current `MANSION_GEO` l.502: main 10×6×4, wings ±7) | base centre; **front +Z** | Rotation per H14. x ±40-46. ≤2,500 tris. |
| 17 | Lighthouse | 0 | — | — | Dropped (covered by #15). |
| 18 | **Bridge** | 0, keep procedural | must match `BR` exactly: towers 3.6×44×6.2 at x ±25.5; deck 140×3.2×8, y 19.6-22.8; cable `y = 27 + 17·(x/25.5)²`; hangers every 3 u from -24..24 | — | A GLB would break the collision and the bot boxes. Optional: a GPT-Image texture is not worth it. |
| 19 | **House facade atlas** | GPT Image ≈2.75 | 1024×512 WebP, 4×2 cells of 256×256: Istanbul row-house facades, windows in a fixed 2×3 grid per cell | — | Map to the house box sides through a per-instance UV offset (`instanceAtlas` attribute in `onBeforeCompile`). Night windows: a *procedural* mask on the same 2×3 grid (generated windows will not align reliably) → feeds H5's emissive. Alternative at 0 credits: a procedural canvas facade. |
| 20 | **Logo crest** (gull silhouette over a simit and the bridge, gold #F59E0B on navy) | GPT Image ≈2.75 | 1024² → 512 WebP + a 64 px PNG favicon | — | Title card, HUD 28 px, favicon (H27), Godot title `TextureRect`. |
| 21 | HUD icons (pause, music, sound, language, settings, feather life, simit) | 0 | 24×24 SVG paths (HTML), `_draw` (Godot, already has 4) | — | Generated icons rarely sit on a pixel grid. Hand-drawn SVG is better here. |

**Credit tally:** Tripo 12 × 5 = 60 (#1, 2, 4, 7, 8, 9, 10, 11, 13, 14, 15, 16) + GPT Image about 5.5 (#19, #20) =
**65.5**. That leaves **about 14.5 in reserve** for about 2 Tripo retries (the gull body and wing are the most likely to need one;
"wings removed" is hard to prompt). If the reserve is not used: a tanker GLB (9 × 10.5 × 36, funnel at z -13.5,
waterline pivot).

**Loading:** HTML GLTFLoader (`three/addons/loaders/GLTFLoader.js`), counted in the title card's `Loading… n/N`,
10 s timeout → procedural fallback. Godot: `ResourceLoader.load_threaded_request` for every GLB at boot, with the
title showing n/N.

---

## 7. Redesign ideas (ranked by impact / effort, each fits in about 1 hour per version)

1. **Fix steering, touch and hit spam first** (H1, H2, G1, G2, G7): 15 min. Without this, everything else is wasted.
2. **Gull readability**: HTML gets the Godot gull shapes (tapered panels, dihedral, pitched leading edge, grey back,
   fan tail) and scale 1.1 in both. Then switch to the GLB body + wing when assets land. 30-40 min HTML.
3. **Night that looks like Istanbul**: window-only glow (H5/G10), fireworks without fog (H4/G11), a warm
   reflection streak on the water under the moon or sun (an additive quad on the water at the light's x),
   bridge deck lights (one emissive strip, 1 draw call). 40 min each.
4. **Landmarks give a sense of place**: mosque with a body, roofs fixed (H9), yalı facing the water (H14), Galata and
   Maiden's tower (GLB or procedural), ported to Godot. 45 min each.
5. **Juice on the core loop**: "Kıl payı!" (near miss) +15 points and a toast when the gull passes within 1 u of a
   hazard box without a hit, "Köprü altı!" +50 for flying under a deck, a short slow-mo (0.3 s at 40%) plus a sound on
   game over, speed lines during tailwind (10 stretched particles). 40 min each, uses existing systems.
6. **Living rival flock**: flapping shader + V formation fixed + a different silhouette (dark-grey backs,
   yellow eyes), plus a "caw" sound when they steal. 25 min each.
7. **Settings + SVG HUD in HTML** (design-language parity): 45-60 min HTML only.
8. **Music that reacts in Godot**: render two loops (beat, arp+pad) and cross-fade the second by speed, as
   HTML does. Fix the loop gap (G6). 30 min Godot.
9. **Sky port to HTML**: Godot's gradient, sun glow and 7 day keys on an inverted sphere with a `ShaderMaterial`.
   This replaces `SKY_STOPS` and the colour pop (H18). 30 min HTML.
10. **Cheap perf wins**: static terrain (only when z0 changes), a dirty flag for props, skip visuals in `martiSim`
    (HTML); water/land snap (G5), cached `daily_ids` (G17) and sky updates throttled (G19) in Godot. 20 min each.
