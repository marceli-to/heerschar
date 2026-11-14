# PLAN: Heerschar (working title)

A 3D browser game in which you lead a small army of four to six characters as
a hero you control directly. Between battles you build, equip and level the
squad. In battle you fight in real time among your companions, seen through a
camera that zooms from behind the hero's shoulder out to an overview of the
arena.

This document is the full brief for the implementing agent. Build it stage by
stage (section 14). Each stage ends in a playable, committed state. Stage 1 has
a hard gate: Marcel playtests the hero's feel before anything is built on top.

---

## 1. The game in one paragraph

You pick a hero class and start with two companions. A campaign map leads
through about 25 battles in three regions, each ending in a boss. Before a
battle you choose who fights, where they stand, and what they carry. In the
battle you move, attack, dodge and use abilities as the hero, while companions
and enemies fight by their own rules. After a win everyone gains experience,
levels bring choices, and loot drops. Fallen characters recover after the
battle. Defeat costs the reward, never the characters.

**Pillars**

1. **The hero feels good to play.** Movement, hits and dodges are responsive
   and have weight. If this fails, nothing else matters.
2. **The army matters.** The hero is one fighter among several and cannot win
   alone. Composition, formation and levelling decide battles as much as skill.
3. **Growth.** The squad visibly and mechanically grows from recruits to
   veterans, and players get attached to it.

**Non-goals for now** (do not build, do not leave stubs)

- Online play, other players' armies, accounts, a backend.
- An endless mode after the campaign.
- Obstacles, terrain height, pathfinding, destructible scenery.
- Permadeath, injuries that last beyond a battle.
- Story, dialogue, cutscenes.
- A physics engine.

---

## 2. Tech stack

- **Vite + TypeScript** (strict mode).
- **Three.js** for the battle view.
- **Vue 3 + Tailwind CSS** for all 2D interface: menus, squad screens, campaign
  map, and the HUD overlay on top of the canvas.
- **Vitest** for simulation tests.
- No backend. Saves go to `localStorage`.
- Desktop first (keyboard and mouse). Touch controls come in the last stage.
- Target: 60 fps with 20 units on a laptop with integrated graphics.

---

## 3. Architecture

The simulation is strictly separate from rendering and input.

```
src/
  sim/          pure TypeScript. No Three.js, no DOM, no Vue.
    rng.ts            seeded PRNG
    types.ts          state types (section 4)
    balance.ts        every tunable number in one place
    battle.ts         createBattle(setup), step(battle, heroInput, dt)
    movement.ts       steering: seek, separation, arena bounds
    combat.ts         attacks, damage, hit shapes, projectiles, areas
    abilities.ts      ability definitions and effects
    ai.ts             behaviour for companions and enemies
    heroControl.ts    applies hero input to the hero unit
    progression.ts    experience, levels, upgrade choices
    items.ts          item definitions, loot rolls
    campaign.ts       map generation, node resolution, recruits
    save.ts           serialise, version, migrate
    bot.ts            scripted hero for headless tests
  view/         Three.js. Reads battle state, never writes it.
    scene.ts, arena.ts, camera.ts, unitView.ts, effects.ts, markers.ts
  input/        keyboard, mouse, (later) touch -> HeroInput per tick
  ui/           Vue: title, hero select, campaign map, squad, formation,
                loot, level-up, HUD, pause, settings
  data/         classes.ts, enemies.ts, encounters.ts, items.ts, strings.ts
```

**Fixed timestep.** The simulation advances in fixed ticks of 1/60 s. The
render loop accumulates real time, runs as many ticks as needed, and
interpolates unit positions between the last two ticks for display.

**Determinism.** `step()` depends only on the battle state, the hero input for
that tick, and the seeded RNG. No `Math.random()`, no `Date.now()`, no
frame-time dependence inside `sim/`. The same seed, setup and input sequence
must produce the same battle. This is what makes headless tests possible.

**Events.** `step()` returns a list of events for the tick (`hit`, `heal`,
`death`, `abilityCast`, `projectileSpawn`, `levelUp` ...). The view and audio
react to events. They never inspect the simulation for "what just happened".

**UnitView interface.** Each unit on screen is driven through one interface
(`setPose`, `play('attack')`, `flashHit`, `die`, `dispose`). Stage 1 implements
it with figures built from primitives. Stage 6 adds an implementation backed by
rigged models without touching anything else.

---

## 4. Data model

Units are metres and seconds. The arena is flat. Positions are 2D (`x`, `z`)
plus a facing angle. Height exists only in the view.

