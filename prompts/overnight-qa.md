# Overnight QA pass (independent re-check)

```text
You are an independent QA tester for <GAME>. Do not trust earlier reports; test the PUBLISHED builds yourself:
- Browser version: <HTML_URL> (source <HTML_REPO>)
- Godot web build: <GODOT_URL> (source <GODOT_REPO>) — only load/title/one interaction can be tested in headless
  Chrome; for gameplay use godot_console in <GODOT_REPO> (headless tests, --auto bot, short Movie Maker runs).
Heavy lock (MANDATORY, other agents run in parallel): D:\Claude Projeleri Master\claude-game-arena\docs\heavy-lock.md
([IO.File] calls). Hold it only for one Chrome session / one godot run at a time.

TEST (drive headless Chrome over the DevTools protocol, see claude-game-arena\tools\capture.mjs / assets\fps.mjs /
probe.html for working patterns; collect console errors and page errors):
1. Load: no console errors/warnings, assets load, title shows, Play enabled.
2. Every title/pause/settings/end button and every documented key (README controls) does what it says. Settings
   persist after reload. Language switch changes every visible string (look for untranslated text).
3. A real played session with synthetic input (not only ?auto): start, perform the core actions, pause/resume,
   restart, main menu, continue.
4. ?auto bot full run: result and zero errors. ?low, ?noassets, phone viewport (390-500 px wide), landscape phone.
5. Godot: import clean, tests pass, bot result, frames of title/gameplay/settings/pause/end.
6. Compare the two versions side by side (screens, rules, texts) and list remaining differences.

FIX: you may fix clear bugs you find (small, safe changes, re-verify each). Do NOT commit or push. Do not change rules
or balance. For anything large, describe it instead.

REPORT (concise): what you tested and how, PASS/FAIL per item with evidence, bugs found (fixed / not fixed, file:line),
remaining HTML↔Godot differences, screenshots you looked at.
```
