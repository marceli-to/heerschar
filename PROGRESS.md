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
| 2 Squad battle | in progress: **2a–2d done**, committed; **2e next** (breakdown below) |
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
- **2d decisions:** enemy silhouettes "classic set": Shieldbearer bulky plate, bucket helm with eye slit, tower shield + mace; Berserker bare-chested, wild hair and beard, two hand axes, hunched; Shaman fur mantle, antler headdress, bead necklace, crooked staff with a skull and glowing crystal. Number colours: cream = dealt by the squad, red = taken by the squad, green = heal, small pale blue = shield-absorbed; the hero's hits (dealt or taken) bigger, heavy hits bigger. Lock = thin gold ground ring with four inward ticks, slowly turning; mark = small red swallow-tail banner on a pole above the head, waving, drawn through figures. Magic "classic elemental": Mage bolt and fireball orange fire with ember trail, Healer/Shaman bolt golden-white, frost icy cyan, shields golden bubble (player) / pale blue (enemy). Arrows: wooden shaft with a pale streak. Colours in `FX` (`src/view/palette.ts`).
- Theme (medieval vs. stylised fantasy like WoW): **open**, to be decided around Stage 3 together with the Stage 6 asset packs (KayKit, Quaternius, Kenney). The current lit low-poly look suits a bright stylised fantasy; a dark gothic look would need lighting/palette/UI rework.
- Esc pauses (pointer lock released → pause panel).

## Feel decisions made in Stage 1 (tunable, in `src/sim/balance.ts`)

- Attack direction = movement direction, else camera forward; melee aim assist (3.2 m, 55°).
- Dodge without direction = hop backwards. Dodging units pass through others.
- Two-hit chain: light (windup 0.13, recover 0.32) then heavy (windup 0.18, recover 0.48); input buffer 0.3 s; hit-stop 0.06 / 0.1 s.
- Poise: light hits don't interrupt a windup, heavy ones do; 1.2 s stagger immunity after a stagger.
- Enemy melee windup 0.6 s; at most 2 enemies attack the same target at once, the rest circle at 4.5 m.
- Trial raiders: 170 HP, power 18, armor 30 (`src/data/encounters.ts`).

## Playtest notes after 2b

- Marcel: "hard to tell what works" in the trial: enemies killed him in ~10 s, so `?peaceful` was added. Most ability effects stay invisible until 2d (projectiles, area discs, heal glow, frozen/slowed looks, lock ring, mark banner); the Heiler kit needs the squad battle on screen. Offered (not built): a debug flag for unlimited energy.

## Made in 2d without asking (Marcel may veto)

- Intro copy for the squad battle is a **draft**: "The Skirmish" / "Six foes hold the far side of the field. Lead your companions against them." plus the full control list (`STRINGS.squad`). End texts too.
- Only blows the hero lands or takes shake the camera (companion fights would shake it constantly).
- Hero marker: gold crest on the Warrior helmet, gold band on the Archer hood; Healer and Mage heroes have none yet (they look like the companion of the same class).
- Healer robe cream with a red (player) / blue (enemy) mantle and a gold circlet; Mage has a grey beard; Healer holds the orb in the left hand.
- Shield bubble is a rim-lit (fresnel) shell so the figure stays readable; frozen = figure tinted icy blue and stops breathing/walking.
- Effects: heal = small green ground ring + rising sparkles; fireball landing = fire burst, ring, light shake; frost = cyan shards + ring; Sammeln = big gold ring; rallied = small gold ring per companion; taunt = shout ring.
- Heal circle (Heilkreis) shows as a green disc whose inner disc grows towards each pulse.

## Feel decisions made in 2b (made without asking, tunable; Marcel may veto)

- Ability energy and cooldown are paid when the windup completes, so a cast interrupted by a stun, freeze or dodge costs nothing. A press is buffered 0.3 s (fires when energy/cooldown allow within that window). Abilities can cancel the recover of a basic attack (after `chainOpen`).
- Numbers in `HERO_ABILITIES` (`balance.ts`). Costs 30–50, cooldowns 5–20 s. Schildstoss stuns 1.2 s ignoring poise; Wirbel hits all around (2.6 m); Salve 3 arrows ±12°; Rueckzug slows a front cone 3 s (`slowed` = −40% move speed, new status) then leaps back 5 m with dodge invulnerability; Heilkreis is a stationary circle at the hero's feet, 10 pulses over 5 s; Segen shields the lowest-fraction ally in 12 m (40 points); Feuerball lands on the lock target, else the aimed-at enemy, else 10 m ahead; Frostring freezes 2.5 s within 4 m; Sammeln rallies companions (not the hero) for 6 s.
- Hero self-healing and self-shielding (Heiler only) at 0.5 (`HERO_SELF_HEAL`).
- Ranged hero classes: two-shot chain along the **camera aim** (not the movement direction), 12° aim assist; Bogenschuetze arrows (physical), Heiler/Magier bolts (magic).
- Lock-on: Tab picks the enemy nearest the view centre (angle × 12 m/rad + distance, within 30 m); Tab again cycles clockwise around the hero; Shift+Tab releases; the lock drops when the target dies (no auto-retarget). While locked, the hero faces the target, attacks/abilities aim at it, the camera yaw swings round to it, and mouse yaw is ignored.
- Mark (F): marks the locked enemy, or without a lock the one nearest the view centre; F on the marked enemy clears it.

