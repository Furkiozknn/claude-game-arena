# Review: Çay Ocağı (HTML + Godot 4)

Static code review only: nothing was run (no Chrome, Godot or server). Line numbers are for the current working tree:
`cay-ocagi/index.html` **with** the uncommitted remaster diff, `cay-ocagi-godot` at `6ee377b` (clean tree).
"Unverified" means it follows from reading the code or doing the arithmetic, but nobody has looked at it running.

Repos:
- HTML: `D:\Claude Projeleri Master\cay-ocagi` (last commit `0429527`, plus an uncommitted remaster)
- Godot: `D:\Claude Projeleri Master\cay-ocagi-godot` (`6ee377b`, nothing uncommitted)

---

## 0. State of the interrupted remaster (HTML)

### 0.1 What is on disk (all untracked, not committed)

| Asset | File | Size | Tris (GLB JSON) | Raw bbox (x · y · z) | Integrated |
|---|---|---|---|---|---|
| semaver | `assets/models/semaver.glb` | 75 KB | 1,386 | .74 · 1.0 · .71 | yes |
| oven | `assets/models/oven.glb` | 62 KB | 1,298 | 1.0 · .96 · .98 | yes |
| coffee | `assets/models/coffee.glb` | 75 KB | 1,410 | 1.0 · .46 · 1.0 (box sits diagonally) | yes |
| ayran | `assets/models/ayran.glb` | 90 KB | 1,398 | .42 · 1.0 · .52 | yes |
| sink | `assets/models/sink.glb` | 83 KB | 1,218 | 1.0 · .81 · .52 | yes |
| table | `assets/models/table.glb` | 45 KB | 899 | 1.0 · .87 · 1.0 | yes (replaces tops + legs) |
| window | `assets/models/window.glb` | 58 KB | 882 | .38 · 1.0 · .92 | yes (InstancedMesh ×5) |
| ferry | `assets/models/ferry.glb` | 116 KB | 1,822 | .30 · .34 · 1.0 | yes |
| cat | `assets/models/cat.glb` | 48 KB | 948 | .99 · 1.0 · .46 | yes |
| cobblestone | `assets/textures/cobblestone.webp` | 34 KB | n/a | n/a | yes (one plane) |
| 20 icons | `assets/ui/icons/*.png` (tea … stool) | 5-8 KB each | n/a | n/a | yes, all 20 |
| logo | `assets/ui/logo.png` (256 px) | 32 KB | n/a | n/a | yes (title, top bar) |
| favicon | `assets/ui/favicon.png` | 12 KB | n/a | n/a | yes (swapped at runtime) |
| doc | `docs/assets.md` | 11 KB | n/a | n/a | n/a |

Every GLB is 1 node, 1 mesh, 1 primitive, an `EXT_texture_webp` texture, normalised so the **largest** dimension
is 1 (not the height), with the pivot at the base (node translation `y = +half height`). Total is about 0.86 MB.

### 0.2 How it is integrated (`index.html`)

- **Flags** (218-222): `NOASSETS = ?noassets`, `USE_MODELS = !NOASSETS && protocol !== 'file:'`,
  `assetState = {done, loaded, total}`.
- **Icons** (271-281): when `!NOASSETS`, `ICON[k]` is replaced by `<svg viewBox="0 0 24 24"><image href=…png>` for
  the 20 names. `starOff` = the star PNG with `filter:grayscale(1);opacity:.3`; `ICON.tulip` (top-bar logo) =
  `logo.png`; the favicon `<link>` is swapped to `favicon.png`. `LOGO_BIG` (281) is an `<img class="biglogo">` on the
  title card. Icons and the logo also load from `file://`. Only `?noassets` brings back the SVGs.
- **Loader** (2045-2085): a dynamic `import('three/addons/loaders/GLTFLoader.js')`, then for each model
  `loadAsync → flatten all meshes into one non-indexed BufferGeometry (position + uv, node matrices baked) →
  rotateY(MODEL_YAW) → recentre x/z, base to y=0 → computeVertexNormals → MeshLambertMaterial({map, flatShading})`.
  Each model or texture that settles calls `tick()`, which re-renders the title card ("Loading… n/10").
- **Boot** (2223-2228): `Promise.race([loadAssets(), 15 s timeout]) → applyAssets() → assetState.done = true`.
  Play is disabled until then (1923, Space is guarded at 1981). `?auto` ignores this (the bot calls `A.start()`
  directly at 956), so the models swap in mid-run.
- **applyAssets()** (2092-2150): rebuilds the merged world with `buildWorld(skip)` (1174) without the replaced parts,
  then places each model. These are the transforms the Godot port must copy:

| Model | Yaw (`MODEL_YAW`, 2046) | Scale | Position | Notes |
|---|---|---|---|---|
| semaver | 0 | uniform `2.0 / size.y` (= 2.0) | `(CNT_X, 1.12, -5.05)`, second copy at z `-3.85` (hidden until the kettle upgrade) | `mat.color.setScalar(1.2)`; `FIT.teaSteamY = 1.12 + h + .05` |
| oven | +π/2 | uniform `1.6 / size.x` (about 1.63) | `(CNT_X, 1.12, STATION_Z.simit)` | smoke = centroid of the top 10 % of vertices (`topSpot`); rings at `TOP + .87h`, x `CNT_X+.15`; glow box moved to `(CNT_X-.03sc, TOP+.32sc, zc-.045sc)`, scale `(1, .24sc/.62, .33sc/.82)` |
| coffee | +π/4 | uniform `1.65 / size.x` (after the yaw) | `(CNT_X, 1.12, STATION_Z.coffee)` | pots `[CNT_X+.1sc, TOP+.34sc, zc-.26sc]` and `[…, zc+.31sc]`; steam dy `.15` |
| ayran | 0 | `(2.5, 1.8/size.y, 2.5)` (absolute x/z) | `(CNT_X+.2, 1.12, STATION_Z.ayran)` | gives 1.04 × 1.8 × 1.3 m |
| sink | +π/2 | uniform `1.55 / size.z` (= 1.55) | `(CNT_X+.3, 1.12, STATION_Z.sink)` | gives .81 × 1.26 × 1.55 m, so a 1.26 m cabinet stands on the counter (unverified visually) |
| window | 0 | uniform `1.05 / size.y` | `(-8.1 + halfDepth - .04, 5.2, -7 + i·3.25)`, i = 0..4 | one InstancedMesh |
| table | 0 | `(1.8/sx, .98/sy, 1.8/sz)`, then geometry `translate(0,-.93,0)` | instance origin stays at `(x, .93, z)`, so the base is on the floor and the top at .98 | replaces `TB.tops` geometry+material (instanceColor cloth tint kept), `TB.legs.visible=false` |
| ferry | +π/2 | uniform `8 / size.x` | child mesh of `ferryObj`, geometry `translate(0,-.55,0)` | the bow faces +X (direction of travel) |
| cat | 0 | uniform `.85 / size.x` | child mesh of `catGrp` (yaw `face - π/2` per frame) | the sleep squash/bob still applies |
| ground | n/a | `PlaneGeometry(31.5, 23)`, `repeat(6.3, 4.6)` (one tile per 5 m) | centre `(1.75, .015, 2.5)` | replaces the 713 tile quads |

- **Served/carried items** (`ITM`, 1384-1414): new procedural per-item InstancedMeshes (tea glass, used glass, simit
  plate, crumb plate, coffee cup, ayran cup), shared by the tray, the tables and the apprentice. They replace the old
  `trayIM`, `TB.glass` and `TB.plate`, and they are also used without assets. This change is code, not assets.
- **Game-over button**: the known bug is **fixed**. `data-a="retry"` now shows `t('retry')` (1954). See H-P2-1 for the
  remaining label mismatch.

### 0.3 Half-done or inconsistent

1. **README references two screenshots that do not exist**: `docs/remaster-closeup.png` and
   `docs/remaster-title.png` (README.md:98). `docs/` has no `remaster-*` file, so both images render broken.
   The brief also asked for 2-3 new screenshots.
2. **The verification is not on disk.** `docs/assets.md` → "Verification: See the final section of the remaster
   report in the arena repo". No such report exists (the only `remaster` mentions in claude-game-arena are the
   prompts). The numbers given there (28-30 draw calls, 47-48 k tris, 60 fps, bench 9/12, `file://` with no console
   messages) are **unverified**. The README's "about 30 draw calls" comes from the same claim.
3. **The title card re-animates once per loaded asset.** `tick()` (2055) → `uiScreen()` → the signature contains
   `assetState.loaded` (1914), so `scrEl.innerHTML` is rebuilt about 10 times. Each rebuild replays the `.card`
   `cin` animation (113-114), so the card "pops" ~10× while loading and loses hover/focus. Fix: patch only the Play
   button text and `disabled`, e.g. `$('[data-a=start]')`, while state is title.
4. **Icons have no fallback.** If `assets/ui/icons/*.png` is missing (e.g. index.html is pushed without the
   untracked `assets/` folder, or a 404), every icon becomes an empty SVG. The comment at 272 says `<image>` also
   loads from `file://`, which is true, but nothing handles a missing file. Fix: preload the 20 PNGs with `new Image()`
   inside `loadAssets` (count them in n/N) and only swap `ICON[k]` once they have all decoded. **Commit `assets/` in
   the same commit as `index.html`.**
5. **Logo in the 26 px top bar** (`ICON.tulip = logo.png`, 278; CSS 34): the logo is a detailed round scene
   (mosque, ferry, glass). At 26 px it will read as a brown/orange disc (unverified visually). Use a simpler mark for
   the top bar (the tea icon PNG, or a cropped glass from the logo).
6. **The spilled-coffee puddle may be hidden.** Foam spilled y = `py - .5` (1629), with `py = TOP + .34·sc`
   (2127). If `sc < 1.47` the puddle sits below the counter top (1.12) and cannot be seen. `sc = 1.65/size.x` after
   the 45° yaw, which cannot be known without loading the model. **Unverified.** Fix: give the spilled state its own
   anchor, `y = TOP + sand height + .02`.
7. **Model-unit magic numbers.** The oven glow (2121) and the coffee pots (2127) use constants measured in raw model
   units. They are right for these exact GLBs (raw height ≈ 1, checked from the bbox), but they break silently if a
   model is regenerated. Note this in `docs/assets.md`.