```ts
type ClassId = 'krieger' | 'bogenschuetze' | 'heiler' | 'magier'
             | 'schildtraeger' | 'berserker' | 'schamane' | BossId;
type Team = 'player' | 'enemy';
type DamageType = 'physical' | 'magic';

type Stats = {
  maxHp: number;
  power: number;          // base damage or healing
  armor: number;          // reduces physical damage
  resist: number;         // reduces magic damage
  moveSpeed: number;      // m/s
  attackInterval: number; // s between basic attacks
  range: number;          // m
};

type Character = {          // persistent, outside battles
  id: number;
  name: string;
  classId: ClassId;
  isHero: boolean;
  level: number;            // 1..20
  xp: number;
  upgrades: UpgradeId[];    // chosen at level-ups
  path: PathId | null;      // specialisation from level 5
  weapon: ItemId | null;
  trinket: ItemId | null;
};

type Unit = {               // one fighter inside a battle
  id: number;
  characterId: number | null;   // null for enemies
  team: Team;
  classId: ClassId;
  stats: Stats;                 // final, after level, upgrades, items
  hp: number;
  pos: { x: number; z: number };
  facing: number;
  state: 'idle' | 'moving' | 'windup' | 'recover' | 'dodging'
       | 'stunned' | 'dead';
  stateTime: number;
  targetId: number | null;
  attackCooldown: number;
  abilityCooldowns: Record<string, number>;
  statuses: Status[];           // frozen, marked, rallied, shielded ...
  isHero: boolean;
  energy: number;               // hero only, 0..100
};

type Battle = {
  tick: number;
  rngState: number;
  arena: { width: number; depth: number };   // 44 x 30 m
  units: Unit[];
  projectiles: Projectile[];
  areas: AreaEffect[];          // telegraphed ground circles
  lockTargetId: number | null;  // hero's lock-on
  markTargetId: number | null;  // squad focus target
  outcome: 'running' | 'won' | 'lost';
};

type HeroInput = {
  moveX: number; moveZ: number;   // already camera-relative, length <= 1
  aimAngle: number;               // facing when not locked on
  attack: boolean; dodge: boolean;
  ability1: boolean; ability2: boolean; leader: boolean;
  lockToggle: boolean; lockNext: boolean; mark: boolean;
};

type GameState = {
  version: number;
  seed: number; rngState: number;
  roster: Character[];            // hero + companions, fielded and bench
  fielded: number[];              // character ids, hero always included
  formation: Record<number, { col: 0|1|2; row: 0|1 }>;
  inventory: ItemId[];
  campaign: CampaignState;        // section 10
  settings: Settings;
};
```

---

## 5. Battle rules

**Setup.** Two formations of 3 columns × 2 rows face each other across the
arena, about 24 m apart. Row 0 is the front. The hero starts in his formation
slot like everyone else. A three-second countdown, then the fight runs.

**Outcome.** Won when all enemies are dead. Lost when the hero falls. Companions
who fall stay down for the rest of the battle. After the battle everyone is
restored to full health.

**Damage.** `damage = power × multiplier × 100 / (100 + armor)` for physical,
the same with `resist` for magic. A variance of ±10% from the seeded RNG.
Critical hits are not in the first version.

**Hit shapes.** No physics engine.
- Melee: at the hit moment of the attack, every enemy inside an arc in front
  of the attacker (radius = range, angle by attack) is hit.
- Projectiles: spheres moving in a straight line (arrows, bolts) or an arc
  (fireballs) at a fixed speed, hitting the first enemy within their radius.
  AI units aim at the target's current position, so the hero can sidestep.
- Areas: a circle appears on the ground as a warning, and resolves after a
  delay (0.8 to 1.5 s) on everyone inside.

**Attack phases.** Every attack has a windup, a hit moment and a recovery. The
windup is the tell that makes dodging and reading the fight possible. Enemy
windups are never shorter than 0.35 s.

**Movement.** Units steer towards their goal with a separation force so they do
not stack. A unit radius of 0.5 m. Soft arena bounds push units back in. No
pathfinding: the arena is open.

**Statuses** (first set): `frozen` (cannot act, takes +50% physical),
`stunned`, `marked` (squad focus, takes +15%), `rallied` (+25% attack speed
and move speed), `shielded` (absorbs a fixed amount).

---

## 6. Classes

Four playable classes in the first version. The hero is one of them with an
extended moveset (section 7). Starting values at level 1, to be tuned in
`balance.ts`:

| Class          | Role                 | HP  | Power | Armor | Resist | Speed | Interval | Range |
|----------------|----------------------|-----|-------|-------|--------|-------|----------|-------|
| Krieger        | front line, protects | 140 | 14    | 40    | 10     | 4.0   | 1.2      | 1.8   |
| Bogenschuetze  | ranged physical      | 80  | 12    | 10    | 10     | 4.2   | 1.4      | 14    |
| Heiler         | keeps others alive   | 75  | 16    | 10    | 30     | 4.0   | 2.0      | 10    |
| Magier         | area and control     | 70  | 20    | 5     | 30     | 3.8   | 2.4      | 12    |

**Companion behaviour**

- **Krieger:** attacks the nearest enemy. Moves to intercept enemies heading
  for the back row. Ability: taunt (nearby enemies target him for 4 s).
- **Bogenschuetze:** keeps distance, shoots the lowest-health enemy in range.
  Backs away from melee attackers. Ability: piercing shot.
- **Heiler:** heals the ally with the lowest health fraction, the hero first on
  a tie. Stays behind the front line. Ability: group heal in a small radius.
- **Magier:** casts at the largest cluster of enemies. Ability: frost nova
  (freezes for 2 s) when enemies come close.

All units obey the hero's **mark**: while an enemy is marked, damage dealers
target it if it is in reach.

**Enemy types.** The enemy side uses the same four classes (tinted differently)
plus three of its own:

- **Schildtraeger:** very high armor, low resist. Slow. Punishes squads
  without magic.
- **Berserker:** fast, heads straight for the back row. Punishes an unprotected
  healer.
- **Schamane:** heals and shields enemies. A priority target that teaches the
  mark.

**Bosses** (one per region): a large unit with three or four telegraphed
attacks (a sweep, a charge, a ground slam with area circles, a summon), far
more health, and immunity to stun and freeze. Bosses come with a small escort.

---

## 7. The hero

**Moveset**

- **Move:** camera-relative, 5.0 m/s. Faces the lock target when locked on,
  the movement direction otherwise.
- **Basic attack:** a two-hit chain when the button is pressed again in time.
  Melee classes swing, ranged classes shoot along the aim.
- **Dodge:** a 4 m dash over 0.35 s in the movement direction, immune to
  damage for the first 0.25 s, 1.2 s cooldown.
- **Ability 1 and 2:** by hero class, cost energy.
- **Leader ability:** the same for every hero class, costs energy.
  - *Sammeln* (rally): all companions gain `rallied` for 6 s.
- **Mark:** free, instant. Marks the locked enemy as the squad's focus target.

**Energy:** 0 to 100. Starts at 30. Gains 4 per second, plus 5 per basic attack
that hits. Abilities cost 30 to 60.

**Hero abilities by class** (first version)

- Krieger: *Schildstoss* (stun in a cone), *Wirbel* (damage all around).
- Bogenschuetze: *Salve* (three arrows in a fan), *Rueckzug* (leap back and
  slow enemies in front).
- Heiler: *Heilkreis* (area heal over time), *Segen* (shield on one ally).
- Magier: *Feuerball* (arcing area damage), *Frostring* (freeze around self).

**Keeping the army relevant.** These are requirements, checked in playtests and
by the bot tests:

- With equal levels, the hero contributes roughly 20 to 30% of the damage in a
  standard battle.
- The hero has no self-heal unless he is the Heiler class, and then at reduced
  strength on himself.
- No standard campaign battle is winnable by the bot hero alone without
  companions at the expected level.

---

## 8. Camera and controls

**Camera**

- One zoom parameter `z` from 0 (close) to 1 (far), on the mouse wheel.
  - `z = 0`: 4 m behind and 2 m above the hero, looking over the shoulder.
  - `z = 1`: 26 m back and 22 m up, tilted down about 55°, the whole arena in
    view.
  - Distance, height and pitch are interpolated along a smooth curve between.
- Mouse movement rotates the camera around the hero (pointer lock after a
  click on the canvas, released with `Esc`).
- Smooth follow with slight lag. No camera collision needed: arenas are open.
- **Lock-on:** `Tab` locks the nearest enemy to the view centre, `Tab` again
  cycles, `Shift+Tab` releases. While locked, the camera keeps hero and target
  framed and the hero faces the target.
- **Camera moments** (stage 6): a slow orbit during the countdown, a short
  slow motion on the final blow.

**Default keys**

| Action          | Key            |
|-----------------|----------------|
| Move            | W A S D        |
| Attack          | Left mouse     |
| Dodge           | Space          |
| Ability 1 / 2   | Q / E          |
| Leader ability  | R              |
| Lock-on         | Tab            |
| Mark target     | F              |
| Zoom            | Mouse wheel    |
| Pause           | Esc            |

Keys are remappable in settings (stage 6).

