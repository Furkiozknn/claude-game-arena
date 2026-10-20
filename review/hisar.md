# Hisar review: HTML (kale-savunmasi) and Godot (hisar-godot)

Static code review only. Nothing was run (no browser, no Godot, no server). Every finding comes from reading the code. Items
marked **unverified** depend on runtime behaviour I could not check. One screenshot (`docs/remaster-phone.png`) was looked at.

Files read in full: `kale-savunmasi/index.html` (1,522 lines), `docs/assets.md`, `README.md`; all of `hisar-godot/scripts/**`,
`scenes/main.tscn`, `data/*.tres`, `shaders/*`, `project.godot`, `export_presets.cfg`, plus a skim of `tests/run_tests.gd`;
`claude-game-arena/docs/design-language.md`.

HTML line numbers are `index.html:N`. Godot paths are relative to `hisar-godot/`.

---

## 1. HTML bugs and broken features

### P0 (broken, crash or wrong rule)

None found. The game loop, waves, economy, win/lose, endless mode, the asset loader and its fallback are all consistent.
The two closest calls (both P1 below) are the Space key that calls waves past 15, and tower-panel clicks that get dropped during a wave.

### P1 (clearly wrong or missing)

| # | Where | What is wrong | Repro | Fix |
|---|---|---|---|---|
| H1 | `index.html:845-858`, `1335` | **Space can start wave 16, 17, ... in normal mode.** `startWave()` only checks `!G.running \|\| G.over \|\| G.queue.length`. The 15-wave cap lives only in the HUD (`canCall`, `1279`), and the Space handler calls `startWave()` directly. | Reach wave 15, wait until every enemy has spawned (queue empty) while some are still alive, then press Space. Wave 16 starts with an early-call bonus. Once it is cleared you get "Victory! 15 waves". | At the top of `startWave()` add `if (!G.endless && G.wave >= MAX_WAVES) return;`. Godot already does this (`can_call_wave()` → `has_more_waves()`). |
| H2 | `1232-1238`, `1286`, `859` | **Tower-panel buttons drop clicks during a wave.** Every gold change (each kill) runs `updateHUD()` → `refreshPanel()` → `showTower()`, and that rebuilds `panel.innerHTML`. If the rebuild lands between mousedown and mouseup, the original button is gone and no `click` fires. Hover and keyboard focus are also reset several times a second. | Open a tower panel during a busy wave and click Upgrade or Target a few times. Some clicks do nothing (**unverified** how often; it depends on the kill rate). | Build the tower panel once per (tower, level, mode). On gold change only update `disabled`, the kills `<b>` and the sell refund text in place, the same way the build panel is already handled at `1236`. |
| H3 | CSS `57`, `65` | **Build/tower panel overlaps the wave box from 761 to about 1080 px wide** (tablets, small laptops, phones in landscape). The panel is centred with `width:min(560px, 100% - 290px)`, so its right edge is at `W/2 + w/2`. The wave box starts at `W - 260`. Both sit at `bottom:10px`, and the panel's z-index 6 covers the wave preview and button. | Use a 1024x768 window and select a pad. | Add `@media (max-width:1080px) and (min-width:761px) { #panel { left:10px; transform:none; width:calc(100% - 290px); } }`, or lift the panel above the wave box. |
| H4 | CSS `92-101`, `109-125` | **Title and end cards do not fit landscape phones.** The `max-width:760px` query does not apply at 844x390. The card (132 px crest + 46 px h1 + intro + buttons + controls) is about 480 px tall, and `#overlay` neither scrolls nor scales, so Play/Again can end up off-screen (**unverified**, from the numbers). | 844x390 viewport, title screen. | `.ocard { max-height: calc(100dvh - 24px); overflow:auto; }` plus `@media (max-height:500px) { .ocard .crest{width:64px;height:64px} .ocard h1{font-size:30px} .ocard p{margin:8px 0} }`. |
| H5 | `300`, `1471-1475`; screenshot `docs/remaster-phone.png` | **No portrait camera.** Phones in portrait use the desktop camera, so the roads run sideways and the fortress and gate are off-screen. The screenshot shows no fortress at all. Godot handles this with a portrait preset (`camera_rig.gd:416-418`, FOV fit `395-402`). | Open the game on a phone in portrait. | When `innerHeight > innerWidth`, after Play set `camera.position` so the view looks along +X (yaw π/2, distance about 60, target (-4,0,0)), and raise `camera.fov` to about 62 so the width fits. Re-run this on `resize`. |
| H6 | CSS `34-35`, `55`, `68`; `198`, `1223` | **Touch targets under 44 px.** Top-bar buttons are about 31 px tall (6 px padding + 14 px text). The panel close button `.x` (`padding:2px 8px`) is about 22 px. The design language requires at least 44 px on touch screens. | Phone layout. | `@media (pointer:coarse) { button { min-height:44px; min-width:44px; } .ph .x{ padding:10px 14px; } }`. |
| H7 | `1332-1342` | **Space is hijacked on focused buttons.** The global keydown calls `preventDefault` and `startWave()` for Space even when a button has focus, so Space never "clicks" Play/Again/Upgrade. The design language says Enter/Space confirm focused buttons. | Tab to "Play", press Space. Nothing happens. | `if (k === ' ' && document.activeElement?.tagName === 'BUTTON') return;` before the Space branch. |
| H8 | `1338` | **Esc does not pause, and there is no pause menu.** Esc only closes the panel, and P shows a bare "Paused" tag (`1327`, `107`). The design language wants P/Esc → pause with Resume / Restart / Settings / Main menu. | Press Esc during play. | See section 3 (pause menu). |
| H9 | `1372` | **No "Main menu" on the end screen, and "Play again" reloads the page.** `location.reload()` re-downloads Three.js and the 12 models (about 1.1 MB, from cache if lucky) and restarts the title orbit. | Lose a game. | Add `resetGame()`: remove tower meshes, clear `G.enemies/towers/queue/arrows/balls/tars/puddles`, reset `G` numbers, `pads[*].tower=null`, hide the overlay. Use it for Again, and `showTitle()` for Main menu. |