8. **Small leaks on swap**: the old `DYN.kettleB` mesh (geometry), the old `TB.tops` material, and the old
   ferry/cat geometries are removed from the scene or replaced but never `dispose()`d (2110, 2140, 2142, 2143).
   Harmless (once), but easy to fix.
9. `G.assetsReady` (2226) is write-only (fine as a test hook, but not documented).
10. `og:image` (index.html:10) still points to the pre-remaster `busy_d6_en.png`.
11. **docs/assets.md vs reality**: the asset table, prompts, paths, sizes, tri counts (they match the GLB JSON),
    integration notes, the `n/10` count, the tool scripts (`front.mjs`, `top.mjs`, `pots.mjs`, `fps-cay.mjs`,
    `shot.ps1`, `slice-cay.cjs`: all present in `claude-game-arena/tools/assets`) and the credits (55.75) are
    consistent with the code. The only mismatches are items 1-2 above (missing screenshots, missing verification).
    "Used but missing" files: none. "Loaded but unused" files: none.

### 0.4 Exact list to finish the remaster

1. Fix 0.3-3 (title flicker) and 0.3-4 (icon preload, plus PNGs in the n/N count). These are about 20 lines.
2. Fix 0.3-6 (spilled anchor) and 0.3-5 (top-bar mark). Optionally do 0.3-8 (dispose).
3. When RAM allows, run one heavy process at a time:
   - `?auto&debug` to victory with zero errors, recording draw calls and fps;
   - `file://` (procedural models, PNG icons) and `?noassets` (everything original);
   - the phone layout at 390 px;
   - close-ups of the oven glow (baking), the coffee foam (cook, ready, spilled), the simit rings on the oven and
     the second semaver.
4. Save `docs/remaster-closeup.png`, `docs/remaster-title.png` (and a phone shot). Otherwise drop the README table
   at 96-98.
5. Replace the "Verification" section of `docs/assets.md` with the real numbers. Optionally update `og:image`.
6. Commit in the cay-ocagi repo (not done yet): `assets/`, `docs/assets.md`, `index.html`, `README.md`, the
   screenshots. Suggested split: `feat: generated models, icons and ground texture with procedural fallback`,
   `feat: per-item served/carried models`, `fix: game-over retry label`, `docs: asset remaster notes`.
7. The Godot port (section 5.3).

---

## 1. HTML bugs and broken features

### P0 (broken, crash or wrong rule)

None found that crash or block normal play.

### P1 (clearly wrong or missing)

- **H-P1-1 · Parties that are eating when the day ends are never paid.** `simStep` → `endDay()` at
  `G.clock >= G.dayLen` (868). `endDay` (568-569) frees every party; `payParty` only runs when the `eat` timer runs
  out (692-694). Spawning stops at 160 s, so the last served tables (eat 3-6.5 s) regularly lose their payment and
  tip, and a fully served customer is simply dropped. **Repro:** serve a full order at ~2:57 left → 0:00 → summary
  without those coins. **Fix:** in `endDay` before freeing, `for (const p of G.parties) if (p.state === 'eat')
  payParty(p)`. Godot has the same bug (G-P1-3); fix both so the bench stays comparable.
- **H-P1-2 · No way back to the main menu, and no restart, during a day.** The only `data-a="menu"` buttons are on
  victory/game over (1949, 1954). Pause is a banner (1794-1795) with no buttons. **Fix:** a pause card with
  Resume / Restart day / Settings / Main menu (see section 3).
- **H-P1-3 · Progress is not saved.** Only `cay_prefs` and `cay_best` are stored (365, 570-572). Reloading on day 6
  restarts at day 1. The design language requires Continue. **Fix:** in section 3.
- **H-P1-4 · Dirty glasses can be thrown away from the tray**, which bypasses the sink. `dropTray` (796) removes any
  slot, `'dirty'` included (click on a full slot, 1975). The bot even relies on drop for non-dirty items only (940).
  **Repro:** pick up a dirty table, click the dirty slot: the tray slot is free with no sink trip. **Fix:**
  `if (w.tray[k] === 'dirty') return toast(t('toastNothingToWash'))`, or only allow the drop at the sink. Same in
  Godot `tea_sim.gd:292`.
- **H-P1-5 · Wheel zoom and pinch resize the canvas on every event.** The wheel (2030) and pinch (2016) handlers
  call `layoutCamera()` → `renderer.setSize()` (1080). Setting `canvas.width` re-allocates the drawing buffer even
  when the value is the same, so zooming stutters on the UHD 620 (unverified by measurement). **Fix:** split out
  `applyZoom()` that only updates `cam.left/right/top/bottom` + `updateProjectionMatrix()` + `placeCamera()`.

### P2 (polish)

- **H-P2-1 · The retry flow label is still slightly off.** Game over → "Retry the day" (1954) → `actions.retry`
  (1966) opens the **shop**, and the shop button again says "Retry the day" (1945). That works, but the first button
  should say e.g. "Shop & retry" / "Dükkân ve tekrar". `A.retry` (590), which restores `_snap`, is never called (see
  section 2), so the design is "keep the failed day's coins, shop, retry". That matches `goTxt`, but differs from
  Godot (see 5.1).
