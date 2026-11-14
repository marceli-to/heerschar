# Progress

Handoff notes for a fresh session. Read this first, then only the `PLAN.md` sections named for the next step.

## Working agreement

- **Ask Marcel before any design choice** (looks, colours, UI, names, feel). Pure engineering is fine without asking. Batch questions at stage boundaries.
- Commit at the end of each stage or sub-step. Keep this file current and say when it is a good moment to start a new session (Marcel wants small context windows).
- `PLAN.md` is the full brief (stages in section 14). Don't reread all of it: open the sections a step needs.

## Status

| Stage | State |
|---|---|
| 0 Scaffold | done, committed |
| 1 Hero alone | done, committed. **Gate passed**: Marcel playtested, "feels quite good, hard to beat 3 opponents, I like that". Keep current feel numbers. |
| 2 Squad battle | **next**, not started (breakdown below) |
| 3–7 | not started |

## Design decisions (all approved by Marcel)

- 3D: lit low-poly, flat-shaded Lambert, warm sun with soft shadows, hemisphere fill. Sunny meadow arena (ellipse 44 × 30 m, stone ring, hills, trees).
- Figures: heroic/realistic proportions (~1.8 m) from primitives. Player side warm colours, enemies cold (`src/view/palette.ts`). The hero has a gold helmet crest (added without asking; Marcel has not objected).
- UI: parchment look; fonts Cinzel (headings) and EB Garamond (body), self-hosted OFL in `public/fonts/`; tokens in `src/style.css` (`parchment`, `ink`, `gold`, `blood` …, classes `.parchment`, `.hud-plate`, `.btn-gold`).
- Language English. Class names: Warrior, Archer, Healer, Mage; enemy types Shieldbearer, Berserker, Shaman. Code IDs stay German as in the plan. All strings in `src/data/strings.ts`.
- **Stage 2 decisions:**
  - Area warnings: **filling disc**, a translucent red-orange disc with a bright rim; an inner disc grows to the edge as the timer runs out.
  - Damage/heal numbers: **bold, punchy**, pop and bounce, heavy hits bigger. Colours were not specified; propose cream (dealt), red (taken by squad), green (heal) and confirm.
  - Squad panel: **bottom row** of small cards next to the hero plate (name, class icon, health bar; fallen = greyed, < 30 % = pulses).
  - Class icons: **Cinzel monograms** (W, A, H, M …) in a gold-rimmed medallion.
- Theme (medieval vs. stylised fantasy like WoW): **open**, to be decided around Stage 3 together with the Stage 6 asset packs (KayKit, Quaternius, Kenney). The current lit low-poly look suits a bright stylised fantasy; a dark gothic look would need lighting/palette/UI rework.
- Esc pauses (pointer lock released → pause panel).

## Feel decisions made in Stage 1 (tunable, in `src/sim/balance.ts`)

- Attack direction = movement direction, else camera forward; melee aim assist (3.2 m, 55°).
- Dodge without direction = hop backwards. Dodging units pass through others.
- Two-hit chain: light (windup 0.13, recover 0.32) then heavy (windup 0.18, recover 0.48); input buffer 0.3 s; hit-stop 0.06 / 0.1 s.
- Poise: light hits don't interrupt a windup, heavy ones do; 1.2 s stagger immunity after a stagger.
- Enemy melee windup 0.6 s; at most 2 enemies attack the same target at once, the rest circle at 4.5 m.
- Trial raiders: 170 HP, power 18, armor 30 (`src/data/encounters.ts`).

## Architecture as built