### P2 (polish)

| # | Where | What | Fix |
|---|---|---|---|
| H10 | `760-763`, `1110-1126` | Projectile pools have fixed capacities (arrows 220, balls 80, tar 60), but `setMatrixAt(n++)` and `.count = n` are never clamped. Past the capacity, writes past the instance buffer are silently dropped and `count` exceeds the buffer (**unverified** GL behaviour). Unlikely with 13 towers, but endless mode with many towers could get there. | `if (n >= m.instanceMatrix.count) break;` in each loop (the enemies already clamp, `1079`). |
| H11 | `957` (and Godot `battle_sim.gd:57-58, 486`) | Target mode "First" compares `e.d / e.path.len`, a fraction of each road. The two roads have different lengths, so an enemy on the shorter road can be "behind" one that is closer to the gate. | Use `-(e.path.len - e.d)` (remaining distance). Port to both versions so the bot stays comparable. |
| H12 | `1377` vs `147` | With `?auto` the game starts muted (`muted = AUTO`), but the sound button still shows the sound-on icon. | After `applyLang()` set `$('bSound').innerHTML = ico(muted ? 'sound-off' : 'sound-on')`. |
| H13 | `875` | Floating "+gold" text starts at `ENEMIES[type].h + 0.4` without the 1.55-1.75 model scale, so it appears inside the model (the health bars use `h * s`, `1086`). | `ENEMIES[e.type].h * ENEMY_SCALE[e.type] + 0.4`. |
| H14 | `1256-1265` | After a two-finger pinch/rotate, lifting the fingers can select a pad. `down` is overwritten by the second pointer, and the check uses only the pointer that lifts. | Track active pointers in a Set. Ignore `pointerup` if more than one pointer was down during the gesture. |
| H15 | `1327`, `1335`, `1239-1249` | While paused you can still build, upgrade, sell and call waves (the wave starts on unpause, early bonus included). Godot blocks all of this (`main.gd:367-368`). | With the pause menu (section 3) the overlay blocks input. Also return early in `startWave/buildTower/upgradeTower/sellTower` when `G.paused`. |
| H16 | `1471-1475`, `1509` | `?cam=` is overwritten every frame by the title orbit unless `?auto` is set. The README presents it as a general screenshot flag. | Skip the orbit when `camParam` is set, or document "only with ?auto". |
| H17 | `1514-1519` | Models that finish loading after the 15 s timeout are never applied (`applyAssets` has already run). On a slow connection the game keeps procedural models for good. | In `.then` of each model after `assetState.done`, call a per-model apply, or call `applyAssets()` again when `loadAssets()` resolves. |
| H18 | CSS `85`, `110` | Phone: the top bar wraps to two rows (about 95 px, see screenshot), but `#toast` is fixed at `top:70px`, so toasts cover the second row (sound/lang buttons). | Set `--top-h` from `#top.offsetHeight` on resize, and use `top: calc(var(--top-h) + 14px)`. |
| H19 | `1273-1287`, `1271` | `updateHUD()` runs on every kill. It rebuilds `#wavePreview` innerHTML (img tags), runs `makeWave()` + sort for the preview, and `bump()` forces a synchronous reflow (`void el.offsetWidth`). Small, but it is the main DOM cost in busy waves. | Cache the preview per `nextW`, and only re-render when `G.wave`, `G.endless` or the language changes. Restart the animation with `el.animate()` instead of a reflow. |
| H20 | `147-148` | `#bSound` and `#bLang` have no `title` or `aria-label`; `#bPause`/`#bSpeed` have only a key hint. | Add `aria-label` text from `STR` (Sound / Language / Pause / Speed) in `applyLang()`. |
| H21 | `5` | `maximum-scale=1,user-scalable=no` blocks browser zoom (accessibility). | Drop both. The canvas already has `touch-action:none`. |
| H22 | `812` | `G.errors` collects `error` events only. Promise rejections (asset loading, `ac.resume()`) are missed by the test hook. | `addEventListener('unhandledrejection', e => G.errors.push(String(e.reason)))`. |
| H23 | `1487` | `?debug` shows draw calls and triangles, but not fps or the error count the design language asks for. | Add fps (an EMA of `1/dt`) and `G.errors.length` to `dbgEl`. |
| H24 | `239-241` | First-run language is always TR. It ignores `navigator.language`, which the design language says to use. | `lang = stored \|\| (navigator.language \|\| '').toLowerCase().startsWith('tr') ? 'tr' : 'en'`, with `?lang` taking priority. |
| H25 | `1197-1201` | The build cards show `<kbd>1</kbd>` hints and number keys work, but the target mode has no key (Godot uses `T`). | Add `else if (sel?.tower && k === 't')` that cycles the mode. |