- **H-P2-2 · A pinch can end in a click.** In `endPtr` (2019-2027) the second finger's `moved` can be false (it may
  not have moved > 7 px), and `ptrs.size === 0` on its release, so `pickAt` fires after a pinch. **Fix:** set a
  `pinched` flag when `ptrs.size === 2` and skip the click until all pointers are up.
- **H-P2-3 · Per-frame DOM queries.** `uiFrame` runs `$$('.st')` plus `querySelectorAll('.u')` for 5 stations,
  `$('#b-speed')`, `$('#b-pause')` and four `style.display` writes every frame (1789-1834, 1791-1794). Cache the
  elements in `uiStatic`. Also `new THREE.Color(0xd23a2a)` per flashing person per frame (1677) and
  `Object.values(PPL)` per frame (1683).
- **H-P2-4 · `?audiotest` without Web Audio crashes the module.** `sfxInit()` swallows the failure, then
  `Aud.ctx.resume()` (2215) throws on `null` at top level. Guard it with `if (Aud.ctx)`. Without a user gesture
  `resume()` may also never resolve in Chrome, so `G.testOut` stays empty unless Chrome runs with
  `--autoplay-policy=no-user-gesture-required` (unverified).
- **H-P2-5 · `G.errors` is unbounded for promise rejections** (2156): only the `error` handler trims to 5 (2155).
- **H-P2-6 · The apprentice claim race.** The waiter may clear a table the apprentice has `claimed` (`doTable` 781
  ignores `claimed`). The apprentice then "clears" an already clean table, walks a phantom glass to the sink, and
  the table stays unspawnable (`claimed`, 627) until then. **Fix:** in `doTable`, when the waiter clears a claimed
  table, reset `tb.claimed` and the apprentice to `idle`.
- **H-P2-7 · The spill burst ignores the model anchors.** `burst('steam', CNT_X, 1.5, STATION_Z.coffee)` (725) is
  fine for the procedural stove, but should use `FIT.pots` with the model.
- **H-P2-8 · Touch targets are under 44 px.** `.ibtn` 34 px (42), `.slot` 38/34 px (53, 172).
- **H-P2-9 · The `starOff` grey filter.** `filter:grayscale(1)` on an SVG `<image>` (277) may be ignored by some
  engines (unverified). The `opacity:.3` still dims it, so this is cosmetic.
- **H-P2-10 · Ambience keeps running in the background.** The noise loop runs when the tab is hidden or the game is
  paused (gain is not reduced; only the gull timer checks, 1040). Ducking the master gain on pause is nicer.
- **H-P2-11 · Number keys queue work while paused** (`clickStation` does not check `G.paused`, 1983). This may be
  intended ("plan while paused"), but Godot blocks it. Pick one behaviour for both.
- **H-P2-12 · The endless HUD with `?day=8`** shows "Day 8/7" because `G.endless` is false (1783). Test-only.

### Checked and fine

Customers (spawn, think, wait, patience, 8 % patience bonus per serve, angry leave, walk-by when full); orders
(weighted items, group 3-5 items); stations (kettle ×2 with the upgrade, oven ready×3, coffee cook / 3.6 s window /
spill / clean, ayran infinite, sink washes all dirty); tray cap 3-5; queue ≤ 6; shop costs and max levels; endless
targets and gaps; stars; victory → endless; best record; `?auto`, `?debug`, `?sim`, `?low`, `?lang`, `?clicktest`,
`?bench`, `?stop`, `?seed`, `?skill`, `?day`, `?zoom`, `?pan`, `?noassets`, `window.cay`/`caySim`/`cayBench`;
`visibilitychange` auto-pause; the 37-person pool plus 3 strollers in slots 37-39; the ITM capacity (44 ≥ 36 table
+ 5 tray + 1 apprentice).

---

## 2. Dead or unnecessary code (HTML, verified by grep)

| Line | What |
|---|---|
| 282 | `itemIcon` is never called |
| 545, 548, 590 | `_snap` and `A.retry()`: no caller in the UI or the tests (`actions.retry` goes to the shop instead). Only reachable as `window.cay.act.retry` |
| 1562 | `const ambient = { people: [] }` is unused |
| 370, 1961, 1988 | `G.autoPaused` is written, never read |
| 1529 | `PK.water` particle kind is never emitted |
| 1688 | `catGrp.rotation.y = …` is immediately overwritten at 1689 |
| 1796 | empty `if (...) { /* nothing else */ }` |
| 1989 | `blur` listener with an empty body |
| 187 | CSS `#top .hide-s` (no element has that class) |
| 178 | `.bub{transform-origin:0 0}` has no effect (the bubbles are never scaled) |
| 931 | `G.day >= 1` is always true |
| 1505 | `NHALO = 4`, but only 2 halo slots are used (slots 2-3 are wasted, harmless) |
| TXT | unused keys in both languages: `n_tea`, `n_simit`, `n_coffee`, `n_ayran`, `c_normal`, `c_office`, `c_group`, `c_regular`, `toastApprentice`, `dayFail`, `full`, `queue`, `buy` |
| 1600, 1612 | with the table model, `TB.legs` is hidden but its matrices are still uploaded every frame |

---

## 3. Design-language gaps (HTML) and a plan