## Architecture as built

- `src/sim/` pure and deterministic (enforced by `tests/sim/purity.test.ts`). Hero kit (2b): `heroControl.ts` (input buffers, energy regen, state machine for chain + abilities), `heroAbilities.ts` (kit per class, aiming, ranged basic attack, `releaseAbility`, `heroActionTiming`), `heroTargeting.ts` (lock-on, mark). `Unit.action` is now `AiActionId | HeroAbilityId` (hero: `null` = basic chain). New events `release`, `lock`, `mark`; areas can heal and pulse (`heal`, `pulses`, `interval`). `battle.ts` has `createBattle(setup)` and `step(battle, input, dt)` → events, plus `slotPosition` / `formationSetup` (3 × 2 slots). Also `heroControl.ts`, `ai.ts` (one `updateAi` for companions and enemies: shared windup/recover runner, then a brain per class; `actionTiming(unit)` for the view), `combat.ts` (damage incl. frozen/marked multipliers, `applyDamage` with shield absorb + death, `applyHeal`, `stun`, `resolveMelee`, poise), `projectiles.ts` (straight + piercing shots, `lob` = arcing projectile whose damage is an area placed at launch, `placeArea`, `freeze`), `statuses.ts` (frozen, rallied, shielded, taunted; `stunned` is a unit state, `marked` is `Battle.markTargetId`), `movement.ts` (separation, elliptical soft bounds, knockback), `bot.ts` (scripted hero), `rng.ts` (state lives on `Battle.rngState`), `balance.ts`, `types.ts`.
- `src/data/`: `classes.ts` (4 class stat lines), `encounters.ts` (`trialSetup`, `squadSetup` = warrior hero + Krieger, Bogenschuetze, Heiler, Magier vs 3 Krieger + Bogenschuetze, Heiler, Magier), `strings.ts`.
- AI actions and behaviour numbers: `ACTIONS`, `BEHAVIOUR`, `STATUS`, `FORMATION` in `balance.ts`. Events added in 2a: `heal`, `action`, `shoot`, `areaStart`, `areaResolve`, `status`; `hit` has `absorbed`. Since 2d the game runs the squad battle (`squadSetup(seed, heroClass)`), `?trial` for the Stage 1 fight.
- `src/view/`: `scene.ts`, `arena.ts`, `camera.ts` (zoom 0..1 curve, yaw, follow, shake; tuning in `CAMERA`), `figures.ts` (`buildFigure(classId, colors, hero)` → `FigureRig` for all 7 classes; arms have elbows; `PoseStyle` melee / archer / caster), `ik.ts` (two-bone arm IK `reach` + `orient` for props), `unitView.ts` (`UnitView` interface + `PrimitiveFigureView`; animation is **posed from sim state every frame**, so hit-stop freezes it for free; melee uses the Stage 1 Euler swing poses, archers/casters are posed by hand position via IK; action → pose in `actionPose`: swing, spin, bash, roar, draw, cast, slam, hop; frost tint + shield bubble from `AnimInput.frozen/shielded`), `projectileView.ts` (`ProjectileLayer`, synced to `battle.projectiles` by id, `capture()` before each tick for interpolation), `areaView.ts` (`AreaLayer`, filling-disc warnings and heal circles), `targetMarkers.ts` (`LockRing`, `MarkBanner`), `damageNumbers.ts` (DOM numbers over the canvas, projected every frame, stack when several pop at one spot), `markers.ts` (HealthBar), `effects.ts` (sparks, dust, swing arcs, `trail`, `burst`, `rise`, `ring`).
- `src/input/`: `keyboardMouse.ts`, `heroInput.ts` (latches presses per frame and hands them to the next tick; camera-relative movement).
- `src/game/`: `loop.ts` (fixed-timestep accumulator, visibility reset), `game.ts` (glue: phases intro/playing/paused/ended, interpolation, events → effects/shake, reactive `hud` and `debug` for Vue).
- `src/ui/`: `App.vue`, `Hud.vue`, `Overlays.vue`, `ParchmentPanel.vue`, `DebugOverlay.vue`.
- Reused from github.com/marceli-to/tin-wolf (Marcel's earlier game): RNG, loop, input, effects pattern. It also has synthesised SFX (`src/audio/sfx.ts`) and Kenney CC0 models, useful for Stage 6.

## Verify

- `npm test` (109 tests; per-class and per-enemy-type behaviour in `tests/sim/squad.test.ts`, hero kit/lock/mark and full-kit determinism per hero class in `tests/sim/hero.test.ts`, test helpers `unit()`, `hold()`, `hero(x, z, classId)` in `tests/sim/helpers.ts`), `npm run typecheck`, `npm run build`. Dev server: `npm run dev` → http://localhost:5190.
- URL params: `?seed=`, `?zoom=0..1`, `?debug` (overlay + `window.__game`; shows energy, Q/E/R cooldowns, lock and mark until the 2e HUD), `?bot` (bot plays the hero), `?hero=krieger|bogenschuetze|heiler|magier` (hero class), `?peaceful` (enemies stand still and never act, for trying abilities), `?trial` (Stage 1 hero-alone fight instead of the squad battle). Keys: Q/E abilities, R Sammeln, Tab / Shift+Tab lock, F mark.
- Posing check: with `?debug&peaceful`, move units into a row and set `u.state = 'windup'`, `u.stateTime`, `u.action` from `__game` during the intro (no ticks run, so poses hold); set each slot's `prev` to the new position. Infinite `energy` for tests: set `hero.energy = 100` inside an injected `heroInput.sample`.
- Driving the real game headless: with `?debug`, set `__game.hud.phase = 'playing'` and override `__game.heroInput.sample = (yaw) => ({...})` to inject presses.
- Headless checks (Chrome, needs the dev server): `node tools/shot.mjs "<url>" out.png '[{"wait":4500,"shot":"a.png"}]'` for screenshots (combat: `?bot&seed=5&zoom=0.2`), `node tools/perf.mjs "<url>"` for fps and the background-tab test. The T3 preview pane runs no animation frames, so use these instead.

## Stage 2 breakdown (do in this order, commit after each)

PLAN sections: 5 (rules, statuses), 6 (classes, enemy types, companion behaviour), 7 (hero abilities, energy, leader ability, mark), 8 (lock-on, HUD), 13 (bot, tests).

1. ~~**2a Sim: squad and classes.**~~ Done. Notes: Krieger taunt fires when ≥ 2 non-hero foes are within 6 m (the hero is never taunted); Bogenschuetze uses its piercing shot whenever it is off cooldown; Heiler casts a weak magic bolt (0.5 × power) when nobody needs healing; frost nova also deals a little damage (0.4 ×). First numbers on `squadSetup` (30 seeds): Stage 1 bot hero wins 29/30, ~27 s per battle, hero ≈ 45 % of player damage (target 20–30 %, tune in 2f); an idle hero loses all. Original 2a brief: Generalise `ai.ts` per class (Krieger intercepts and taunts, Bogenschuetze kites and shoots lowest HP, Heiler heals lowest fraction (hero first on ties), Magier casts at clusters + frost nova). Projectiles (straight and arcing, aim at the current position), area effects (telegraphed circles 0.8–1.5 s), heals, statuses (frozen, stunned, marked, rallied, shielded). Formation setup: 3 × 2 slots per side, about 24 m apart. Companion abilities. Tests for each.
2. ~~**2b Sim: hero kit.**~~ Done (see "Feel decisions made in 2b"). Original brief: Energy (start 30, +4/s, +5 per landed basic attack), Warrior abilities Schildstoss / Wirbel (and the other three classes' sets), leader ability Sammeln (rallied 6 s), lock-on (Tab / cycle / Shift+Tab), mark (F). Extend `HeroInput`. The hero has no self-heal unless Heiler (reduced).
3. ~~**2c Enemy types.**~~ Done. `ClassId` = `PlayableClassId | EnemyTypeId`. Stats in `CLASS_STATS` (first numbers): Schildtraeger 170 HP, armor 110, resist 0, speed 3.0, plain melee on the nearest foe; Berserker 95 HP, speed 5.4, interval 0.9, goes for healers (Heiler/Schamane) first, then the nearest back-row foe, **ignores the 2-attacker cap**, still taunt-able; Schamane shares `supportBrain` with the Heiler (heal lowest fraction, bolt, stay back) plus the AI ability `ward` (shields the most hurt ally that a foe within 4 m is targeting, 2.5 × power for 8 s, cooldown 9). `squadSetup` enemies are now Schildtraeger, Krieger, Berserker (front) and Bogenschuetze, Schamane, Magier (back). 30 seeds: bot hero wins 24/30, ~31 s, hero ≈ 57 % of player damage (tune in 2f); idle hero loses 30/30. English names in `STRINGS.classes`. All units still render as the warrior figure.
4. ~~**2d View.**~~ Done (see "2d decisions" and "Made in 2d without asking"). All 7 class figures, projectiles with trails, filling-disc warnings, heal glow, frozen blue, shield bubble, lock ring, mark banner, damage numbers; the game runs the 5-vs-6 squad battle. 60 fps in the bot battle.
5. **2e HUD:** **← next session starts here.** Hud.vue still shows only the hero plate (class name now follows `?hero`), foes and time. energy bar, ability icons with cost and cooldown, squad panel (bottom row), edge markers, enemy count.
6. **2f Bot and headless test:** bot uses abilities, marks Schamane/healer first; 5-vs-6 battle test; determinism test with the full kit; bot alone (no companions) must not win.
7. **Done when:** a 5-against-6 battle is readable and winnable, the determinism test passes, and the bot cannot win it alone.