**Audio:** every SFX is synthesised and rate-limited (`1401-1406`). There is no music (Godot has a 9/8 Hicaz loop), no volume control, and mute is not saved.
**Save:** `hisar.best` is updated after every cleared wave (`1062`) and on game end (`1365`). Correct.
**Asset loader:** correct fallback for `file://` and `?noassets` (`640`). Per-model failure keeps the procedural model (`666`). Play is disabled while loading (`1349`) with a 15 s timeout.

### Memory and listeners (HTML)

- `applyAssets()` (`672-700`) drops `towerGeoCache` / `headGeoCache` without `dispose()`, and the boats' old merged geometry (`694`) is never disposed. The procedural `fortressMesh` is hidden (`689`) but stays in the scene and on the GPU. This happens once per page, so it is small (a few hundred KB of GPU buffers). Fix: dispose `fortressMesh.geometry` and remove the mesh, dispose old boat geometry, and dispose cached geometries before deleting them (only if no tower still uses them, which is true at that moment since they are all rebuilt).
- Tower meshes reuse cached geometry, and `scene.remove` without dispose is correct here. The trim `Mesh` objects are recreated per upgrade but share cached geometry and `matV`, so nothing leaks.
- All listeners are registered once at start-up. `showTitle`/`endGame` use `onclick =` on fresh nodes, so no duplicate listeners pile up.

### Per-frame hot spots (HTML)

1. Water: a CPU ripple over 1,887 vertices plus a buffer upload every frame (`1147-1152`). Move it to a vertex shader via `onBeforeCompile`, or update every second frame.
2. Particles: the loop visits all 900 slots and uploads position **and colour** buffers every frame, even when idle (`1136-1144`). Track `alive` and skip uploads when 0. Colour only changes in `emit()`, so set `color.needsUpdate` there.
3. Towers are separate meshes: base + head + trim, so 2-3 draw calls per tower and the same again in the shadow pass (`909-925`). With 20 towers that is 40-60 extra calls. The docs report 37-42 calls at 13 towers, so this is fine on UHD 620, but it is the first thing to instance if endless runs get slow.
4. Hover raycast every 60 ms against the instanced pads + every tower mesh (`1464-1469`, `1176`). Fine.
5. `updateHUD()` per kill, see H19.

---

## 2. Dead or unnecessary code (HTML), verified with grep

| Line | Item | Note |
|---|---|---|
| `206`, `228` | String key `level` (TR + EN) | Never read: no `t('level')`, and not built dynamically either. |
| `74` | CSS selector `.kbd` (in `.card kbd, .kbd`) | No element has class `kbd`. Keep `.card kbd`. |
| `25` | CSS variable `--danger` | Never used. |
| `240` | `(params.get('lang') === 'en' ? 'en' : 'tr')` inside the try | Redundant: line 241 overrides it whenever `?lang` exists. Can become `localStorage.getItem('hisar.lang') \|\| 'tr'` (or the navigator default, H24). |
| `179-189` | `icon:` field in every `TOWERS` / `ENEMIES` entry | Always equals the key. Use the key directly (`ico(k)`). Unnecessary rather than dead. |
| `527-555`, `689` | Procedural fortress mesh after a successful GLB load | Hidden but kept. It is the fallback, so keep the builder, but dispose and remove it once the GLB is in. |
| `assets/ui/icons/fortress.png` | Unused asset (also noted in `docs/assets.md`) | Use it as the HUD logo fallback or the "lives" tooltip, or delete it. |

No unused functions found: `smoothstep`, `lerp`, `Sph`, `sized`, `fmt`, `refreshPanel`, `hideRing` and the others all have callers.

---

## 3. Design-language gaps (HTML) and plan