| Requirement | HTML now | Plan |
|---|---|---|
| Loading "n/N", Play disabled | **done** (models + texture) | add the 20 icon PNGs to the count (0.3-4) |
| Title: logo, name, subtitle, how-to, Play, **Continue**, **Settings**, language, best, **footer** | no Continue, no Settings, no footer | add a Continue button when `arena.cay.save` exists, a Settings button, and the footer `Claude Game Arena · built by Claude Sonnet 5.5` linking to the arena page |
| HUD: glass bar, logo+name, stats, speed/pause/sound/lang | done | add a settings (gear) button for parity with Godot |
| **Pause**: Resume, Restart, Settings, Main menu over a dimmed, blurred backdrop | banner only | turn `#pausebanner` into a `.card` in `#screen` (state `pause` handled inside `uiScreen` while `G.state==='play' && G.paused`), reusing the `#screen` blur. Restart = `resetWorldForDay(); beginDay()` with `_snap` restored (this finally gives `_snap` a use) |
| **Settings**: master/music/sfx, language, quality, fullscreen | only a mute toggle | add 3 GainNodes (`Aud.sfx`, `Aud.music` → master); ambience goes on the music bus (no music exists yet, see section 6). Quality Low/High toggles `body.low`, shadows and the pixel ratio (shadows need `renderer.shadowMap.enabled` plus material `needsUpdate`, so the simplest correct way is to save and `location.reload()`). Fullscreen = `document.documentElement.requestFullscreen()` |
| End: title, 2-4 stats, **new-record highlight**, Play again, Main menu | no record highlight; the summary has no Main menu | compare with `cay_best` before writing it in `endDay` and show a `.chipnew` "New record!" on game over/victory |
| Toasts good/bad/info | done | n/a |
| Keys: **P**/Esc pause, M music, **X** sfx, **L** language, F11 | Space = pause, Esc = clear queue, M = mute everything, no P/X/L | P and Esc pause (move "clear queue" to Backspace or right click, keep Space as an extra pause key); M = music (ambience) on/off; X = effects; L = language |
| Buttons ≥ 44 px on touch, visible focus ring | 34-38 px | `@media (pointer:coarse){.ibtn{min-width:44px;height:44px}.slot{width:44px;height:44px}}`; add `:focus-visible{outline:3px solid var(--amber2)}` |
| Save keys `arena.cay.settings` / `.save` / `.best`, migration | `cay_prefs`, `cay_best` | read the old keys once, write the new ones; `.save` = `{day, coins, up, totalEarned, log, won, endless, resume:'intro'|'shop'}` written in `A.intro` and `A.shop` |
| Defaults master .8 / music .6 / sfx .8 | master gain .85 fixed | use the defaults |
| Test hooks | all present (`?auto ?debug ?sim ?low ?lang ?noassets window.cay`) | keep; add `?nosave` |

---

## 4. Godot bugs

### P0

None found that crash or block play. **Unverified**: nothing was run.

### P1

- **G-P1-1 · The HUD coin counter mixes the wallet with today's target.** `hud.gd:406` shows
  `GameState.live_coins()` (= banked wallet + `day_coins`, `game_state.gd:364-365`), and `hud.gd:407` shows
  `/ target`, while the bar (408) uses `day_coins`. From day 2 on the number can already be above the target at
  0:00 (e.g. wallet 150 → "150 / 95"). **Fix:** `_coin_label.text = str(s.day_coins)` (like HTML 1786). Show the
  wallet in the shop/summary only (it already is: `screens.gd:458, 471`).
- **G-P1-2 · Menus cannot be used with the keyboard or gamepad.** `UiKit.button` sets `focus_mode = FOCUS_NONE`
  (`ui_kit.gd:53`), and nothing maps `ui_accept` on the title, intro, summary, shop, game over or victory. Keyboard
  players cannot press Play or Start the day (HTML uses Space for title and intro), and the README's gamepad table
  stops at gameplay. **Fix:** `FOCUS_ALL`; in `Screens.show_screen` call `grab_focus()` on the first primary button
  after the build (deferred); add a focus stylebox (amber outline).
- **G-P1-3 · Eating parties are not paid at day end** (same as H-P1-1). `tea_sim.gd:325-327` sets `finished` with
  no payout. **Fix:** before `finished = true`, `for p in parties: if p.state == "eat": _pay_party(p)`.
- **G-P1-4 · "Start game" overwrites the save without asking.** With a save, the title shows Continue (primary) and
  Play (alt) (`screens.gd:282-284`). Play → `start_new()` → `_enter_intro()` → `save_progress()`
  (`game_state.gd:206-238`) silently replaces the run. The warning text `newGameWarn` exists in `loc.gd:45/89` but
  is never used. **Fix:** a confirm card ("A new game overwrites your saved progress", Yes / Back).
- **G-P1-5 · The failed-day rules differ from the original, and the text lies.** Godot banks coins only when the
  day passes (`game_state.gd:260-262`), and `retry_day` restores the snapshot (322-329) straight into the intro (no
  shop). `goTxt` ("Upgrades from the shop will help next time", `loc.gd:32/76`) is then false: there is nothing new
  to buy. The README says "same numbers". HTML keeps the failed day's coins and goes to the shop (1966). **Fix:**
  choose one rule for both versions (recommended: the HTML rule, since it makes the game-over text true and gives a
  struggling player a way out). In Godot, bank `sim.day_coins` always and make the game-over retry go through
  `go_shop()` with a `retrying` flag.