- `src/sim/` pure and deterministic (enforced by `tests/sim/purity.test.ts`). `battle.ts` has `createBattle(setup)` and `step(battle, input, dt)` → events. Also `heroControl.ts`, `ai.ts` (Stage 1 melee enemy only), `combat.ts` (damage, `resolveMelee`, poise), `movement.ts` (separation, elliptical soft bounds, knockback), `bot.ts` (scripted hero), `rng.ts` (state lives on `Battle.rngState`), `balance.ts`, `types.ts`.
- `src/data/`: `classes.ts` (4 class stat lines), `encounters.ts` (`trialSetup`), `strings.ts`.
- `src/view/`: `scene.ts`, `arena.ts`, `camera.ts` (zoom 0..1 curve, yaw, follow, shake; tuning in `CAMERA`), `unitView.ts` (`UnitView` interface + `PrimitiveWarriorView`; animation is **posed from sim state every frame**, so hit-stop freezes it for free), `markers.ts` (HealthBar), `effects.ts` (sparks, dust, swing arcs).
- `src/input/`: `keyboardMouse.ts`, `heroInput.ts` (latches presses per frame and hands them to the next tick; camera-relative movement).
- `src/game/`: `loop.ts` (fixed-timestep accumulator, visibility reset), `game.ts` (glue: phases intro/playing/paused/ended, interpolation, events → effects/shake, reactive `hud` and `debug` for Vue).
- `src/ui/`: `App.vue`, `Hud.vue`, `Overlays.vue`, `ParchmentPanel.vue`, `DebugOverlay.vue`.
- Reused from github.com/marceli-to/tin-wolf (Marcel's earlier game): RNG, loop, input, effects pattern. It also has synthesised SFX (`src/audio/sfx.ts`) and Kenney CC0 models, useful for Stage 6.

## Verify

- `npm test` (39 tests), `npm run typecheck`, `npm run build`. Dev server: `npm run dev` → http://localhost:5190.
- URL params: `?seed=`, `?zoom=0..1`, `?debug` (overlay + `window.__game`), `?bot` (bot plays the hero).
- Headless checks (Chrome, needs the dev server): `node tools/shot.mjs "<url>" out.png '[{"wait":4500,"shot":"a.png"}]'` for screenshots (combat: `?bot&seed=5&zoom=0.2`), `node tools/perf.mjs "<url>"` for fps and the background-tab test. The T3 preview pane runs no animation frames, so use these instead.

## Stage 2 breakdown (do in this order, commit after each)

PLAN sections: 5 (rules, statuses), 6 (classes, enemy types, companion behaviour), 7 (hero abilities, energy, leader ability, mark), 8 (lock-on, HUD), 13 (bot, tests).

1. **2a Sim: squad and classes.** Generalise `ai.ts` per class (Krieger intercepts and taunts, Bogenschuetze kites and shoots lowest HP, Heiler heals lowest fraction (hero first on ties), Magier casts at clusters + frost nova). Projectiles (straight and arcing, aim at the current position), area effects (telegraphed circles 0.8–1.5 s), heals, statuses (frozen, stunned, marked, rallied, shielded). Formation setup: 3 × 2 slots per side, about 24 m apart. Companion abilities. Tests for each.
2. **2b Sim: hero kit.** Energy (start 30, +4/s, +5 per landed basic attack), Warrior abilities Schildstoss / Wirbel (and the other three classes' sets), leader ability Sammeln (rallied 6 s), lock-on (Tab / cycle / Shift+Tab), mark (F). Extend `HeroInput`. The hero has no self-heal unless Heiler (reduced).
3. **2c Enemy types:** Schildtraeger, Berserker, Schamane.
4. **2d View:** figures for Archer (hood, bow), Healer (robe, glowing orb), Mage (pointed hat, staff), plus the three enemy types (silhouettes: ask Marcel if unclear). Projectiles with trails, filling-disc area warnings, heal glow, frozen = blue, lock ring under the target, banner icon over the marked one, damage numbers.
5. **2e HUD:** energy bar, ability icons with cost and cooldown, squad panel (bottom row), edge markers, enemy count.
6. **2f Bot and headless test:** bot uses abilities, marks Schamane/healer first; 5-vs-6 battle test; determinism test with the full kit; bot alone (no companions) must not win.
7. **Done when:** a 5-against-6 battle is readable and winnable, the determinism test passes, and the bot cannot win it alone.