| Requirement | Status | Plan (about 1 hour in total for the core) |
|---|---|---|
| Loading "n/N", Play disabled | **Done** (`670`, `1349`) | – |
| Title: crest, name, subtitle, how-to, Play, language, best | **Done** | – |
| Title: **Continue** | Missing | Save `{wave, gold, lives, endless, kills, goldEarned, built, towers:[{pad, type, level, mode, spent, kills}]}` to `arena.hisar.save` after each cleared wave (same shape as Godot `to_snapshot`, `battle_sim.gd:602-609`). Clear it on game end. On the title, show "Continue · Wave n+1" when it exists. Restore by calling a `buildTower`-like function without paying, then set `level` and `makeTowerMesh`. |
| Title: **Settings** | Missing | One settings card, also reachable from pause: Master / Music / Effects sliders (music only applies once music exists; otherwise show it disabled or add a short loop), Language TR/EN, Quality Low/High (Low = what `?low` does now; needs a reload or toggling shadows + `PMAX`), Fullscreen (`document.documentElement.requestFullscreen()`). Wire `master.gain.value = 0.32 * master`. Add a separate SFX gain node between `tone/noise` and `master`. |
| Title footer "Claude Game Arena · built by Claude Opus 5.5" linking to the arena page | Missing | `<a class="foot" href="https://furkiozknn.github.io/claude-game-arena/">Claude Game Arena · built by Claude Opus 5.5</a>` in `showTitle()`, 11 px, 55 % opacity. |
| HUD: logo + name left, stats middle, icon buttons right (speed, pause, sound, language) | **Done**. Speed is text "1×", which is fine. | – |
| Pause: Resume, Restart, Settings, Main menu, dimmed and blurred backdrop | Missing (only a "Paused" tag) | Reuse `#overlay` with `backdrop-filter: blur(4px)` and a `pause` card. P/Esc toggle it. Esc first closes an open panel (like Godot). |
| Settings saved: `arena.hisar.settings` `{master, music, sfx, lang, quality}` | Missing (`hisar.lang` only, mute not saved) | Add `loadSettings()` / `saveSettings()` with try/catch. Read `hisar.lang` / `hisar.best` once for migration. Move best to `arena.hisar.best`. |
| End: title, 2-4 stats, **new-record highlight**, Play again, **Main menu**, Endless | Partly: no record highlight, no Main menu, Again reloads | Compute `isRecord = reached > loadBest()` before `saveBest`, then show a pulsing "New best!". Add Main menu and a 4th stat "Wave reached". See H9 for the in-place restart. |
| Toasts with `good` / `bad` / `info` variants | One style only | `toast(msg, kind='info')` adds a class. `good` (cleared, built, sold) gets a green left border, `bad` (noGold, ramComing, life lost) red, `info` neutral. |
| Keys: P/Esc pause, M music, X sound, L language, F speed (kept), F11 browser | P only; no Esc pause, M, X or L | Add `m` (music, once it exists), `x` → `$('bSound').click()`, `l` → `$('bLang').click()`, `escape` → close panel, otherwise toggle pause. |
| Visible focus ring | Browser default only (nothing removes it). No styled ring; Space is hijacked (H7). | `button:focus-visible { outline: 3px solid var(--accent); outline-offset: 2px; }` and the H7 fix. |
| 44 px touch targets | Missing (H6) | See H6. |
| Hooks `?auto ?debug ?sim ?low ?lang ?noassets`, `window.hisar` | All present. `?sim` needs `?auto`; `?debug` has no fps or errors (H23). | Allow `?sim` without `?auto` (run `update` only), and add fps/errors to the debug line. |
| Language default from the browser | Missing (H24) | – |
| Quality default Low on phones | Missing (only `?low`) | `quality = matchMedia('(pointer:coarse)').matches ? 'low' : 'high'` on first run. |

---

## 4. Godot bugs (from reading the code)

### P0

None found. The rules match the HTML (wave rules in `data/waves.tres` reproduce `makeWave` exactly; bonuses, armour, splash falloff, tar dot/slow and puddles are identical). The fixed-step sim is sound, and the save snapshot is written between waves only.

### P1

| # | Where | What is wrong | Repro | Fix |
|---|---|---|---|---|
| G1 | `scripts/main.gd:234-242`, `scripts/autoload/game_state.gd:72-77` | **Best wave is only recorded at game end.** Leaving through Pause → Main menu or closing the window never updates `best_wave`, although the run snapshot is saved after every wave (`main.gd:218-222`). HTML saves the best on every clear (`index.html:1062`). | Clear 8 waves (best was 3), then Main menu. The title still shows best 3. | In `_on_wave_cleared` call `GameState.record_wave(sim.wave)` (it already writes the file only when the record changes). Keep the end-of-game call for the new-best banner. |
| G2 | `scripts/main.gd:444-451`, `project.godot` `pause_menu` = Esc **and** P | **P does not pause while a pad panel is open.** It closes the panel instead, because both keys share one action and the panel check comes first. The design language says P pauses and Esc goes back. | Select a pad, press P. The panel closes and the game keeps running. | Split into `pause` (P, Start) and `back` (Esc, B). `back` closes the panel, then settings, then toggles pause; `pause` always toggles. |
| G3 | `scripts/ui/ui.gd:218`, `275`, `280`, `655`, `789`, scale `370-377` | **Touch targets under 44 px on phones.** HUD buttons are 36 px, tower buttons 34 px, the panel close button 32x30, and the whole UI is scaled by `s.x/430` in portrait (0.91 on a 390 px phone): about 33 / 31 / 27 px. | Portrait phone, 390x844. | When `DisplayServer.is_touchscreen_available()`, use `custom_minimum_size.y = 44 / _scale` for HUD, panel and close buttons (or a fixed 48 and accept a slightly larger panel). |