**HUD** (Vue overlay)

- Hero health and energy, ability icons with cost and cooldown.
- **Squad panel:** one row per companion with name, class icon and health bar.
  A fallen companion is greyed out. A companion under 30% health pulses.
- **Edge markers:** arrows at the screen edge pointing to a companion in danger
  and to the marked target when they are off screen.
- Health bars above every unit in the 3D view, damage and heal numbers popping
  off targets, a ring under the locked target, a banner icon over the marked
  one.
- Enemy count remaining.

---

## 9. Preparation

Between battles, in 2D screens:

- **Squad:** the roster with level, class, items. Choose up to five companions
  to field. The hero always fights. The bench holds up to three more.
- **Formation:** a 3×2 grid. Drag characters into slots. Row 0 is the front.
  The upcoming enemy formation is shown opposite, with unit types visible, so
  the choice is informed.
- **Equipment:** each character has one weapon and one trinket slot. Items are
  simple: stat bonuses, sometimes one effect ("attacks slow the target",
  "+20% healing done"). Unused items sit in a shared inventory.
- **Character sheet:** stats, chosen upgrades, the path, experience to the next
  level.

---

## 10. Progression and campaign

**Experience**

- A won battle awards a fixed experience amount set by the encounter. Fielded
  characters share it equally, fallen ones included. Benched characters get
  half a share.
- Each encounter pays experience and loot **once**. Replaying a won battle is
  possible from the map but pays nothing. This removes grinding.
- A lost battle pays nothing and can be retried at once.
- Levels 1 to 20. The experience curve is set so that a player who wins every
  battle once reaches about level 6 at the first boss, 12 at the second and 18
  at the last.

**Level-up**

- Each level raises base stats slightly by class.
- At every level the player picks **one of three** upgrades drawn from the
  class pool: stat boosts (+12% health), ability improvements (taunt lasts
  longer), or passive effects (arrows slow). Drawn with the seeded RNG.
- **Paths:** at level 5 each character chooses one of two specialisations,
  which adds a second pool of upgrades and changes one ability.
  - Krieger: Waechter (defence, protection) or Berserker (damage).
  - Bogenschuetze: Scharfschuetze (single target) or Jaeger (speed, traps).
  - Heiler: Priester (stronger heals) or Kampfmoench (heals plus damage).
  - Magier: Feuer (damage) or Eis (control).

**Loot:** after each win, pick one of three items. Elite and boss battles offer
better ones. Rarity tiers: common, rare, epic.

**Campaign map**

- Three regions. Each is a small branching graph of about eight nodes leading
  to a boss. The player chooses a route but can go back and take the other
  branches too.
- Node types: **battle**, **elite battle** (harder, better loot), **camp**
  (recruit one of two offered companions), **boss**.
- The player starts with the hero and two companions. Camps bring the roster up
  to its limit over the first two regions.
- Encounters are defined in data: enemy list with classes, levels and formation
  slots, experience reward, loot tier.
- The map is a 2D screen. The layout per region is fixed in data, not
  generated, so difficulty can be tuned by hand.

**Ending:** defeating the third boss shows a summary (time, battles lost, the
squad with levels) and returns to the title. The save can be continued to
finish remaining nodes.

---

## 11. Look and sound

- **Figures (stages 1 to 5):** built in code from boxes, cylinders and spheres.
  Class identity through silhouette and colour: a broad Krieger with shield, a
  slim Magier with pointed hat and staff, a Bogenschuetze with bow and hood, a
  Heiler in a robe with a glowing orb. Player team in warm colours, enemies in
  cold ones. Animation by moving the parts in code: walk bob, windup lean,
  swing, recoil, topple.
- **Figures (stage 6):** rigged, animated low-poly characters from free asset
  packs (candidates: KayKit, Quaternius, Kenney). Verify each licence before
  use and record it in `CREDITS.md`. All packs must be visually consistent, or
  one pack is used throughout.
- **Arena:** a flat ground disc with a subtle texture, a low wall or ring of
  stones marking the bounds, and scenery outside it (hills, trees, banners,
  a sky gradient). One look per region.
- **Feedback:** on every hit a brief pause of the attacker's animation
  (about 60 ms), a flash on the target, a small knockback, particles, and a
  slight camera shake for heavy hits. Projectiles leave trails. Heals glow
  green on the ground. Frozen units turn blue.
- **Sound (stage 6):** hits, casts, heals, deaths, interface clicks, one music
  loop per region. Free, licence-checked sources only.

---

## 12. Persistence

- Autosave to `localStorage` after every battle and every change on the
  preparation screens. Never during a battle: quitting mid-battle counts as
  not fought.