### P2

- **G-P2-1 · The angry bubble never shows.** The `"leave"` branch in `hud.gd:528-532` is unreachable:
  `_finish_leave` sets `tb.party = null` (`tea_sim.gd:697`), so a leaving party is never `tb.party`. Either keep a
  `last_party` on the table for ~1 s, or drop the branch.
- **G-P2-2 · Per-frame allocations.** `StationButton._process` calls `_refresh_style()` every frame while ready
  (`station_button.gd:155-158`), and that creates a new `StyleBoxFlat` each time (line 113). With 3 ready stations
  that is 180 allocations a second. Cache 2-3 styleboxes and only lerp `border_color` on a single instance. Also
  `hud.gd:433` re-assigns `Icon.kind` every frame (its setter `queue_redraw()`s).
- **G-P2-3 · Tray items are generic cylinders** recoloured per item (`world_view.gd:271-279, 506`), and table
  leftovers are also cylinders (`table_view.gd:93-100`). HTML now has per-item models (ITM). Port them (5.2).
- **G-P2-4 · Ambient life ignores pause.** The ferry, gulls and cat keep moving and the horn sounds when the game is
  paused or a menu is open (`world_view.gd:420-422, 539-601`). HTML runs these inside `simStep`. Gate them on
  `not GameState.paused`.
- **G-P2-5 · Changing quality does not resize the steam emitters.** `Fx.make_emitter` reads `Settings.is_low()` once
  at creation (`fx.gd:101`).
- **G-P2-6 · A language change on the victory screen replays the confetti and the star tweens** (`screens.gd:96-99`
  → `_build_victory` → `_launch_confetti`). Pass `animate=false` through to skip the confetti.
- **G-P2-7 · Dirty glasses can be dropped from the tray** (`tea_sim.gd:292`), same as H-P1-4.
- **G-P2-8 · Continue after victory loses `endless`.** Victory saves `resume:"shop"` with `endless=false`
  (`game_state.gd:280`). Continue → shop → day 8 with `endless=false`. The display copes (`hud.gd:403` checks
  `day > DAY_COUNT`), so the effect is only the saved flag. Set `endless = true` when `won` and `day >= win_day`.
- **G-P2-9 · `_start_demo()` runs 1,800 sim steps synchronously** in `_ready`, in `to_menu` and every time the demo
  day ends (`game_state.gd:162-172`). This is a short hitch, unverified (likely < 50 ms).
- **G-P2-10 · No "welcome" toast and no day-1 tea-station pulse.** HTML has both (553, 1832). The key `welcome`
  exists in `loc.gd` but is unused.
- **G-P2-11 · Touch targets.** The icon buttons are 38×36 / 44×36 (`hud.gd:101, 164, 181`). Slots are 40 px.
- **G-P2-12 · Dead or unused code**: `CameraRig.reset_view`, `Sfx.set_music`, `Sfx.is_ready`; icon kinds `menu` and
  `dots`; `Loc` keys `welcome`, `full`, `n_*`, `c_*`, `keys`, `newGameWarn`, `bestRun`, `save`, `startingCoins`,
  `coins`, `openMenu`, `dayFail`. `Screens.is_open` is used only by `tests/ui_smoke.gd`.

---

## 5. Parity: HTML ↔ Godot

### 5.1 Feature table

| Area | HTML | Godot | Better | Port direction |
|---|---|---|---|---|
| Rules: brew/oven/cook times, prices, patience, tips, days, endless | same numbers | same (`.tres` + `balance_data.gd` defaults) | = | n/a |
| Failed day coins | kept; retry goes through the shop | discarded; retry restores the snapshot into the intro | HTML (matches `goTxt`) | → Godot (G-P1-5) |
| Eating parties at day end | unpaid | unpaid | both wrong | fix both |
| Customer pool | max 37 people; spawn fails when full | unlimited | Godot | n/a (HTML is rarely hit) |
| HUD coins | day coins / target | wallet + day / target (bug) | HTML | → Godot (G-P1-1) |
| Served items on tray/tables | per-item models (ITM) | recoloured cylinders | HTML | → Godot |
| Station world badges (×n above the stations) | yes (1868-1879) | no | HTML | → Godot (optional) |
| Day-1 tutorial pulse + welcome toast | yes | no | HTML | → Godot |
| Queue chips | station icons + table numbers | numbers 1..n only | HTML | → Godot |
| Angry/eat mini bubbles | eat (happy) yes | eat yes, angry dead code | = | fix Godot |
| Strollers on the far street | 3 | none | HTML | → Godot (cheap) |
| Sea | flat + wave strips | shader sea | Godot | n/a |
| Lighting | hemi + sun, ortho camera | sky, fog, filmic, perspective, shake | Godot | n/a |
| Sign | canvas texture with tulips | Label3D | HTML slightly | n/a |
| Generated models / texture / icons / logo | **yes** (uncommitted) | none | HTML | → Godot (5.3) |
| Title | static card + Loading n/N | live demo day behind it, AnimationPlayer sway | Godot | → HTML (a demo bot run behind the title is cheap: `?auto` logic exists) |
| Continue / save | no | yes (`user://save.json`) | Godot | → HTML |
| Settings (volumes, language, quality, fullscreen) | mute only | full | Godot | → HTML |
| Pause menu | banner | Resume / Settings / Main menu (no Restart) | Godot | → HTML; Restart → both |
| Music | none (noise + gulls) | synthesised hicaz loop + frame drum | Godot | → HTML (port the `MELODY` table to Web Audio, ~40 lines) |
| Keys | Space, Esc, 1-5, M | Space/P, Esc, 1-5, F speed, Q/E/Enter tables, +/-, gamepad | Godot | Q/E/Enter → HTML; M → Godot |
| Keyboard menus | Space on title/intro | none (FOCUS_NONE) | HTML | fix Godot |
| Touch | pan, pinch | pan, pinch, portrait UI scale | = | n/a |
| Test hooks | `?auto ?debug ?sim ?low ?lang ?noassets ?bench ?clicktest ?audiotest`, `window.cay` | `--auto --sim --seed --day --stop --skill --low --lang --open --save --quit-on-finish`, `get_state_text()`, 386 unit tests, `ui_smoke` | Godot (real tests) | n/a |
| `--no-save` (design) | n/a | missing (`--save=NAME` exists) | n/a | add `--no-save` alias |
| Game-over stats | day, earned/target, happy/angry, total | earned/target, day reached | HTML | → Godot |
| Victory stars | sum / 21 | sum / (days × 3) + an overall star row | Godot | n/a |