### P2

| # | Where | What | Fix |
|---|---|---|---|
| G4 | `scripts/ui/ui.gd:610`, `764-771` | The tower panel's "Kills" value is stale. The panel key is `uid_level_mode`, so it is not rebuilt when kills change, and `_update_affordability` only touches buttons. | Keep a reference to the kills label and update it in `_process` when `sim.kills` changes. |
| G5 | `scripts/main.gd:315-316` | The mute button sets master to 0, and unmute always restores 0.8, losing the user's setting. There are no M (music) / X (sfx) keys. | Store `_master_before_mute`. Add actions `toggle_music` (M) and `toggle_sfx` (X) that flip the bus mutes, saved in settings. |
| G6 | `scripts/autoload/settings.gd:183-202`, `scripts/ui/ui.gd:951-955` | Dragging a volume slider writes `user://settings.cfg` on every 0.05 step (and plays a coin each step). On the web that is an IndexedDB write per step. | Apply volumes live and save on `drag_ended` / on leaving the screen (a `save_settings()` call in `_back_from_settings`). |
| G7 | `scripts/main.gd:284-292`, `scripts/ui/ui.gd:809-833` | Every Low/High, TR/EN, On/Off click rebuilds the whole settings card, replays the 0.93→1 scale-in, and moves focus back to the first slider. With a gamepad or keyboard, focus jumps away after each choice. | Update the choice buttons' `theme_type_variation` in place instead of `show_screen("settings")`, or remember the focused control and skip the tween when `screen` is unchanged. |
| G8 | `scripts/autoload/settings.gd:135-136` | First run is always TR / High. The design language says use the OS locale (`OS.get_locale_language() == "tr"`), and Low on web/phones (`OS.has_feature("web")` or a mobile check). | Set the defaults in `_ready()` before `load_settings()`. |
| G9 | `scripts/autoload/sound.gd:367-417` | About 14 s of music (317 k samples, 64 plucks, drone with a wavetable) is rendered in GDScript on the main thread two frames after start. On the web this is likely a visible freeze of the title (**unverified**: duration not measured). | Use `WorkerThreadPool.add_task` on desktop. On the web (no threads in this export), render one bar per frame, or ship the two loops as baked `.wav`/`.ogg` resources generated once by a tool script. |
| G10 | `scripts/main.gd:124-125` | When continuing, the toast reuses the button label: "Continue · Wave 6", which reads like a button. | Add a string `continued`: "Wave {n} ahead · run restored" / "Dalga {n} seni bekliyor". |
| G11 | `scripts/main.gd:85-93`, `300-301` | Restart (and Play) leaves the previous run's snapshot in the save until the next wave is cleared. If you restart and quit at once, Title → Continue resumes the abandoned run. Continue also counts as a new game (`count_game`). Quitting mid-wave and pressing Continue replays the wave from the last clear (a save-scum route; it may be intended). | Call `GameState.clear_run()` in `new_game()` when `snapshot == null`. Only `count_game()` for fresh games. |
| G12 | `scripts/core/battle_sim.gd:57-58`, `486` | "First" targeting uses a fraction of each road (same as H11). | Use remaining distance. |
| G13 | `scripts/main.gd:489-505`, `project.godot` `emulate_mouse_from_touch=true` | After a pinch/twist, the emulated mouse release of finger 0 can select a pad when finger 0 barely moved. | Ignore the release if `cam._touches.size()` reached 2 since the press (expose a `gesture_seen` flag from `CameraRig`). |
| G14 | `scripts/core/auto_bot.gd:152-157` | The Godot bot switches cannons to "Strongest" while a ram is out; the HTML bot never changes modes. The two bots' results are not comparable (README: Godot LOSS at 15/15, HTML falls on 15). | Either port the mode switch to the HTML bot or remove it here, so the parity check means something. |
| G15 | `data/strings.tres:26`, `113`; `README.md` licence line | "Everything is generated in code ... no third-party assets" becomes false once the GLB/PNG assets are ported (section 5). | Update both, and the credits string. |
| G16 | `scripts/ui/ui.gd:196-204` | Icon buttons pad the label with six spaces to make room for a child Icon. This breaks with other fonts or sizes. | Use `Button.icon` (a Texture2D) once the PNG icons are ported, or put an `HBoxContainer` inside the button. |
| G17 | `scripts/main.gd:356-363` | `scaling_3d_scale = 0.75` on Low: **unverified** that the Compatibility renderer honours 3D scaling in 4.7 (it used to be Forward+/Mobile only). | Check in the editor. If ignored, use `get_window().content_scale_factor` or skip it. |
| G18 | `scripts/ui/ui.gd:419-428` | When the UI scale is clamped at 0.6 (landscape windows narrower than about 690 px), the logical width falls between 760 and 1150, and the centred panel (`min(580, v.x-300)`) can overlap the 260 px wave box, the same overlap as H3. Rare. | `w = minf(580, v.x - 2 * 270)`, falling back to left-aligned. |