- One save slot. The save carries a `version` with a migration chain.
- A corrupt or unknown save falls back to the title screen without crashing.

---

## 13. Testing

- Unit tests for everything in `sim/`: damage, statuses, steering bounds,
  experience, level-ups, loot rolls, save migration.
- **Determinism test:** the same seed, setup and recorded input give an
  identical final battle state.
- **Headless battles:** `bot.ts` plays the hero with a simple policy (attack
  the marked or nearest target, dodge when an enemy windup is aimed at it, use
  abilities when affordable, mark the Schamane or the healer first). The suite
  runs each campaign encounter 200 times at the expected squad level.
- **Balance targets** (regression signals, not truth, since the bot is not a
  human):
  - Standard battles: bot win rate 70 to 90%. Elites 45 to 70%. Bosses 35 to
    60%.
  - Battle length: 45 to 150 s for standard battles.
  - Hero damage share 20 to 30%.
  - Bot hero alone without companions: win rate under 5% on every standard
    battle.
  - No single class composition wins more than 15 points above the average.
- No `any`. No simulation code in `view/` or `ui/`.

---

## 14. Build stages

Commit at the end of each stage. Do not start a stage before the previous one
meets its "done when".

**Stage 0: scaffold**
- Vite, TypeScript strict, Three.js, Vue, Tailwind, Vitest. Seeded RNG.
- Fixed-timestep loop with interpolation. An empty arena with light and sky.
  A debug overlay (fps, tick, unit count).
- *Done when:* the arena renders at 60 fps and the loop stays stable when the
  tab is backgrounded and restored.

**Stage 1: the hero alone (hard gate)**
- Hero movement, the zoom camera with rotation, basic attack chain, dodge.
- Three simple melee enemies that approach and attack with a visible windup.
- Hit shapes, damage, health bars, hit feedback (pause, flash, knockback,
  shake), deaths, win and lose states, restart.
- *Done when:* Marcel has played it and confirms that moving, hitting and
  dodging feel good. Expect several rounds of tuning. **Stop here and ask.**

**Stage 2: the squad battle**
- All four classes as companions and enemies with their behaviours.
  Projectiles, heals, area effects with ground warnings, statuses.
- Hero abilities, energy, the leader ability, lock-on, mark.
- HUD with squad panel and edge markers.
- Schildtraeger, Berserker, Schamane.
- The bot and the headless battle test.
- *Done when:* a 5-against-6 battle is readable and winnable, the determinism
  test passes, and the bot cannot win it alone.

**Stage 3: preparation**
- Title, hero class selection, squad screen, formation grid with enemy preview,
  character sheet. Battles defined in data. All four hero classes playable.
- *Done when:* changing composition and formation visibly changes how a given
  battle goes.

**Stage 4: progression**
- Experience, levels, upgrade choices, paths, items and loot, equipment,
  saving and loading.
- *Done when:* a chain of ten battles can be played with levelling and loot,
  survives a reload, and replayed battles pay nothing.

**Stage 5: campaign**
- The map with three regions, node types, camps and recruiting, three bosses,
  the ending summary. The full encounter list with tuned levels.
- The balance test suite against the targets in section 13.
- *Done when:* the campaign is playable start to finish and the balance
  targets hold.

**Stage 6: presentation**
- Rigged character models behind the `UnitView` interface, region scenery,
  camera moments, sound and music, settings (volume, key remapping, camera
  sensitivity, quality).
- *Done when:* the game is presentable to someone who has never seen it.

**Stage 7: touch and performance**
- Virtual stick and buttons, automatic follow camera with lock-on, pinch zoom,
  quality scaling for phones.
- *Done when:* a full battle is comfortably playable on a recent phone at
  30 fps or better.

---

## 15. Decisions already made

Settled while planning. Do not reopen them without asking.

- 3D, real time, with the hero under direct control.
- A zoomable camera from behind the hero up to an overview.
- A squad of four to six including the hero.
- Characters gain experience and level up after won battles.
- Fallen characters recover after the battle. No permadeath.
- Open, flat arenas without obstacles.
- The simulation is deterministic and separate from the view.

## 16. Open points to raise with Marcel when reached

- The name. "Heerschar" is a placeholder.
- Whether the battle is lost when the hero falls (current rule), or whether a
  healer may revive him once.
- Interface language. All strings live in `data/strings.ts`. The class names
  are German for now.
- Primitive figures versus asset packs: if the close camera makes the block
  figures look too crude in stage 1, pull the model work forward from stage 6.
- Whether touch support (stage 7) is wanted at all, given the control scheme.