### 5.2 Small ports Godot needs besides the assets

1. **ITM items.** Build the 6 item meshes with `MeshMerger` (HTML 1386-1395 numbers; `LatheGeometry` → a
   `MeshMerger.lathe(points, seg)` helper, or approximate with stacked `cyl`). Give each `TableView` slot and each
   tray node a mesh per kind. Leftover mapping is `ITEM_USED`/`USED_TINT` (1405-1406). The table item height is .98,
   tray .07 above the old y.
2. The queue chips with station icons, the welcome toast, the day-1 pulse, and the 3 strollers.

### 5.3 What Godot needs to use the new GLBs, icons, logo and texture

**Copy** (into `cay-ocagi-godot/`, committed together with the generated `.import` files):

```
assets/models/{semaver,oven,coffee,ayran,sink,table,window,ferry,cat}.glb
assets/textures/cobblestone.webp
assets/ui/icons/*.png  (20)
assets/ui/logo.png, assets/ui/favicon.png
```

**Import settings**:
- GLB: the default scene import. Godot 4 reads `EXT_texture_webp` (verify on the first `--import`).
- In the `.import` (or at runtime), turn off "generate LODs" and "create shadow meshes" (not needed at ~1-2 k tris).
- PNG icons: 2D texture with **mipmaps on**, so 96 px → 20-28 px stays clean. Use `texture_filter =
  TEXTURE_FILTER_LINEAR_WITH_MIPMAPS` on the drawing `Control`.
- `project.godot`: `config/icon="res://assets/ui/favicon.png"` (the web export uses it as the favicon).

**Code changes**:
1. `WorldBuilder.build_static(skip: Dictionary = {})`: wrap the semaver (153), oven (155-165), coffee (167-180),
   ayran (182-191), sink (193-200), window loop (98-109) and ground tile loop (77-80) in `if not skip.has(...)`, like
   HTML `buildWorld(skip)`. Also the `semaver2` merger (233-234).
2. A new `scripts/view/asset_models.gd` that, for each existing `res://assets/models/X.glb`
   (`ResourceLoader.exists`), instantiates the `PackedScene` and places a wrapper `Node3D`. Godot uses the same axes
   as three.js (Y up, right-handed, the station front faces +X), so the HTML numbers carry over directly. The GLB node
   already puts the base at y=0 and centres x/z. Node3D applies scale before rotation (T·R·S), while HTML scales after
   the yaw. That only matters for the non-uniform scales, and both of those (ayran, table) have yaw 0. So:

| Model | `rotation.y` | `scale` | `position` | Extra |
|---|---|---|---|---|
| semaver | 0 | 2.0 (uniform) | `(CNT_X, 1.12, -5.05)`; second at z `-3.85`, `visible = up.kettle > 0` (replaces `_semaver2`) | steam emitters y → `1.12 + 2.0 + .05` |
| oven | `PI/2` | `1.6 / 0.98` ≈ 1.633 | `(CNT_X, 1.12, -1.9)` | glow box `(CNT_X - .049, 1.643, -1.973)`, scale `(1, .632, .657)`; rings y `1.12 + .87·1.574` ≈ 2.49, x `CNT_X + .15`; smoke emitter = the top-vertex centroid (port `topSpot` over `mesh.surface_get_arrays(0)`, or read it once in the browser and hard-code it) |
| coffee | `PI/4` | `1.65 / size_x_after_yaw` (compute from the rotated vertices, as in HTML 2074-2077; **not** the raw 1.0) | `(CNT_X, 1.12, 0.5)` | foam `[CNT_X + .1sc, 1.12 + .34sc, .5 - .26sc]` and `[…, .5 + .31sc]`; steam +.15 |
| ayran | 0 | `(2.5, 1.8, 2.5)` | `(CNT_X + .2, 1.12, 2.7)` | n/a |
| sink | `PI/2` | 1.55 | `(CNT_X + .3, 1.12, 4.9)` | n/a |
| window | 0 | 1.05 | `(-8.1 + .38·1.05/2 - .04, 5.2, -7 + i·3.25)` ≈ `(-7.94, 5.2, z)`, i = 0..4 (a `MultiMeshInstance3D`, or 5 instances) | n/a |
| table | 0 | `(1.807, 1.129, 1.8)` | at the table origin `(x, 0, z)`; top at .98 | `TableView`: drop the leg + top + cloth cylinders from the merger (`table_view.gd:43-46`), keep the stools. Tint: `material_override` = a duplicate of the GLB material with `albedo_color = CLOTH[i]` (the cloth texture is white, so the tint works like HTML `instanceColor`) |
| ferry | `PI/2` | 8.0 | the child of `_ferry`, local y `-.55` | replaces the `WorldBuilder.ferry()` mesh |
| cat | 0 | `.85 / .994` ≈ .855 | the child of `_cat` (keeps `rotation.y = face - PI/2` and the squash) | n/a |
| ground | n/a | `PlaneMesh` 31.5 × 23 | `(1.75, .015, 2.5)` | `StandardMaterial3D`: `albedo_texture` = cobblestone, `uv1_scale = Vector3(6.3, 4.6, 1)`, `texture_repeat` on, roughness 1 |

3. **Materials.** Override each imported surface with a `StandardMaterial3D` that has:
   - `albedo_texture` = the GLB's base colour texture;
   - `roughness 0.9`, `metallic 0`, `metallic_specular 0.25` (same as `MeshMerger.material()`), so the models match
     the vertex-coloured scenery under the filmic tonemap;
   - optionally `shading_mode = SHADING_MODE_PER_VERTEX` for a flatter, toy look.

   For the semaver brightening (`color × 1.2` in HTML), use `albedo_color = Color(1.2, 1.2, 1.2)`, or adjust the
   texture if Godot clamps it (unverified). Cast shadows on for the stations and tables, off for the windows if the
   shadow budget is tight.
4. **Fallback.** When a GLB is missing, keep the procedural part (the skip set only lists what loaded), exactly like
   HTML.
5. **Icons.** In `Icon._draw` / `Icons.draw_at`, if `res://assets/ui/icons/<kind>.png` exists (cache the textures
   in a static Dictionary; `starOff` = the star with `Color(1, 1, 1, .3)` modulate), call
   `draw_texture_rect(tex, rect_fitted, false)`. Otherwise keep the vector path. Keep the vector `pause`, `play`,
   `snd`, `mute`, `gear`, `check`, `dots` and `menu` icons (no PNGs exist for them). The PNG names match the Godot
   kinds 1:1 (tea, simit, coffee, ayran, sink, dirty, coin, happy, angry, star, person, office, group, regular,
   kettle, tray, oven, apprentice, table, stool).
6. **Logo.** On the title (`screens.gd:269`), replace `_icon_center("tea", 54)` with a `TextureRect` 128 px (96 px
   in portrait) using `logo.png`, `expand_mode` set to ignore size and `stretch_mode` keep-aspect-centered. In the
   HUD logo (`hud.gd:126`) keep the tea icon PNG rather than the logo (see 0.3-5).
7. **Pick anchors** (`world_view.gd:367`) stay as they are; the station footprints are unchanged.
8. Update the README "Credits" ("no third-party assets" stays true, but say the assets were generated with
   Higgsfield and processed with glTF-Transform), and check draw calls and fps on High/Low.

---

## 6. Redesign ideas (ranked by impact ÷ effort, each about 1 hour per version)

1. **Both: fix the money rules** (pay eating parties; one failed-day rule). Small diff, and it fixes real unfairness.
   About 20 minutes.
2. **HTML: pause card + Continue save + settings card** (section 3). This is the biggest gap to the shared
   structure; most of the code is UI strings plus `localStorage`.
3. **Godot: asset port** (5.3). This is the biggest visual win and makes the two versions look like one game.
   About 1 hour without the screenshots.
4. **Godot: HUD coin fix + keyboard focus + new-game confirm + ITM items.** Four small fixes that remove the most
   confusing moments.
5. **Both: "last orders" at 0:20.** Spawning already stops at `dayLen - 20`. Show a toast and a bell, tint the clock
   bar, and close the door shutter. This makes the existing hidden rule readable. About 30 lines each.
6. **Both: coin fly-to-HUD.** On `addCoins` / `_add_coins`, animate 3-5 coin icons from the table's screen position
   to the coin chip (CSS transform / a Tween), then bump the chip. Cheap juice that teaches where the money goes.
7. **Both: an order-ready preview on the tray.** Highlight the tray slots that match the hovered table's open order,
   and dim the table bubbles whose items are already on the tray. This is a big readability gain in group rushes;
   the data is all there (`unmetFor`, `p.unmet()`).
8. **HTML: music.** Port Godot's hicaz `MELODY` + bass + frame drum to Web Audio (schedule one 32-beat loop into an
   `AudioBuffer` at start, like Godot `_job_*`) on a music bus. This is the precondition for the M key meaning
   "music".
9. **Godot: strollers, station badges and queue icons** from HTML, for parity polish.