### Dead code (Godot), verified with grep

`TowerData.icon_color` (`scripts/data/tower_data.gd:8`, set in all three tower `.tres`, never read); `Loc.has_key()` (`scripts/autoload/loc.gd:30`,
no callers, tests included); `AutoBot.auto_endless` (`scripts/core/auto_bot.gd:13`); `Sound.music_ready` (`scripts/autoload/sound.gd:16`, written only);
`MapLayout.GATE` (`scripts/core/map_layout.gd:10`); `Ui.speed` (`scripts/ui/ui.gd:19`, written in `set_speed`, never read);
`CameraRig.input_enabled` (`scripts/view/camera_rig.gd:18`, never set to false); `GameState.games_played` (saved, never shown);
string key `level` (`data/strings.tres:40`, `127`: no `Loc.t("level")` anywhere).

---

## 5. Parity table: HTML vs Godot

| Feature / content | HTML | Godot | Better | Port direction / action |
|---|---|---|---|---|
| Rules, numbers, waves, bonuses | yes | yes, data-driven `.tres` | equal (Godot cleaner) | – |
| 15-wave cap on wave calls | **bug H1** | correct | Godot | fix HTML |
| Endless mode | yes | yes | equal | – |
| Generated GLB models (12) | **yes** | no (procedural only) | HTML | **HTML → Godot** (details below) |
| Painted icon PNGs (16) | **yes** | vector `Icon._draw` | HTML | **HTML → Godot** |
| Logo crest / favicon | **yes** | text "Hisar", `icon.svg` | HTML | **HTML → Godot** |
| Font | Rubik (Google Fonts) | fallback font + embolden | HTML | Ship `Rubik-Regular/SemiBold/ExtraBold.ttf` (OFL) in `res://fonts`, use them in `Ui.bold_font()` and the theme |
| Music | none | 9/8 Hicaz loop, drums fade in during waves | Godot | Godot → HTML: port `MELODY`/`BASS` to Web Audio (pluck = short decaying triangle; drums = existing `tone/noise`), schedule with a look-ahead timer |
| SFX | synthesised | same synths + `upgrade`, `boss` | Godot | add `upgrade` and `boss` to HTML `sfx()` |
| Settings (volumes, language, quality, fullscreen) | none | yes, saved | Godot | Godot → HTML (section 3) |
| Pause menu | tag only | Resume / Settings / Restart / Main menu | Godot | Godot → HTML |
| Continue a run | no | yes (`user://hisar_save.cfg`) | Godot | Godot → HTML (same snapshot shape) |
| End screen | 3 stats, Again (reload), Endless | 4 stats, new-best pulse, Again, Endless, Main menu, fireworks / blaze | Godot | Godot → HTML |
| Boss health bar | no | yes | Godot | Godot → HTML (small top-centre bar when `G.enemies.some(e => e.type === 'ram')`) |
| Falling corpses, damage vignette, wave-start toast, upgrade toast | flash only | yes | Godot | Godot → HTML (corpses: reuse the enemy InstancedMesh with a "dying" list that tips and sinks for 1.2 s) |
| Waving flags (AnimationPlayer), well/crates/awning, road verges | no | yes | Godot | optional HTML |
| Level-2 pennant / level-3 gold band on towers | yes (`628-636` on GLB) | yes (procedural) | equal | keep when porting GLB towers to Godot |
| Portrait camera | **no (H5)** | yes | Godot | Godot → HTML |
| Responsive UI scaling | CSS breakpoints | whole-UI scale + compact layout | Godot | – |
| Gamepad, keyboard camera (arrows/QE/+-), Tab pad cycling, T target mode | no | yes | Godot | add T and arrow-key pan to HTML (cheap) |
| Hover range preview on build cards | yes | yes | equal | – |
| Loading screen n/N | yes | not needed (no async assets) | – | once GLBs are imported they load synchronously with the scene; no loader needed |
| Test hooks | `?auto ?sim ?debug ?low ?lang ?noassets ?cam`, `window.hisar`, `hisarSim()` | `--auto --sim --speed --shot --cam --lang --low --no-save --quit-on-end`, `get_state_text()`, 276 tests | Godot | – |
| Best record | per cleared wave | end of game only (G1) | HTML | fix Godot |
| Toast variants | none | none | – | both |
| Footer "Claude Game Arena · built by …" | no | credits line (different text) | – | both: use the shared footer text |
| Title text | `<title>Hisar · Kale Savunması` / `Hisar · Fortress Defense` (`1318`), Play "Başla ▶"/"Play ▶", wave button "Başlat"/"Start" before the game | window title "Hisar", Play button with a play icon, wave button "-" before the game | HTML | set `get_window().title = "Hisar · " + Loc.t("sub")` on language change, and use `Loc.t("startIdle")`-style text instead of "-" (`ui.gd:517`) |

