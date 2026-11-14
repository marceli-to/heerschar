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
| 3 Preparation | done, committed. **Gate passed**: headless `prepMatters` test and Marcel's playtest ("feels alright, but quite hard to win"). |
| 4 Progression | **in progress**: 4a–4e done; next the **gate playtest** (see "Stage 4 breakdown"). PLAN sections 4, 10, 12, 14. |
| Look spike | **done**: KayKit family (Adventurers + Skeletons) and all four effects at their current strength (see "Look spike as built"). |
| 5 Campaign | **in progress**: 5a–5d done (5c and 5d waiting for Marcel's look at the screenshots); next 5e ending summary (see "Stage 5 breakdown"). PLAN sections 10, 13, 14. The Stage 4 gate playtest can still happen any time alongside. |
| 6–7 | not started |

## Stage 5 decisions (Marcel, 2026-11-14)

- Map = **one parchment map sheet per region** on the war table: inked terrain, dotted roads between nodes, nodes as wax seals with a small pictogram (battle, elite, camp, boss). Won nodes get the gold tick, unreachable ones faded. Region tabs to switch.
- Regions: **The Greenmarch** (meadows, farms) → **The Darkwood** (forest) → **The Barrowlands** (graves, the undead rise).
- Start: hero + **Bran (Warrior) and Maren (Healer)**. Each camp offers **two companions of different classes**, drawn seeded from a name pool; pick one. Early battles are smaller (3 vs 3–4).
- Bosses: R1 **the Iron Warlord** (giant armoured brute: axe sweep, charge, slam, calls raiders); R2 **the Fen Witch** (slam = poison circles, summons wolves/shamans, heals her escort); R3 **the Bone King** (skeletal giant, raises fallen enemies).
- Boss figures (primitives until Stage 6): **big + signature props**. Iron Warlord ~1.6× size, dark iron plate, horned helm, huge two-handed axe; Fen Witch ~1.4×, hooded robe of rags, crooked staff with a green glow; Bone King ~1.7×, pale bone body, rusty crown, greatsword, glowing blue eyes.
- The Witch summons a **new wolf unit**: small, fast, low-health four-legged melee unit, simple primitive wolf, grey fur; only she summons them.
- Boss telegraphs: the **same red-orange filling disc** for Warlord and Bone King (sweep = filling arc, charge = filling lane); the Witch's poison circles are **sickly green and linger briefly** after they hit.
- Camps: **must pick one**; leaving without a recruit only when the roster is full (`passCamp`).

## Stage 5 breakdown (do in this order, commit after each)

1. ~~**5a Campaign rules and data.**~~ Done. `src/data/campaign.ts`: `REGIONS`, `NODES` (24: per region a first battle that forks, upper road with the elite, lower road with the camps, both meet at the boss; x/y 0..100 for the map sheet), `nodeById`, `regionNodes`, `regionStart`, `regionBoss`, `FINAL_BOSS`, `isCampId`. Fight nodes use their encounter id as node id. `ENCOUNTERS` = the 18 campaign battles (5 new: raiders, farmstead, graveWatch, boneLegion, cryptRoad; 3 bosses with escort only, boss units come in 5b), levels follow the expected squad level. XP pools = per-character target × expected fielded count; the walk test (`tests/meta/campaign.test.ts`, every node in map order) gives hero level 6 / 12 / 18 at the bosses. `src/meta/game.ts`: `GameState.camps` (`CampState` = offers + done), `GAME_VERSION` 2, `isNodeDone`, `isRegionOpen`, `isNodeOpen` (region open and start node or a done node leads here; done nodes stay open for replays), `isUnlocked` = `isNodeOpen`, `campaignWon`, `recruitLevel`, `campOffers` (lazy, seeded, kept), `recruit`, `passCamp`. `ROSTER_LIMIT` 9 in `squad.ts`. Save: migration 1 → 2 adds `camps: {}`; camps and roster size validated. `newSquad(hero, name, companions = START_COMPANIONS)`; dev shortcut games (`startDevGame`) get `SANDBOX_COMPANIONS`. Tests that relied on the 7-companion roster pass `SANDBOX_COMPANIONS`; `prepMatters` plays skirmish / shieldWall at their Stage 3 levels. Interim: the orders screen lists all 18 battles; camps have no screen yet, so a new game stalls after the first battle's roads until 5c/5d.
2. ~~**5b Bosses.**~~ Done (see "5b as built"). Screenshots for Marcel in `~/Downloads/heerschar-assets/bosses-5b/`.
3. ~~**5c Map screen**~~ Done (see "5c as built"). Screenshots for Marcel in `~/Downloads/heerschar-assets/map-5c/`.
4. ~~**5d Camp screen**~~ Done (see "5d as built"). Screenshots for Marcel in `~/Downloads/heerschar-assets/camp-5d/`.
5. **5e Ending summary** (time, battles lost, squad with levels) → title; the save can continue. Needs play time tracking.
6. **5f Balance**: suite per PLAN section 13 (each encounter at the expected squad level, standard 70–90 %, elite 45–70 %, boss 35–60 %, length 45–150 s, hero share 20–30 %, solo < 5 %), tune strength; update `tests/balance/chain.test.ts` to walk the map.
7. **Gate:** campaign playable start to finish, balance targets hold.

## 5d decisions (Marcel, 2026-11-14)

- Recruit card = tall parchment card: turning 3D figure, name, class · level, path + upgrade tiles, stats as fought.
- Picking = select (gold frame), then confirm with a button.
- The current company shows under the cards as a row of class medallions with names.

## 5d as built

- `src/ui/screens/CampScreen.vue` (session screen `'camp'`, `session.campId`, `openCamp(id)`; App opens it for an open, not-done camp seal; done / Back → map). Offers via `campOffers` (drawn on the first look, kept in the save). Confirm button reads "Choose a recruit" (disabled) until one is selected. Full roster: cards dimmed and not selectable, hint changes, "Move on" = `passCamp`.
- `RecruitCard.vue` (card above; `role="button"`, `aria-pressed`, Enter / Space). `PathUpgrades.vue` = the path + upgrade tiles with hover notes, extracted from `CharacterSheet.vue` (which now uses it).
- Fix: `recruit()` copied the offer with `structuredClone`, which throws on the Vue proxy the screens hold; now a plain copy (test: recruiting on a `reactive` state).
- Screenshot recipe as in 5c; the camp seal is the first `button.seal.live` after winning `raiders`.

## Made in 5d without asking (Marcel may veto)

- Copy (draft, `STRINGS.camp`): "Camp", "Travellers by the fire offer their swords. Choose one to join the company.", "Take into the company", "Choose a recruit", "Your company (n / 9)", "The company is full. No one more can join.", "Move on".
- Recruit figures in the player colours; selected card = lifted, brighter gold border + soft gold glow; stat lines Health, Power, Armour, Resist, Range, Attacks (no Speed, to keep the card short). Back to the map without picking is allowed (the camp stays open).

## 5c decisions (Marcel, 2026-11-14)

- Seals coloured by kind: battle = red wax, crossed swords; elite = black wax, sword under a star; camp = green wax, tent; boss = larger red wax, crown. Open-but-not-done seals glow softly.
- Node detail = hover note (name, LEVEL n, enemy medallions, intro); clicking an open seal goes straight to the squad step.
- Region tabs = cloth bookmark ribbons hanging over the sheet's top edge; locked regions greyed with a small lock, not clickable.
- Terrain = light ink sketches between the roads, faint wash per region, region name in a cartouche, small compass rose.

## 5c as built

- `src/ui/screens/MapScreen.vue` replaces `OrdersScreen.vue` (deleted); session screen `'orders'` is now `'map'` (`AfterSpoils` too). The sheet shown first: the last fought node's region while its boss stands, else the furthest open region (`lastNode` prop = `session.encounterId`).
- `src/ui/screens/mapSketch.ts`: 1000 × 600 sheet, `regionRoads` (quadratic curve per road, seeded bend), `regionMarks` (seeded jittered grid of ink glyphs, kept clear of seals, roads, cartouche, compass and the ribbons), `GLYPHS` (field, tuft, tree, pine, hill, cottage, mound, cross, stone, deadTree; weights per region).
- `WaxSeal.vue` gained `wax` (`red` / `black` / `green`) and `icon` (`swords` / `elite` / `tent` / `crown`), unique gradient ids. `HoverNote` gained `below` (seals in the top 40 % show their note underneath).
- Camps: clicking an open camp emits `camp`; App does nothing with it until 5d. Done camps are not clickable.
- Screenshot recipe (no UI path to a mid-campaign save): `/tmp`-style script that `import('/src/ui/session.ts')` in the page, calls `startNewGame`, pushes wins / marks camps done (this writes the save), then reload and click Continue.

## Made in 5c without asking (Marcel may veto)

- Copy (draft): "Choose your road", "Camp", camp note "Travellers by the fire offer their swords. One may join the company.", "Visited", "Not yet reached", "· Elite" / "· Boss" after the level, locked ribbon note "Defeat the boss of the region before: <region>". The old orders strings are gone.
- Walked roads (leaving a done node) dark dots, others faint; unreachable seals washed out toward the parchment (opaque); done seals get a round gold tick badge. Hover notes also show for unreachable seals (planning ahead). Region washes: soft green (Greenmarch), olive (Darkwood), grey (Barrowlands). Seal sizes 54 / elite 56 / boss 74 px.

## 5b as built

- **Classes**: `BossId` = `kriegsherr` (Iron Warlord), `sumpfhexe` (Fen Witch), `knochenkoenig` (Bone King); `EnemyTypeId` gained `wolf`. Stats in `CLASS_STATS`, growth in `LEVEL_GROWTH` (first numbers). They sit in the boss encounters' formation slots: Warlord front centre of ironWarlord (replaces the Shieldbearer), Witch back centre of fenWitch (replaces a Shaman), Bone King front centre of boneKing (replaces the Shieldbearer).
- **Bodies** (`src/sim/body.ts`): `isBoss`, `bodyRadius` (`BODY_RADIUS`: Warlord 0.85, Witch 0.7, King 0.95, wolf 0.4, others 0.5), `knockbackFactor` (bosses 0.15), `bodyMass` (bosses 6: separation pushes others aside). Hits, areas, projectiles, separation and bounds use the body radius. `stun()` and `freeze()` do nothing to bosses (taunts and slows still work).
- **Actions** (`BOSS_ACTIONS` in `balance.ts`, brains in `ai.ts`): a boss acts once per beat (its attack interval, also after specials). Warlord / King (`bruteBossBrain`): summon (Warlord) or raise (King) → charge a far back-row foe (or the taunter) → slam when 3+ foes within 12 m → sweep when the target is within 4.4 m → else the heavy swing (`BOSS_STRIKE`, reach 2.9). Witch (`witchBrain`): mend (heals every ally but herself within 14 m when one is below 70 %) → summon → poison (green circles under the 4 nearest foes) → else hex bolts from range, kiting like a caster. Telegraphed actions place their warning when the windup starts and do not turn during it (`FIXED_AIM`). The charge's lane is a warning only (no damage); the boss then dashes 14 m in 0.4 s (`dash`) hitting each foe it passes once (knockback, short stagger; a dodge evades). Summons: `SUMMONS` (Warlord: Warrior + Berserker; Witch: three wolves, then a Shaman, cycling), first only below 85 % health, at most 3 alive, entering from the boss's edge (x = ±19); stats from `Battle.reserves` (`enemyReserves(encounter)` = encounter level and strength × `SUMMON_STRENGTH` 0.7; `battleSetupFor` passes them). Raise: up to 2 fallen non-boss allies, each once (`Unit.raised`), at 50 % health. New events `spawn`, `raise`; `areaResolve` has `angle`.
- **Areas** have a shape (`circle` / `arc` / `lane`, plus `angle`, `arc`, `length`, `knockback`); `insideArea(a, pos, r)` in `projectiles.ts` is shared by the sim and the bot. Bot dodges every shape (sideways out of a lane); its old circle behaviour is unchanged (all earlier tests pass as before).
- `createUnit` moved to `src/sim/units.ts` (summons need it from `ai.ts`). New `Unit` fields: `hitIds`, `summonerId`, `raised`.
- **View**: bosses are the humanoid rig scaled (`BOSS_SCALE` 1.6 / 1.4 / 1.7) with own colours (`BOSS_COLORS`) and props (`greatAxe`, `greatsword`, witch staff); poses: sweep = heavy swing, slam = overhead chop (new `chop` pose), charge = shoulder bash, summon / raise = roar, mend = staff slam. Wolf = own `WolfView` (`src/view/wolfView.ts`: trot, crouch, bite lunge, roll over), picked by `createUnitView` (`src/view/createView.ts`). `AreaLayer` draws filling arcs and lanes (lane fills from the boss outward) and green poison that lingers 1.6 s. Hex = green bolt. `Game.addUnit` builds views for summoned units on `spawn`; raise = blue burst + ring.
- **Tests**: `tests/sim/boss.test.ts` (immunities, push, arc / lane shapes, sweep, charge + sideways dodge, slam, summons, poison, mend, raise once, bot determinism in all three boss battles). Report: `REPORT=1 [STR=1] [SWAP=schildtraeger] npx vitest run tests/balance/boss.test.ts`.
- **Numbers for 5f**: with the bare sandbox squad at the encounter level (no upgrades, no items) the bot loses the boss battles at their encounter strength, but it loses them with a plain Shieldbearer in the boss slot too (the known fragile-hero problem). At strength 1: Warlord 80–85 % / 68 s, Witch 100 % / 45 s (too easy), Bone King 100 % / 93 s; the same battles with a Shieldbearer instead: 100 % / 32–39 s. Boss base stats were cut once (Warlord 420 HP / 13 power, Witch 320 / 12, King 460 / 14) after a first try at ~600 HP / 20 power won nothing.

## Made in 5b without asking (Marcel may veto)

- Which boss does what: the Warlord and the Bone King share sweep, charge and slam (the Warlord calls raiders, the King raises); the Witch has no melee kit (poison, mend, summon, hex bolts). The Witch's poison only hits once; "linger" is visual only.
- Copy (draft): class names "Wolf"; monograms Wo, IW, FW, BK; formation threat lines for the four new types (`STRINGS.formationStep.threats`).
- Looks within the approved brief: Warlord helm with an eye slit and two bone-coloured curved horns, plate ridges, dark tasset skirt, double-headed axe with a top spike; Witch hunched, deep pointed hood, shadowed face with two green eyes, long nose, rags hanging from the hem, gnarled hooked staff; Bone King ribcage around a spine, tattered rust-red cape, skull with blue eyes in dark sockets, rusty five-spike crown, long greatsword with a rusty guard. Wolf 1.25× the first build so it reads at a distance. Effects: sweep = swing arc + dust + light shake; slam = stone dust burst + ring + shake; poison = green burst and rising motes; charge = dust along the run; summon = a ring (green for the Witch, gold-orange for the Warlord); mend = a wide green ring; raise = blue burst + ring at the risen.
- **Boss bar (Marcel, 2026-11-14):** a parchment plate under the Foes / Time plate with the boss medallion, "The <name>" in Cinzel, health numbers and a long red bar (`HudState.boss`, `Hud.vue`); it fades out when the boss falls. The small bar over the boss's head is hidden. Name in ink rather than gold, for contrast on parchment (made without asking).

## Made in 5a without asking (Marcel may veto)

- Map layout and which battle sits where (Greenmarch: raiders → camp / farmstead → archerLine → shieldWall (elite) / camps → Iron Warlord; Darkwood: skirmish … wolfPack (elite) → Fen Witch; Barrowlands: ambush … boneLegion + warband (elites) → Bone King, no camps). Elites are optional side roads.
- Recruits join at the roster's average level (rounded down) with a path and upgrades already drawn, so the camp compares two finished characters. Recruit name pool (`RECRUIT_NAMES`, draft). Names of the five new battles and the boss intros (`STRINGS.encounters`, draft).

## Stage 4 decisions (Marcel, 2026-11-14)

- Level-up picks (one of three) and the path choice at level 5 happen **right after the battle**: XP bars fill, then each character who levelled gets a pick page in turn, then loot.
- Loot = a **Spoils page** on the war table after the end panel: three item cards, pick one; it goes to the shared inventory (equip now or later).
- The ten-battle chain = **sealed orders unlocked in sequence**; won ones keep the gold tick and can be replayed for nothing. Stage 5's map replaces it.
- Items: **class weapons + shared trinkets**; mostly stat bonuses, rare/epic add a small effect.
- Rarity = **ink / silver / gold frames** (epic with a soft glow), rarity word in small caps under the name.
- Item pictures = **drawn SVG pictograms** like the ability tiles (gold line art on the dark-brown gold-rimmed tile).
- Title with a save: **Continue** (main gold button) above **New Game**; New Game over a save asks "Abandon your current company?" Confirm / Back.
- Upgrade choice = **three parchment cards** with a pictogram tile on top, name in Cinzel, one-line effect, kind (Stat / Ability / Passive) in small italics; hover lifts.

## 4e decisions (Marcel, 2026-11-14)

- Orders = **5 × 2 small notes** on one screen: seal on top, name, "LEVEL n" in small caps under it, small enemy medallions; the intro line shows in a hover note.
- Locked = **folded, darker sheet, seal intact** in the middle, "Sealed", not clickable.
- Won = gold "✓ Won" tick plus a small italic line "Replay: no spoils".

## Visual outlook (talked through 2026-11-14)

- Marcel asked how good Stage 6 can look. Answer given: the pack gives bodies and animation; the "cool" comes from code (bloom, particles, trails, decals, grading, outlines, hit feel). Watch-outs: KayKit's chunky proportions vs. the heroic proportions chosen in Stage 1 (Quaternius closer), phone budget in Stage 7, bosses / Shaman details may not exist in a pack. Marcel wants the **look spike before Stage 5**.

## Look spike as built (2026-11-14)

- Open `http://localhost:5190/?look`. Keys: 1 glow (bloom), 2 sparks/dust/trail, 3 warm grade + haze + soft shadows, 4 ground marks, V camera (overview, KayKit close, Quaternius close, high game view), O orbit, P pause, H hide HUD; drag to look. URL: `fx=1010` sets the four toggles, `view=1..4`, `freeze=T` pauses at T s of the 12 s loop (screenshots).
- Code in `src/look/` (actors, fx, post, lookSpike); `src/main.ts` loads it only with `?look`, the game never imports it. Models in `public/look/` (KayKit Knight + Mage, Quaternius Warrior + Wizard; ~13 MB, also copied into `dist`; drop the folder once a pack is chosen). Each pair: melee figure hits a dummy twice, caster throws a fireball, shield bubble + hit, frost ring, walk loop, holy light, death and back up.
- Screenshots + a 12 s WebM for Marcel in `~/Downloads/heerschar-assets/look-spike/`. Tools: `tools/shot.mjs` (stills) and new `tools/record.mjs` (CDP screencast → WebM via Playwright's ffmpeg, the Homebrew ffmpeg is broken here).
- fps: 60 (vsync-capped) in headless Chrome and the preview with all four effects on.
- Things noticed: both packs are chibi (big heads), Quaternius somewhat less; neither matches the heroic proportions of the code figures. KayKit has far more clips (several 1H/2H attacks, block, dodge, spellcasts, hit A/B, death A/B); Quaternius has 13–15 per character (one or two attacks, one hit, spells only on Wizard). Quaternius Warrior is a woman; KayKit Knight's swing trail reads as a wide ghost blade because the sword is huge.
- **Pack decision (Marcel, 2026-11-14): KayKit family.** He leaned KayKit over Quaternius; alternatives were shown (Quaternius Universal Base Characters + Fantasy Outfits + Universal Animation Library for heroic proportions; paid Synty) and he chose "stay with KayKit, the wider family, add Skeletons". So the spike now shows KayKit Adventurers (Knight + Mage, left) and KayKit Skeletons (Warrior with blade + large shield, Mage with staff, right); Quaternius files removed from `public/look/` (the zip stays in `~/Downloads/heerschar-assets/quaternius/`). Both KayKit packs share one rig and clip set (Skeletons add Spawn_Ground_Skeletons, Death_C_Skeletons + _Resurrect, Awaken, Walking_D_Skeletons; weapons are separate .gltf files parented to `handslot.r/l`). Both are on GitHub (`KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0`), fetchable by script; paid extras (Adventurers EXTRA, Mystery series, same rig) are an option later. Loop is now 14 s (skeleton gets back up with the resurrect clip).
- This implies stylised fantasy with chunky proportions, replacing the Stage 1 "heroic proportions" decision for the final look (confirm with Marcel when Stage 6 starts).
- **Effects decision (Marcel, 2026-11-14): keep all four, strength as in the spike** ("just fine"). Stage 6 ports them from `src/look/fx.ts` + `post.ts` (bloom threshold 1.3 / strength 0.6, grade, marks fade 11 s) into the real view.
- **Next:** Stage 5 (PLAN section 14).

## Look spike plan (Marcel, 2026-11-14)

Goal: show Marcel what Stage 6 can look like before Stage 5 builds on the current visuals. A throwaway-friendly test, kept out of the real game.

- **Packs: both, side by side.** One KayKit figure (chunky, polished; KayKit Adventurers) next to one Quaternius figure (closer to heroic proportions), same arena, same effects. Verify each licence first (both are expected to be CC0) and record it in `CREDITS.md`. If a download cannot be scripted (itch.io / Google Drive), ask Marcel to download the zip and say where it is. Put downloads in their own new directory (untrusted data rule).
- **Downloads (checked 2026-11-14):** KayKit Adventurers 1.0 is on GitHub (`KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0`, CC0 per its LICENSE.txt; rigged `.glb` characters Knight, Barbarian, Mage, Rogue, RogueHooded under `addons/kaykit_character_pack_adventures/Characters/gltf/`), so it can be fetched by script. Quaternius **"RPG Character Pack"** (https://quaternius.com/packs/rpgcharacters.html; 6 animated fantasy characters, glTF, CC0 per the site; check its License.txt) is only on Google Drive, so **Marcel downloaded it by hand** (2026-11-14); he attaches it in the new session or it lies in `~/Downloads/heerschar-assets/quaternius/`. Ask him where if it is not there. Not this one: "Ultimate Modular Men" (modern people: suits, punks, spacesuits; only King / Adventurer fit) is also in that folder as `individual-characters.zip`, kept for now, not for the spike.
- **Effects: all four.** (1) Glow on magic (bloom on fireball, frost, holy light, shields, lock ring); (2) hit sparks + dust and a bright swing trail; (3) light and colour grade (warmer grade, slight distance haze, softer shadows); (4) ground marks (scorch after fire, frost on the grass).
- Engineering (no need to ask): behind a URL flag (e.g. `?look`), so normal play and tests are untouched; models loaded with `GLTFLoader` and played with `AnimationMixer` (idle / walk / attack / hit / death); a simple scripted loop (the two figures attack dummies, cast a fireball and a frost ring) so screenshots and a short recording are easy. Check fps stays at 60 on desktop.
- Deliverable: screenshots (and a short recording if possible) for Marcel, then his verdict on pack and style. That also settles the open theme question (medieval vs. stylised fantasy) and the hero proportions.

## 4d decisions (Marcel, 2026-11-14)

- Clicking an item slot opens a **parchment popover** under it: "Take off" on top when something is worn, then one row per fitting item (pictogram tile with rarity rim, name, ×n for doubles, rarity small caps, effect lines). Click outside or Escape closes.
- Hovering an item there **previews the stats** on the ledger: new value plus a small delta, gold = better, wax red = worse.
- Path and upgrades = **row of small tiles** under the XP bar: path tile + name first, then one tile per upgrade with a ×n badge; hover → note with name, kind and effect.
- Filled slot = the item's **pictogram tile with its rarity rim** (ink / silver / gold with glow); empty stays dashed.

## Made in 4d without asking (Marcel may veto)

- When the popover would leave the window (e.g. 800 px tall), it opens **to the left of the slot, over the figure**, so the ledger stays visible for the preview.
- Long item names under a slot are cut with "…"; the hover note shows the full name, rarity and effect lines.
- Copy (draft, `STRINGS.squadStep`): "Take off", "Nothing in the baggage fits.", "Path & upgrades", "No upgrades yet.", note kind "Path", "(each)" after a repeated upgrade's effect line.
- Baggage order: epic, rare, common, then item list order.

## Made in 4c without asking (Marcel may veto)

- Copy in `STRINGS.spoils` is a **draft**: "Spoils", "Experience shared among the company.", "Bench, half share", "Level up", "Choose an upgrade" / "Choose a path", "Pick n of m", "Choose one to keep. It goes to the company's baggage.", "<Class> weapon" / "Trinket, for anyone", "Next".
- XP page = one parchment list (fielded in field order, then the bench faded), bars fill over ~1.6 s with a gold "Level up" popping in; level and +XP count up. Pick pages: Spoils heading + "Pick n of m", the character's medallion, name, class · level in parchment colour on the table, then the cards. Path cards also show the path's line (`STRINGS.paths[..].text`) in italics above the effect lines. Item cards: rarity word in small caps (ink / slate / gold), then who can use it.
- Rarity frames: common = 2 px ink border, rare = silver-grey border with slate outline, epic = light-gold border with a soft gold glow.
- 26 pictogram drawings (`src/ui/Pictogram.vue`): heart, gauntlet fist, shield with cross, war horn, drop, boot, eye, arrow, bow with nocked arrow, healer cross, sun, hourglass, flame, snowflake, star, eight-point burst; sword, staff with orb, wand with sparkle, ring with gem, amulet, fang charm, coin with star, feather.
- No "leave the loot" option on the spoils (one item must be taken; `takeLoot(null)` exists if wanted). After a reload mid-picks the counter restarts ("Pick 1 of 5"), since the total is not saved.

## Made in 4a without asking (Marcel may veto)

- Path names (draft, `STRINGS.paths`): Warden / Reaver (Warrior; "Berserker" is taken by the enemy type), Marksman / Hunter, Priest / Battle Monk, Pyromancer / Frostweaver. Upgrade names (`STRINGS.upgrades`), item names (`STRINGS.items`), effect lines (`STRINGS.effects`) and the six new battle names/intros (The Ambush, The Shamans' Grove, The Burning Field, The Iron Column, The Wolf Pack, The Warband) are draft copy.
- Path signatures (each "changes one ability"): Warden = Taunt / Shield Bash also shield the warrior (1.5 × power, 6 s); Reaver = Taunt / Whirlwind also rally him (4 s) + 8 % damage; Marksman = 20 % crit; Hunter = arrows slow 2 s + 10 % speed; Priest = +25 % healing and area; Battle Monk = +40 % damage, 15 % lifesteal; Pyromancer = +30 % area, +10 % damage; Frostweaver = control effects +1.5 s.
- Level 5 is a path pick **instead of** an upgrade pick. Crits deal ×1.5. A filler upgrade "Seasoned" (+5 % health and power) tops up an offer when a character's pools run dry.
- The four Stage 3 battles keep their order and open the chain; their strengths changed slightly with enemy levels (see `ENCOUNTERS`).

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

- **3e (approved):** end panel **ledger** per squad member (medallion, name, dealt / taken / healed; fallen = medallion and name greyed; biggest number per column in gold) and a **"Change squad"** button next to "Return to the war table" (back to the Squad step of the same battle). Column labels "Dealt / Taken / Healed" and "Fallen" are draft copy.

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

**Ranged heroes are too fragile (Marcel's 3e playtest, 2026-11-14; fix deferred to Stage 5 by Marcel).** Marcel found the Archer hero "very, very difficult". Probe (bot, 20 seeds per cell, sandbox squad, win %): Skirmish Warrior 100 / Archer 10 / Healer 5 / Mage 5; Shield Wall 95 / 25 / 0 / 35; Berserker Rush 85 / 100 / 85 / 85; Archer Line 80 / 100 / 65 / 75. Cause is not damage: raw chain DPS Warrior 32.8, Archer 28.3, Mage 29.7, Healer 20.3, and the hero share is already ~45–60 %. In the Skirmish the Archer hero died in 18 of 20 battles, **all of it from the enemy archer**: `archerBrain` shoots the lowest-health foe in range, so once the hero (120 HP, armour 10) is hit he stays the weakest and gets focused down in ~10 s; the hero falling loses the battle. Arrows are physical, so the Archer also stalls on the Shield Wall (armour 110). Options offered: hero health bonus over the same-class companion (recommended), ranged enemies target by health fraction / switch targets, more Archer power (against the 20–30 % share target).

**Marcel after more battles (2026-11-14):** "feels alright but it's quite hard to win"; **"the hero should definitely deal more damage"**. This conflicts with PLAN's 20–30 % hero damage share (bot share is already ~45–60 %). Raise it at the start of Stage 5: drop or raise the share target, and pair more hero damage with more hero health so ranged heroes survive.

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

- `npm test` (206 tests; bot battles in `tests/sim/bot.test.ts`: squad win ≥ 60 %, solo < 5 %, mark order, whole kit + replay per hero class; per-class and per-enemy-type behaviour in `tests/sim/squad.test.ts`, hero kit/lock/mark and full-kit determinism per hero class in `tests/sim/hero.test.ts`, test helpers `unit()`, `hold()`, `hero(x, z, classId)` in `tests/sim/helpers.ts`), `npm run typecheck`, `npm run build`. Dev server: `npm run dev` → http://localhost:5190.
- URL params: `?seed=`, `?zoom=0..1`, `?debug` (overlay + `window.__game`; shows lock and mark ids), `?bot` (bot plays the hero), `?hero=krieger|bogenschuetze|heiler|magier` (hero class), `?peaceful` (enemies stand still and never act, for trying abilities), `?trial` (Stage 1 hero-alone fight instead of the squad battle). Keys: Q/E abilities, R Sammeln, Tab / Shift+Tab lock, F mark.
- Posing check: with `?debug&peaceful`, move units into a row and set `u.state = 'windup'`, `u.stateTime`, `u.action` from `__game` during the intro (no ticks run, so poses hold); set each slot's `prev` to the new position. Infinite `energy` for tests: set `hero.energy = 100` inside an injected `heroInput.sample`.
- Driving the real game headless: with `?debug`, set `__game.hud.phase = 'playing'` and override `__game.heroInput.sample = (yaw) => ({...})` to inject presses.
- Headless checks (Chrome, needs the dev server): `node tools/shot.mjs "<url>" out.png '[{"wait":4500,"shot":"a.png"}]'` for screenshots (combat: `?bot&seed=5&zoom=0.2`), `node tools/perf.mjs "<url>"` for fps and the background-tab test. The T3 preview pane runs no animation frames, so use these instead.

## Stage 4 breakdown (do in this order, commit after each)

1. ~~**4a Rules and data.**~~ Done. Sim: `UnitMods` on every unit (`Unit.mods`, `UnitSetup.mods` / `FormationSlot.mods`, `NEUTRAL_MODS`; neutral = the old rules exactly): damage, damageTaken, healing (heals and shields), cooldown (AI and hero), lifesteal, control (+s on taunt, Shield Bash stun, freezes, Fall Back slow), slowOnHit (arrows), area (every ground circle), guardShield / selfRally (`guardAndRally` in `statuses.ts`), crit (`CRIT_MULTIPLIER`; rolls only when crit > 0, so plain battles keep their random sequence). `computeDamage(..., source?)`. Data: `src/data/progression.ts` (`LEVEL_CAP` 20, `PATH_LEVEL` 5, `BENCH_SHARE`, `xpToNext(L) = 100 + 40 (L − 1)`, `LEVEL_GROWTH` per class incl. enemies, `statsAtLevel`, `Effect` = one flat record of optional numbers that add up), `src/data/upgrades.ts` (`PATHS` with a signature effect, `UPGRADES` base pool + pool per path with `kind`, `icon`, `max`), `src/data/items.ts` (`ITEMS`: 3 weapons per class + 8 trinkets, `LOOT_ODDS` per tier). `Encounter` gained `level`, `xp` (pool shared by the fielded), `loot`; `ENCOUNTERS` is now the 10-battle chain. Meta: `src/meta/progression.ts` (`characterEffect`, `characterStats`, `characterMods`, `addXp`, `availableUpgrades`, `rollUpgradeOptions`, `takeUpgrade`, `takePath`, `canEquip`), `src/meta/game.ts` (`GameState` with version, rng, squad, inventory, won, pending `rewards`, battles/lost; `newGame`, `isUnlocked`, `recordBattle` (first win only: xp shares, choice queue, loot roll), `currentChoice` (draws options lazily and stores them so a reload shows the same three), `choose`, `takeLoot`, `rollLoot`, `equip`, `unequip`). `battleSetupFor` passes stats + mods. Tests: `tests/sim/mods.test.ts`, `tests/meta/progression.test.ts`. Chain report: `REPORT=1 RUNS=8 HEROES=krieger npx vitest run tests/balance/chain.test.ts` (bot plays the chain with retries, random picks, best loot). Warrior bot: finishes 8/8, hero level 7 at the end, 89–100 % per battle; ranged heroes still lose the first Skirmish (known, Stage 5).
2. ~~**4b Saving.**~~ Done. `src/meta/save.ts` (pure, storage injected: `SAVE_KEY` `heerschar.save`, `saveGame`, `loadGame` (never throws), `parseSave` (version + `MIGRATIONS` chain, newer/unknown → null, structural check of ids, squad rules and pending rewards), `clearSave`). `src/ui/session.ts`: `session.game: GameState` replaces `squad` / `won`; `persist` (off for dev-shortcut games, so `?bot` etc. never touch the save), `hasSave`; autosave = deep `watch` on `session.game` (the game state only changes on prep screens and at a battle's end); `startNewGame` (clears the save), `continueGame`, `startDevGame`, `battleEnded(won)` → `recordBattle` (losses count too; leaving mid-battle records nothing). `BattleView` emits `ended(won)`. Title: Continue + New Game with the abandon confirm (parchment card over a dark scrim, Confirm = red button, Back = text link). Orders "Back" now returns to the title. Checked in headless Chrome: new game → reload → Continue restores; corrupt save → title with New Game only; a won battle through the screens saves levels, bench half share, six pending picks and the loot offer. Pending rewards have no UI yet (4c); Continue goes to the orders.
3. ~~**4c After-battle rewards.**~~ Done. `session.screen: 'spoils'` (`SpoilsScreen.vue`): leaving a battle ("Return to the war table" or "Change squad") goes through it via `leaveBattle(to)` when `game.rewards` is pending, then `spoilsDone()` continues to the orders or the squad step (`session.afterSpoils`); Continue on the title also opens it. Pages: XP (replayed with `xpAt(gain, t)`), one pick page per queued choice (`currentChoice` / `choose`), loot (`takeLoot`). Each pick is written to the game state at once, so a reload resumes at the open pick with the same options. Clicks are guarded by the choice the card was drawn for (a card still fading out cannot pick for the next character). Pure helpers in `src/meta/describe.ts`: `effectLines(effect)` (percent keys ×100, flat keys as is), `xpAt`. Components: `src/ui/Pictogram.vue` (all `UpgradeIcon` + `ItemIcon`), `PictogramTile.vue`, `screens/UpgradeCard.vue`, `screens/ItemCard.vue`. Checked in headless Chrome: seeded save → Continue → XP → path pick → five upgrade picks (reload in between keeps options) → loot → orders with rewards cleared and the item in the inventory; a real bot battle → Victory → Return to the war table → Spoils. Test seeding trick: in the dev server, `await import('/src/meta/game.ts')` + `/src/meta/save.ts` from `Runtime.evaluate`, build a `GameState`, `saveGame(localStorage, g)`, reload, click Continue. `tools/shot.mjs` now logs exception messages.
4. ~~**4d Equipment and upgrades on the character sheet.**~~ Done. `CharacterSheet.vue` now takes `game` (Squad and Formation screens pass `session.game`); equip / take off via `equip` / `unequip`, saved by the autosave watch. Pure helpers: `fittingItems(state, id, slot)` (game.ts, grouped with counts), `statsWithItem(c, slot, id|null)` (progression.ts, the preview), `upgradeTally` (describe.ts). New components `screens/ItemPicker.vue`, `screens/HoverNote.vue` (CSS-hover parchment note); `PictogramTile` has an optional `rarity` rim; `ItemSlot` shows the tile. Ledger deltas compare the rounded shown numbers. `tools/shot.mjs` gained `{"mouse":[x,y]}` and `{"hover":"selector"}` (real CDP mouse move, so CSS :hover works). Checked in headless Chrome at 1280 × 800: equip, swap, take off, trinket picker, path / upgrade notes, companion sheet, formation screen; the save holds the change.
5. ~~**4e Chain on the orders table.**~~ Done. `OrdersScreen.vue` takes `game` and uses `isUnlocked`; `App.fight` also refuses locked ids (dev `?battle=` still skips the screens). Strings `STRINGS.prep.level / sealed / replay`. Locked look = `.folded::after` overlay with a crease (seal kept bright). Checked in headless Chrome at 1280 × 800 with a seeded save (3 won): layout fits, hover intro, locked click does nothing, won note opens the squad step.
6. **Gate:** play the chain with levelling and loot, reload mid-way, replay a won battle (pays nothing).

## Stage 3 breakdown (done)

1. ~~**3a Data and squad rules.**~~ Done. `src/meta/squad.ts` (pure): `Character`, `SquadState` (`roster`, `fielded`, `formation`), `MAX_FIELDED` 6, `HERO_ID` 1, `setFielded`, `placeCharacter` (fielded: swap; benched onto a companion: the companion goes to the bench; never the hero), `freeSlotFor` (Krieger front, others back, centre first), `battleSetupFor(squad, encounter, seed)`. `src/data/roster.ts`: `SANDBOX_COMPANIONS`, `newSquad(heroClass, heroName)`. `src/data/encounters.ts`: `ENCOUNTERS` (skirmish, shieldWall, berserkerRush, archerLine) with enemy slots and a `strength` multiplier on enemy HP and power (1.5 / 2 / 1.5 / 1.3; stands in for enemy levels until Stage 4); `squadSetup` stays the Stage 2 battle at strength 1. Encounter names/intros in `STRINGS.encounters` (approved). `tests/meta/prepMatters.test.ts` proves the "done when" headless (skirmish without the healer ≥ 30 points fewer wins, hero in the back row ≥ 20 fewer; shield wall with two mages < 0.8 × the time without a mage). `REPORT=1 npx vitest run tests/balance/prep.test.ts` prints a composition/formation table per encounter. Note: enemy columns mirror (`slotPosition`): enemy col 0 stands opposite player col 2, so the preview must show the enemy grid as seen from the player side.
2. ~~**3b Flow, title, class select.**~~ Done. `src/ui/session.ts` (reactive `session`: `screen` title / classSelect / orders / battle, `squad`, `encounterId`, `won`, `battleRun`; no saving until Stage 4). `App.vue` switches screens; `BattleView.vue` mounts a `Game` per battle (keyed by `battleRun`) and disposes it on leave (renderer `forceContextLoss`). `Game` now takes a `BattleSpec` (`src/game/specs.ts`: `encounterSpec(squad, id)` snapshots the squad, `trialSpec`); unit names come from `spec.names` (index = unit id − 1), `STRINGS.companionNames` is gone. Screens in `src/ui/screens/`: `WarTable` (CSS oak boards + SVG-noise grain + flickering candle glow + vignette), `WaxSeal` (SVG), `FigurePreview` (own small transparent renderer, `PrimitiveFigureView` idling and turning), `TitleScreen`, `ClassSelect`, `OrdersScreen`. HUD: hero plate shows the hero's name + class; squad cards shrink to fit five in one row; max HP rounded. End and pause panels have "Return to the war table". URL params `?bot`, `?hero=`, `?battle=<encounterId>`, `?peaceful`, `?trial` skip the screens with the sandbox squad (hero named by the suggestion); `?seed=` fixes the first battle's seed. **Gotcha**: a dev server started before new `.vue` files exist can serve stale Tailwind CSS (new classes missing); restart it (or run a second one with `npx vite --port 5191`).
3. ~~**3c Squad screen and character sheet.**~~ Done. Flow: orders → `prepare(id)` → `screen: 'squad'` (`SquadScreen.vue`) → Next starts the battle directly until 3d adds the Formation step in between; Back returns to the orders; leaving a battle still returns to the orders. `CharacterSheet.vue` (figure, ledger, XP, `ItemSlot.vue`). Pure helpers in `src/meta/squad.ts`: `characterStats(c)` (= the battle stats, tested against `battleSetupFor`), `swapIn(state, benchedId, fieldedId)`, `xpToNext`. Drag and drop is native HTML5 (`dragId` ref; drop on the field list, the bench list or a fielded row). Headless drag test: dispatch `DragEvent`s with one shared `new DataTransfer()` (dragstart on the source row, dragover + drop on the target); Vue re-renders on the next tick, so read the DOM in a later step.
4. ~~**3d Formation grid.**~~ Done. Flow: orders → squad → `screen: 'formation'` (`FormationScreen.vue`, `FieldToken.vue`) → "To battle"; Back returns to the squad step. Pure helpers in `src/meta/squad.ts`: `canPlace(state, id, slot)` (same rules as `placeCharacter`, no mutation; tested against it for every character × slot) and `enemyViewCol(col)` = 2 − col (tested against `slotPosition`). Everyone, the hero too, can move on the grid; the hero never goes to the bench; a bench companion cannot replace the hero. Drag test as in 3c (cells: `.cell`, first 6 = enemy, then the squad's front row, back row; bench chips `.chip`, bench zone `.bench`).
5. ~~**3e Polish.**~~ Done. `src/sim/ledger.ts` (pure: `tallyEvents`, `ledgerEntry`; hits credit attacker and target with health lost, heals credit the source, area heals the caster; tested against `playHeadless` totals). `Game` tallies every tick, fills `hud.ledger` (`HudLedgerRow`, hero first) on the outcome and clears it on restart. `src/ui/EndLedger.vue` on the end panel (squad battles only). `changeSquad` event: Overlays → BattleView → App → `prepare(encounterId)`. Fixed: italic enemy names on the formation map lost their last letter (italic overhang clipped by `truncate`; `px-1`).
6. ~~**Gate: Marcel's playtest**~~ Passed ("done when": composition and formation visibly change how a battle goes). Suggested: The Shield Wall with and without both mages (Osric, Ansel) — compare time and the ledger; The Skirmish without Maren; the hero in the back row.

## Stage 2 breakdown (done)

PLAN sections: 5 (rules, statuses), 6 (classes, enemy types, companion behaviour), 7 (hero abilities, energy, leader ability, mark), 8 (lock-on, HUD), 13 (bot, tests).

1. ~~**2a Sim: squad and classes.**~~ Done. Notes: Krieger taunt fires when ≥ 2 non-hero foes are within 6 m (the hero is never taunted); Bogenschuetze uses its piercing shot whenever it is off cooldown; Heiler casts a weak magic bolt (0.5 × power) when nobody needs healing; frost nova also deals a little damage (0.4 ×). First numbers on `squadSetup` (30 seeds): Stage 1 bot hero wins 29/30, ~27 s per battle, hero ≈ 45 % of player damage (target 20–30 %, tune in 2f); an idle hero loses all. Original 2a brief: Generalise `ai.ts` per class (Krieger intercepts and taunts, Bogenschuetze kites and shoots lowest HP, Heiler heals lowest fraction (hero first on ties), Magier casts at clusters + frost nova). Projectiles (straight and arcing, aim at the current position), area effects (telegraphed circles 0.8–1.5 s), heals, statuses (frozen, stunned, marked, rallied, shielded). Formation setup: 3 × 2 slots per side, about 24 m apart. Companion abilities. Tests for each.
2. ~~**2b Sim: hero kit.**~~ Done (see "Feel decisions made in 2b"). Original brief: Energy (start 30, +4/s, +5 per landed basic attack), Warrior abilities Schildstoss / Wirbel (and the other three classes' sets), leader ability Sammeln (rallied 6 s), lock-on (Tab / cycle / Shift+Tab), mark (F). Extend `HeroInput`. The hero has no self-heal unless Heiler (reduced).
3. ~~**2c Enemy types.**~~ Done. `ClassId` = `PlayableClassId | EnemyTypeId`. Stats in `CLASS_STATS` (first numbers): Schildtraeger 170 HP, armor 110, resist 0, speed 3.0, plain melee on the nearest foe; Berserker 95 HP, speed 5.4, interval 0.9, goes for healers (Heiler/Schamane) first, then the nearest back-row foe, **ignores the 2-attacker cap**, still taunt-able; Schamane shares `supportBrain` with the Heiler (heal lowest fraction, bolt, stay back) plus the AI ability `ward` (shields the most hurt ally that a foe within 4 m is targeting, 2.5 × power for 8 s, cooldown 9). `squadSetup` enemies are now Schildtraeger, Krieger, Berserker (front) and Bogenschuetze, Schamane, Magier (back). 30 seeds: bot hero wins 24/30, ~31 s, hero ≈ 57 % of player damage (tune in 2f); idle hero loses 30/30. English names in `STRINGS.classes`. All units still render as the warrior figure.
4. ~~**2d View.**~~ Done (see "2d decisions" and "Made in 2d without asking"). All 7 class figures, projectiles with trails, filling-disc warnings, heal glow, frozen blue, shield bubble, lock ring, mark banner, damage numbers; the game runs the 5-vs-6 squad battle. 60 fps in the bot battle.
5. ~~**2e HUD.**~~ Done (see "2e decisions" and "Made in 2e without asking"). `HudState` gains `energy`, `abilities`, `squad`, `edgeMarkers` (built once per battle in `buildHudLists`, values updated in `updateHud`; edge markers projected in `updateEdgeMarkers`, list only replaced when it changes). Components in `src/ui/hud/`: `ClassMedallion`, `AbilityIcon`, `AbilitySlot`, `SquadCard`, `EdgeMarker`. 60 fps in the bot battle.
6. ~~**2f Bot and headless test.**~~ Done (see "2f decisions" and "Balance after 2f"). Also: ability cooldown labels under 1 s round up to the tenth (no more "0.0").
7. **Done when:** a 5-against-6 battle is readable and winnable, the determinism test passes, and the bot cannot win it alone. Met: tests pass and Marcel playtested it ("works great").
