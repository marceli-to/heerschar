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
| 2 Squad battle | done, committed. **Gate passed**: headless tests (winnable, deterministic, bot cannot win alone) and Marcel's playtest ("works great"). |
| 3 Preparation | **in progress**: 3a–3d done; **next session starts at 3e** (polish + Marcel's playtest; see "Stage 3 breakdown") |
| 4–7 | not started |

## Stage 3 decisions (Marcel, 2026-11-14)

- Preparation = **separate steps**: Squad → Formation → Fight, each a full parchment page with Back / Next.
- Backdrop of all 2D screens (title, class select, preparation) = **war table**: dark oak boards, warm candlelight vignette at the edges, parchment sheets on top, wax-seal red accents. No 3D behind them.
- Characters: class **medallions** in lists and the grid; the **real 3D figure** turning slowly on the class select and the character sheet.
- **Sandbox roster**: hero + 7 companions (field 5, bench 2): Bran, Edda (Warrior), Hilde, Wulf (Archer), Maren (Healer), Osric, Ansel (Mage). Plus a list of ~4 hand-made battles to pick from. Replaced by the campaign start and camps in Stage 5.
- Title stays **Heerschar**. The hero gets a **name typed by the player** on the class select, prefilled: Aldric (Warrior), Rowan (Archer), Isolde (Healer), Corvin (Mage).
- **Title screen**: "Heerschar" large in gold Cinzel on a hanging parchment banner, a red wax seal below, one "New Game" button (Continue comes with saving in Stage 4).
- **Class select**: one big parchment sheet; the selected class's 3D figure turns on the left; right: class name, role line, its two abilities (Q/E), name field, Choose button; four medallion tabs across the top. Role lines: Warrior "Holds the line and takes the blows.", Archer "Strikes from afar and keeps foes at bay.", Healer "Keeps the company standing.", Mage "Breaks armour with fire and frost."
- **Battle list = sealed orders**: four parchment notes on the table, each with name, intro line, enemy medallions and a red wax seal; won battles get a gold tick. Names approved: The Skirmish, The Shield Wall, The Berserker Rush, The Archer Line (intros in `STRINGS.encounters`).

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
- **2e decisions:** ability slots = drawn SVG pictograms (gold line art on a dark-brown, gold-rimmed square tile), key bottom-left, cost bottom-right, clockwise cooldown sweep with seconds, greyed when energy is short. Energy bar deep blue (`--color-energy`). Edge markers = class medallion with an outward arrow tip; endangered allies pulse red, the mark shows the red swallow-tail banner. Companions have given names: Bran (Warrior), Hilde (Archer), Maren (Healer), Osric (Mage) in `STRINGS.companionNames` until the Stage 3 roster. Ability names: Shield Bash, Whirlwind, Volley, Fall Back, Healing Circle, Blessing, Fireball, Frost Ring, Rally (`STRINGS.abilities`).
- Theme (medieval vs. stylised fantasy like WoW): **open**, to be decided around Stage 3 together with the Stage 6 asset packs (KayKit, Quaternius, Kenney). The current lit low-poly look suits a bright stylised fantasy; a dark gothic look would need lighting/palette/UI rework. A pack only replaces the 3D figures (and their hand-made poses/IK); the 2D UI is our own CSS/SVG and survives. At worst it needs a skin pass (tokens and `.parchment` / `.btn-gold` in `src/style.css`, the war table) if pack models and parchment clash. Cheap test once a candidate pack is chosen: drop one of its figures into the class select and judge the mix from a screenshot before more UI polish.
- Esc pauses (pointer lock released → pause panel).

- **3c (approved):** Squad step = one parchment, roster left ("In the field" hero + companions, then "Bench"; rows = medallion, name, class, level), character sheet right. Field/bench via a button on the sheet **and** dragging rows between the lists; a bench row dropped on a fielded companion swaps them. Sheet shows the **numbers as fought** (Health, Power, Armour, Resist, Speed, Range, attack interval) plus level and an XP bar. Empty item slots = dashed gold-brown frame with a faint sword / amulet, "Weapon"/"Trinket", "Empty".

- **3d (approved):** Formation step = **vertical field map**: enemy grid on top as seen from behind the squad (back row at the top), the squad's grid below, front rows meeting at a dashed midline. Slots are ink-ringed circles (dashed when empty) with class medallions and names below. Extras: **bench strip** under the map (drag onto a slot to swap in, drag a companion onto it to bench), **enemy note on hover** (type + threat line), **Front/Back row labels**, the **character sheet** of the clicked unit on the right. The hero: second gold ring + a small star on top.

## Made in 3d without asking (Marcel may veto)

- Copy in `STRINGS.formationStep` is a **draft**: hint "Drag to change places. Drop a bench companion on a slot to swap them in.", button "To battle", the seven threat lines (e.g. Shieldbearer "Heavy plate; steel barely scratches it. Bring magic.", Shaman "Heals and shields its allies. Mark it first.").
- Enemy names on the map are the class name in red italics, enemy rings tinted red; the map is a slightly darker panel with a double ink border; row labels run vertically on the left; the hover note is a small parchment above the enemy (it covers the row behind while shown).
- The selected unit's medallion glows gold; the hero's star is gold with an ink outline.

## Made in 3c without asking (Marcel may veto)

- Copy in `STRINGS.squadStep` is a **draft**: heading "<Battle> · Squad", hint "Drag between the lists to field or bench.", "In the field" with "n / 6", "Bench", "To the bench" / "Take the field", "The field is full. Drag onto a companion to swap.", "The hero always fights.", stat labels, "every 1.2 s", "Next".
- The hero has no attack-interval line (the player's chain sets the pace); the hero row says "Hero" instead of the class. Benched rows are a little faded. Selected row: gold tint with a gold bar on the left; drop targets tint red.
- XP to next level is a placeholder `xpToNext(level) = 100 × level` until Stage 4.
- The sheet's figure uses the same turning `FigurePreview` as the class select (the Warrior's sword tip touches the canvas edge at 1280 px).

## Made in 3b without asking (Marcel may veto)

- Copy in `STRINGS.prep` is a **draft**: "New Game", "Choose your hero", "Name", "Take the field" (class select button), "Orders" / "Choose a battle", "Won", "Return to the war table", "Back".
- Title: dark wooden rod with gold ball finials, banner with a swallow-tail bottom, gold gradient lettering, the seal carries an "H".
- Class select: the inactive medallion tabs are dimmed, the active one lifts and glows; abilities shown as the HUD pictogram tiles with Q/E; name field is an underlined Cinzel input (max 16 characters); the figure shows the hero variant (crest etc.) on a soft shadow.
- Orders: notes slightly tilted, straighten and lift on hover; enemy medallions in two rows as seen across the field (back row on top); the same medallion style as allies.
- End screen: "Fight again" and "Return to the war table" are both red buttons; the pause panel has a small text link to leave (leaving counts as not fought).
- Hero plate shows the hero's name in Cinzel with the class in italics.

## Made in 2e without asking (Marcel may veto)

- Pictogram drawings (shield + impact lines, spiral arrow + sword, three-arrow fan, leap-back arc, circle with cross, dome with cross, flame, snowflake, swallow-tail banner); active ability glows gold; a short gold flash when an ability becomes ready; the cost turns red when energy is short.
- Squad cards: medallion, name, class (or "Fallen"), red health bar like the hero's; < 30 % = the card's border glows red and the bar pulses.
- Layout: one bottom row: hero plate (health, energy with number, dodge), Q/E/R tiles, squad cards. Edge markers stay clear of the bottom row and the top plate.
- Intro controls list the hero's own ability names on the Q · E row.
- The debug overlay no longer shows energy/cooldowns (now on the HUD); lock/mark ids remain.

## 2f decisions (Marcel)

- Balance lever: **tougher armies**. In squad battles everyone has ×1.5 HP and companions and enemies hit ×1.2 harder (`SQUAD_SCALE` in `src/data/encounters.ts`); the hero's own damage stays as tuned in Stage 1, and the Stage 1 trial is untouched.
- **Hero damage share (PLAN 20–30 %) deferred to Stage 5**: it is measured (balance report) but not tuned yet. Halving the hero's damage only reached ~30–47 % because AI units attack much slower than the hero's chain; the fix belongs with levels, items and the balance suite.

## Balance after 2f (bot hero, 50 seeds, `REPORT=1 RUNS=50 npx vitest run tests/balance`)

| Hero | squad win | length | hero share | solo win |
|---|---|---|---|---|
| Warrior | 100 % | 38 s | 50 % | 2 % |
| Archer | 100 % | 40 s | 50 % | 0 % |
| Healer | 94 % | 51 s | 39 % | 0 % (stalemates to the 180 s cap) |
| Mage | 100 % | 34 s | 57 % | 0 % |

PLAN targets still missed (for Stage 5): squad win 70–90 %, length 45–150 s, hero share 20–30 %.

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
- Bot and headless (2f): `bot.ts` marks the Schamane, else the Heiler, first (cycles Tab until the lock sits on it, F, then Shift+Tab), attacks the marked enemy when it is at most 4 m farther than the nearest, dodges strikes and enemy area warnings, casts abilities when useful (situational slot first; keeps energy for Rueckzug/Frostring when enemies are within 8 m), ranged classes kite at 6 m. `headless.ts` `playHeadless(setup, maxSeconds)` → outcome, seconds, hero/player damage, events. `tests/balance/report.test.ts` is skipped unless `REPORT=1` and prints win rate, length and hero share per class, squad and solo.
- `src/data/`: `classes.ts` (4 class stat lines), `encounters.ts` (`trialSetup`, `squadSetup` = warrior hero + Krieger, Bogenschuetze, Heiler, Magier vs 3 Krieger + Bogenschuetze, Heiler, Magier), `strings.ts`.
- AI actions and behaviour numbers: `ACTIONS`, `BEHAVIOUR`, `STATUS`, `FORMATION` in `balance.ts`. Events added in 2a: `heal`, `action`, `shoot`, `areaStart`, `areaResolve`, `status`; `hit` has `absorbed`. Since 2d the game runs the squad battle (`squadSetup(seed, heroClass)`), `?trial` for the Stage 1 fight.
- `src/view/`: `scene.ts`, `arena.ts`, `camera.ts` (zoom 0..1 curve, yaw, follow, shake; tuning in `CAMERA`), `figures.ts` (`buildFigure(classId, colors, hero)` → `FigureRig` for all 7 classes; arms have elbows; `PoseStyle` melee / archer / caster), `ik.ts` (two-bone arm IK `reach` + `orient` for props), `unitView.ts` (`UnitView` interface + `PrimitiveFigureView`; animation is **posed from sim state every frame**, so hit-stop freezes it for free; melee uses the Stage 1 Euler swing poses, archers/casters are posed by hand position via IK; action → pose in `actionPose`: swing, spin, bash, roar, draw, cast, slam, hop; frost tint + shield bubble from `AnimInput.frozen/shielded`), `projectileView.ts` (`ProjectileLayer`, synced to `battle.projectiles` by id, `capture()` before each tick for interpolation), `areaView.ts` (`AreaLayer`, filling-disc warnings and heal circles), `targetMarkers.ts` (`LockRing`, `MarkBanner`), `damageNumbers.ts` (DOM numbers over the canvas, projected every frame, stack when several pop at one spot), `markers.ts` (HealthBar), `effects.ts` (sparks, dust, swing arcs, `trail`, `burst`, `rise`, `ring`).
- `src/input/`: `keyboardMouse.ts`, `heroInput.ts` (latches presses per frame and hands them to the next tick; camera-relative movement).
- `src/game/`: `loop.ts` (fixed-timestep accumulator, visibility reset), `game.ts` (glue: phases intro/playing/paused/ended, interpolation, events → effects/shake, reactive `hud` and `debug` for Vue).
- `src/ui/`: `App.vue`, `Hud.vue`, `Overlays.vue`, `ParchmentPanel.vue`, `DebugOverlay.vue`, `hud/` (medallion, ability tile and pictograms, squad card, edge marker).
- HUD check without input: with `?debug&peaceful`, set `__game.hud.phase = 'playing'`, then poke `__game.battle` (hero `energy`, `abilityCooldowns`, a companion's `hp`, `markTargetId`) and turn `__game.rig.yaw` to push units off screen.
- Reused from github.com/marceli-to/tin-wolf (Marcel's earlier game): RNG, loop, input, effects pattern. It also has synthesised SFX (`src/audio/sfx.ts`) and Kenney CC0 models, useful for Stage 6.

## Verify

- `npm test` (135 tests; bot battles in `tests/sim/bot.test.ts`: squad win ≥ 60 %, solo < 5 %, mark order, whole kit + replay per hero class; per-class and per-enemy-type behaviour in `tests/sim/squad.test.ts`, hero kit/lock/mark and full-kit determinism per hero class in `tests/sim/hero.test.ts`, test helpers `unit()`, `hold()`, `hero(x, z, classId)` in `tests/sim/helpers.ts`), `npm run typecheck`, `npm run build`. Dev server: `npm run dev` → http://localhost:5190.
- URL params: `?seed=`, `?zoom=0..1`, `?debug` (overlay + `window.__game`; shows lock and mark ids), `?bot` (bot plays the hero), `?hero=krieger|bogenschuetze|heiler|magier` (hero class), `?peaceful` (enemies stand still and never act, for trying abilities), `?trial` (Stage 1 hero-alone fight instead of the squad battle). Keys: Q/E abilities, R Sammeln, Tab / Shift+Tab lock, F mark.
- Posing check: with `?debug&peaceful`, move units into a row and set `u.state = 'windup'`, `u.stateTime`, `u.action` from `__game` during the intro (no ticks run, so poses hold); set each slot's `prev` to the new position. Infinite `energy` for tests: set `hero.energy = 100` inside an injected `heroInput.sample`.
- Driving the real game headless: with `?debug`, set `__game.hud.phase = 'playing'` and override `__game.heroInput.sample = (yaw) => ({...})` to inject presses.
- Headless checks (Chrome, needs the dev server): `node tools/shot.mjs "<url>" out.png '[{"wait":4500,"shot":"a.png"}]'` for screenshots (combat: `?bot&seed=5&zoom=0.2`), `node tools/perf.mjs "<url>"` for fps and the background-tab test. The T3 preview pane runs no animation frames, so use these instead.

## Stage 3 breakdown (do in this order, commit after each)

1. ~~**3a Data and squad rules.**~~ Done. `src/meta/squad.ts` (pure): `Character`, `SquadState` (`roster`, `fielded`, `formation`), `MAX_FIELDED` 6, `HERO_ID` 1, `setFielded`, `placeCharacter` (fielded: swap; benched onto a companion: the companion goes to the bench; never the hero), `freeSlotFor` (Krieger front, others back, centre first), `battleSetupFor(squad, encounter, seed)`. `src/data/roster.ts`: `SANDBOX_COMPANIONS`, `newSquad(heroClass, heroName)`. `src/data/encounters.ts`: `ENCOUNTERS` (skirmish, shieldWall, berserkerRush, archerLine) with enemy slots and a `strength` multiplier on enemy HP and power (1.5 / 2 / 1.5 / 1.3; stands in for enemy levels until Stage 4); `squadSetup` stays the Stage 2 battle at strength 1. Encounter names/intros in `STRINGS.encounters` (approved). `tests/meta/prepMatters.test.ts` proves the "done when" headless (skirmish without the healer ≥ 30 points fewer wins, hero in the back row ≥ 20 fewer; shield wall with two mages < 0.8 × the time without a mage). `REPORT=1 npx vitest run tests/balance/prep.test.ts` prints a composition/formation table per encounter. Note: enemy columns mirror (`slotPosition`): enemy col 0 stands opposite player col 2, so the preview must show the enemy grid as seen from the player side.
2. ~~**3b Flow, title, class select.**~~ Done. `src/ui/session.ts` (reactive `session`: `screen` title / classSelect / orders / battle, `squad`, `encounterId`, `won`, `battleRun`; no saving until Stage 4). `App.vue` switches screens; `BattleView.vue` mounts a `Game` per battle (keyed by `battleRun`) and disposes it on leave (renderer `forceContextLoss`). `Game` now takes a `BattleSpec` (`src/game/specs.ts`: `encounterSpec(squad, id)` snapshots the squad, `trialSpec`); unit names come from `spec.names` (index = unit id − 1), `STRINGS.companionNames` is gone. Screens in `src/ui/screens/`: `WarTable` (CSS oak boards + SVG-noise grain + flickering candle glow + vignette), `WaxSeal` (SVG), `FigurePreview` (own small transparent renderer, `PrimitiveFigureView` idling and turning), `TitleScreen`, `ClassSelect`, `OrdersScreen`. HUD: hero plate shows the hero's name + class; squad cards shrink to fit five in one row; max HP rounded. End and pause panels have "Return to the war table". URL params `?bot`, `?hero=`, `?battle=<encounterId>`, `?peaceful`, `?trial` skip the screens with the sandbox squad (hero named by the suggestion); `?seed=` fixes the first battle's seed. **Gotcha**: a dev server started before new `.vue` files exist can serve stale Tailwind CSS (new classes missing); restart it (or run a second one with `npx vite --port 5191`).
3. ~~**3c Squad screen and character sheet.**~~ Done. Flow: orders → `prepare(id)` → `screen: 'squad'` (`SquadScreen.vue`) → Next starts the battle directly until 3d adds the Formation step in between; Back returns to the orders; leaving a battle still returns to the orders. `CharacterSheet.vue` (figure, ledger, XP, `ItemSlot.vue`). Pure helpers in `src/meta/squad.ts`: `characterStats(c)` (= the battle stats, tested against `battleSetupFor`), `swapIn(state, benchedId, fieldedId)`, `xpToNext`. Drag and drop is native HTML5 (`dragId` ref; drop on the field list, the bench list or a fielded row). Headless drag test: dispatch `DragEvent`s with one shared `new DataTransfer()` (dragstart on the source row, dragover + drop on the target); Vue re-renders on the next tick, so read the DOM in a later step.
4. ~~**3d Formation grid.**~~ Done. Flow: orders → squad → `screen: 'formation'` (`FormationScreen.vue`, `FieldToken.vue`) → "To battle"; Back returns to the squad step. Pure helpers in `src/meta/squad.ts`: `canPlace(state, id, slot)` (same rules as `placeCharacter`, no mutation; tested against it for every character × slot) and `enemyViewCol(col)` = 2 − col (tested against `slotPosition`). Everyone, the hero too, can move on the grid; the hero never goes to the bench; a bench companion cannot replace the hero. Drag test as in 3c (cells: `.cell`, first 6 = enemy, then the squad's front row, back row; bench chips `.chip`, bench zone `.bench`).
5. **3e Polish and Marcel's playtest** ("done when": composition and formation visibly change how a battle goes).

## Stage 2 breakdown (done)

PLAN sections: 5 (rules, statuses), 6 (classes, enemy types, companion behaviour), 7 (hero abilities, energy, leader ability, mark), 8 (lock-on, HUD), 13 (bot, tests).

1. ~~**2a Sim: squad and classes.**~~ Done. Notes: Krieger taunt fires when ≥ 2 non-hero foes are within 6 m (the hero is never taunted); Bogenschuetze uses its piercing shot whenever it is off cooldown; Heiler casts a weak magic bolt (0.5 × power) when nobody needs healing; frost nova also deals a little damage (0.4 ×). First numbers on `squadSetup` (30 seeds): Stage 1 bot hero wins 29/30, ~27 s per battle, hero ≈ 45 % of player damage (target 20–30 %, tune in 2f); an idle hero loses all. Original 2a brief: Generalise `ai.ts` per class (Krieger intercepts and taunts, Bogenschuetze kites and shoots lowest HP, Heiler heals lowest fraction (hero first on ties), Magier casts at clusters + frost nova). Projectiles (straight and arcing, aim at the current position), area effects (telegraphed circles 0.8–1.5 s), heals, statuses (frozen, stunned, marked, rallied, shielded). Formation setup: 3 × 2 slots per side, about 24 m apart. Companion abilities. Tests for each.
2. ~~**2b Sim: hero kit.**~~ Done (see "Feel decisions made in 2b"). Original brief: Energy (start 30, +4/s, +5 per landed basic attack), Warrior abilities Schildstoss / Wirbel (and the other three classes' sets), leader ability Sammeln (rallied 6 s), lock-on (Tab / cycle / Shift+Tab), mark (F). Extend `HeroInput`. The hero has no self-heal unless Heiler (reduced).
3. ~~**2c Enemy types.**~~ Done. `ClassId` = `PlayableClassId | EnemyTypeId`. Stats in `CLASS_STATS` (first numbers): Schildtraeger 170 HP, armor 110, resist 0, speed 3.0, plain melee on the nearest foe; Berserker 95 HP, speed 5.4, interval 0.9, goes for healers (Heiler/Schamane) first, then the nearest back-row foe, **ignores the 2-attacker cap**, still taunt-able; Schamane shares `supportBrain` with the Heiler (heal lowest fraction, bolt, stay back) plus the AI ability `ward` (shields the most hurt ally that a foe within 4 m is targeting, 2.5 × power for 8 s, cooldown 9). `squadSetup` enemies are now Schildtraeger, Krieger, Berserker (front) and Bogenschuetze, Schamane, Magier (back). 30 seeds: bot hero wins 24/30, ~31 s, hero ≈ 57 % of player damage (tune in 2f); idle hero loses 30/30. English names in `STRINGS.classes`. All units still render as the warrior figure.
4. ~~**2d View.**~~ Done (see "2d decisions" and "Made in 2d without asking"). All 7 class figures, projectiles with trails, filling-disc warnings, heal glow, frozen blue, shield bubble, lock ring, mark banner, damage numbers; the game runs the 5-vs-6 squad battle. 60 fps in the bot battle.
5. ~~**2e HUD.**~~ Done (see "2e decisions" and "Made in 2e without asking"). `HudState` gains `energy`, `abilities`, `squad`, `edgeMarkers` (built once per battle in `buildHudLists`, values updated in `updateHud`; edge markers projected in `updateEdgeMarkers`, list only replaced when it changes). Components in `src/ui/hud/`: `ClassMedallion`, `AbilityIcon`, `AbilitySlot`, `SquadCard`, `EdgeMarker`. 60 fps in the bot battle.
6. ~~**2f Bot and headless test.**~~ Done (see "2f decisions" and "Balance after 2f"). Also: ability cooldown labels under 1 s round up to the tenth (no more "0.0").
7. **Done when:** a 5-against-6 battle is readable and winnable, the determinism test passes, and the bot cannot win it alone. Met: tests pass and Marcel playtested it ("works great").