### What Godot needs to use the HTML assets

**Files to copy** (from `kale-savunmasi/assets/`) into `hisar-godot/assets/`: `models/*.glb` (12), `ui/icons/*.png` (16), `ui/logo.png`, `ui/favicon.png`.

**GLB facts (read from the files):** each file has one mesh, one node, and one material with `baseColorTexture` + metallic/roughness factors.
Each is **normalised to a unit box** (largest side = 1) with the node translated so the base sits at y = 0. All use and require
**`EXT_texture_webp`**. Godot 4.x has a built-in WebP glTF extension, but check the first import for "texture missing" warnings (**unverified** for 4.7.2).

**Import settings** (`.glb.import` per file, or once in the Import dock): Root type `Node3D`; Meshes → *Ensure Tangents* off,
*Generate LODs* off, *Create Shadow Meshes* on; Materials → *Extract* off (materials are replaced in code, see below); Animation off.
For the web export, keep `vram_compression/import_etc2_astc=true` (already set), or set the textures to *Lossless*. **Unverified**
whether WebP-in-GLB is re-encoded to VRAM-compressed formats.

**Loading in code** (suggested `Models.glb(name)`): `var scene := load("res://assets/models/%s.glb" % name) as PackedScene` →
`instantiate()` → find the first `MeshInstance3D` → take `mesh` and the albedo texture from `mesh.surface_get_material(0)` → `free()` the instance.
Then build a flat-shaded copy so the faceted look matches `flatShading:true` in Three.js:
`SurfaceTool.create_from(mesh, 0)` → `deindex()` → `generate_normals()` (de-indexed vertices give per-face normals) → apply the transform below with
`SurfaceTool`/`MeshDataTool` or `ArrayMesh` arrays → `commit()`. Cache it in `Models._cache` like the procedural meshes, and fall back to
the procedural builder when `ResourceLoader.exists()` is false (keep the fallback, as the design language asks).

**Material** (one per model, shared across levels and instances): `StandardMaterial3D` with `albedo_texture = <glb texture>`,
`vertex_color_use_as_albedo = true` (so MultiMesh instance colours still tint flash red / slow blue: `battle_view.gd:345-352` relies on it),
`roughness = 1.0`, `metallic = 0.0`, `metallic_specular = 0.25` (the Tripo materials carry metallic factors that look plasticky under
Godot's PBR), `texture_filter = TEXTURE_FILTER_LINEAR_WITH_MIPMAPS`. MultiMesh colours above 1.0 (the flash uses 1.8) need `use_colors`, which is already on.

**Transforms recorded in `index.html`** (both engines are right-handed, Y up, models face +Z, so the numbers carry over 1:1):

| Model | Yaw (rotate Y) | Size / placement |
|---|---|---|
| raider | -π/2 | enemy rule (below) |
| rider | π | enemy rule |
| shield | -π/2 | enemy rule |
| ram | 0 | enemy rule |
| fortress | π | uniform scale **14**, position `x = 25 + size.x*14/2 - 0.3`, y 0, z 0 (gate wall on x = 25). Hide the procedural `Fortress` mesh (`world.gd:306-310`). The HTML keeps no procedural flags on the GLB fortress, so either drop `_flags` or re-place them on the GLB towers (**unverified** heights). |
| boat | 0 | uniform scale so the largest side is **3.6** (the mast height), then y -0.3 (`index.html:693`). Same bob/rotation code as `world.gd:49-57`. |
| tower-archer | 0 | per level height **h = [5, 5.8, 6.6]**, footprint **w = 3.0**·(1+0.06·L), non-uniform scale `(w/max(sx,sz), h/sy, w/max(sx,sz))`; head mount at **0.49·h** |
| tower-cannon | 0 | h **[1.7, 2.2, 2.7]**, w **3.6**, head mount **0.77·h** |
| tower-tar | 0 | h **[2.4, 3.1, 3.8]**, w **2.4**, head mount **0.86·h** |
| head-archer | -π/2 | uniform, largest side **1.3**·(1+0.07·L) |
| head-cannon | -π/2 | largest side **1.5**·(1+0.07·L) |
| head-tar | 0 | largest side **1.2**·(1+0.07·L) |

- **Enemy rule** (`index.html:678-682`): scale the unit model so its height equals the procedural model's height, but never more than 1.15× its length:
  `s = min(proc.y / glb.y, proc.z / glb.z * 1.15)`, using the AABB of `Models.enemy(type)` (the procedural mesh). The instance scale
  `model_scale` (1.6 / 1.55 / 1.75 / 1.7, already in `data/enemies/*.tres`) is applied on top, as now.
  `_corpse()` (`battle_view.gd:256-274`) uses `Models.enemy()` directly, so it picks up the GLB automatically.
- **Tower trims** (`index.html:628-636`): level ≥ 1 adds a pennant pole (cyl r 0.035, h 1.3) + accent flag at the top (archer at x 0, top h-0.15;
  others at 0.62 × the model radius in the top 20 %); level 2 adds an accent torus (archer/cannon) or a square band (tar) at 32 % / 45 % height,
  sized to the model radius there. Rebuild these with `MeshKit` and merge them into the base mesh, so it stays one `MeshInstance3D` per tower part.
- **Head mount vs sim muzzle:** the sim's muzzle uses `TowerData.pivot` (`battle_sim.gd:308-310`; archer 3.2/4/4.8, cannon 1.48/1.98/2.48, tar 1.7/2.4/3.1).
  The GLB mounts are archer 2.45/2.84/3.23, cannon 1.31/1.69/2.08, tar 2.06/2.67/3.27. To keep the tests and the balance unchanged, add a
  **visual-only** `head_mount` (computed in `Models`, used in `BattleView._draw_towers`, `battle_view.gd:370-374`) and leave `pivot` alone.
  The HTML did change its muzzle height (`index.html:963` uses the mesh pivot), so the two versions differ slightly here. Note it in the README.
- `_pick_pad` (`main.gd:529-531`) uses `pivot + 1.2` as the tower's pick height. Archer GLB towers reach 6.6 + 1.3 head, so use the visual height.

**Icons:** map `assets/ui/icons/<name>.png` onto the `Icon` kinds: gold, lives, wave, archer, cannon, tar, raider, rider, shield, ram, target, trophy,
`sound`→`sound-on`, `mute`→`sound-off`, plus the new `upgrade` (the Godot upgrade button has no icon yet). Keep the vector drawings for the kinds with no PNG
(pause, play, speed, close, fire, gear). Simplest change: in `Icon._draw()` do `if _tex: draw_texture_rect(_tex, Rect2(o, Vector2(s, s)), false)`,
with `_tex` loaded from a `const PNG := {...}` map when `kind` is set. Import: Filter **Linear**, **Mipmaps on** (the UI scales 0.6-2.5×, and the 96 px source covers 48 px at 2×).
`fortress.png` can replace the `fire` icon on the defeat card.

**Logo / favicon:** `logo.png` (256 px) → a `TextureRect` above "Hisar" on the title card (about 132 px, like `index.html:1348`) and
on the end card (trophy icon on win, crest on loss), plus 30 px in the HUD stats panel before the "Hisar" label (`ui.gd:252`).
Set `config/icon="res://assets/ui/logo.png"` in `project.godot`. The web export (`html/export_icon=true`) then uses it as the favicon.
`favicon.png` (64 px) is not needed in Godot.

**HTML title/UI changes to mirror:** the window/document title `Hisar · <sub>`; the wave button reads Start/Başlat before the first wave instead of "-"
(`ui.gd:517`); the pause/play glyph (Godot already draws it); icons in the wave preview chips, build cards and tower panel header (Godot already
has slots for them).

---

## 6. Redesign ideas, ranked by impact per effort (each fits in about 1 hour per version)

1. **Godot: port the GLB models, icons and logo** (section 5). Biggest visual jump, about 1 h. It also makes the two versions look like one game.
2. **HTML: pause menu + settings card + footer + Esc/M/X/L keys** (section 3). It closes most design-language gaps with one overlay card template, about 1 h.
3. **HTML: fix H1-H3, H5, H6, H7** (wave cap, panel click loss, panel overlap, portrait camera, 44 px targets, Space on buttons). About 45 min, and it removes the bugs players actually hit.
4. **Both: toast variants + new-best moment.** Green/red/neutral toasts, a "New best!" pulse on the end card (HTML) and on the wave-clear toast when a record is set mid-run (both). About 20 min.
5. **Both: wave-start banner.** A large centred "Dalga 7" / "Wave 7" with the enemy icons from the preview, sliding in and out over 1.2 s (the boss wave in red with the ram icon). Cheap and gives each wave a beat. About 30 min.
6. **HTML: music.** Port Godot's 9/8 Hicaz loop (calm stem always, drums during waves) to Web Audio, with a music volume setting. About 1 h. Gives the HTML the "Ottoman siege" mood the Godot version has.
7. **Both: range-ring readability.** Show the range disc of every tower faintly while a pad is selected, and colour the selected ring by tower type (archer blue, cannon grey, tar orange). Helps planning. About 20 min.
8. **Godot: Rubik font.** About 15 min, and the title and HUD then match the HTML typography.
9. **HTML: in-place restart and Main menu** (H9) instead of a page reload. About 30 min. Faster retries matter for a game that ends on wave 15.
10. **Both: "First" targeting by remaining distance** (H11/G12) plus the same bot in both versions (G14), so the balance comparison is fair. About 15 min.
11. **HTML: performance tidy-up.** Water ripple in a shader, skip idle particle uploads, cache the wave preview. About 40 min; buys headroom for endless mode on UHD 620.
12. **Godot: phone pass.** 44 px targets (G3), separate P/Esc (G2), Low quality default on web/mobile (G8), and music rendered incrementally on the web (G9). About 1 h.
