import type { Vec2 } from './math';

/** The four playable classes. */
export type PlayableClassId = 'krieger' | 'bogenschuetze' | 'heiler' | 'magier';
/** Enemy-only types (PLAN section 6). */
export type EnemyTypeId = 'schildtraeger' | 'berserker' | 'schamane';
export type ClassId = PlayableClassId | EnemyTypeId;
export type Team = 'player' | 'enemy';
export type Outcome = 'running' | 'won' | 'lost';
export type DamageType = 'physical' | 'magic';

export interface Stats {
  maxHp: number;
  /** Base damage or healing. */
  power: number;
  /** Reduces physical damage. */
  armor: number;
  /** Reduces magic damage. */
  resist: number;
  /** m/s */
  moveSpeed: number;
  /** Seconds between basic attacks. */
  attackInterval: number;
  /** Metres. */
  range: number;
}

/**
 * What levels, upgrades, paths and items change inside a battle beyond the plain stats
 * (Stage 4). Neutral values (`NEUTRAL_MODS`) leave the rules exactly as before.
 */
export interface UnitMods {
  /** Multiplier on damage dealt. */
  damage: number;
  /** Multiplier on damage taken (after armour or resist). */
  damageTaken: number;
  /** Multiplier on heals and shields given. */
  healing: number;
  /** Multiplier on ability cooldowns. */
  cooldown: number;
  /** Fraction of damage dealt that heals the dealer. */
  lifesteal: number;
  /** Seconds added to the control effects the unit applies: taunt, stun, freeze, slow. */
  control: number;
  /** Seconds of `slowed` on foes hit by the unit's arrows. */
  slowOnHit: number;
  /** Multiplier on the radius of the ground circles the unit places. */
  area: number;
  /** Taunt / Shield Bash also shields the unit itself for this many × power. */
  guardShield: number;
  /** Chance for a hit to be critical. */
  crit: number;
  /** Taunt / Whirlwind also rallies the unit itself for this many seconds. */
  selfRally: number;
}

export const NEUTRAL_MODS: Readonly<UnitMods> = {
  damage: 1,
  damageTaken: 1,
  healing: 1,
  cooldown: 1,
  lifesteal: 0,
  control: 0,
  slowOnHit: 0,
  area: 1,
  guardShield: 0,
  crit: 0,
  selfRally: 0,
};

export type UnitState = 'idle' | 'moving' | 'windup' | 'recover' | 'dodging' | 'stunned' | 'dead';

/** What an AI unit is winding up or recovering from. See `ACTIONS` in balance.ts. */
export type AiActionId = 'strike' | 'taunt' | 'shot' | 'pierce' | 'heal' | 'groupHeal' | 'bolt' | 'fireball' | 'frostNova' | 'ward';
/** Hero abilities: two per class plus the leader ability. See `HERO_ABILITIES` in balance.ts. */
export type HeroAbilityId =
  | 'schildstoss'
  | 'wirbel'
  | 'salve'
  | 'rueckzug'
  | 'heilkreis'
  | 'segen'
  | 'feuerball'
  | 'frostring'
  | 'sammeln';
/** What a unit is winding up or recovering from. `null` on the hero means its basic attack chain. */
export type ActionId = AiActionId | HeroAbilityId;
/** Actions with a cooldown. */
export type AbilityId = 'taunt' | 'pierce' | 'groupHeal' | 'frostNova' | 'ward' | HeroAbilityId;

/**
 * Timed conditions on a unit. `stunned` is a unit state (it shares the stagger timer) and
 * `marked` lives on `Battle.markTargetId`, so neither appears here.
 * - frozen: cannot act, takes +50% physical damage
 * - rallied: +25% attack speed and move speed
 * - shielded: absorbs `amount` damage
 * - taunted: must target `sourceId`
 * - slowed: moves slower
 */
export type StatusKind = 'frozen' | 'rallied' | 'shielded' | 'taunted' | 'slowed';

export interface Status {
  kind: StatusKind;
  /** Seconds left. */
  time: number;
  /** Shield points left (shielded only). */
  amount: number;
  sourceId: number;
}

/** One fighter inside a battle. Fields are added stage by stage as rules arrive. */
export interface Unit {
  id: number;
  team: Team;
  classId: ClassId;
  isHero: boolean;
  stats: Stats;
  /** Battle effects of levels, upgrades and items (neutral for enemies and plain setups). */
  mods: UnitMods;
  hp: number;
  pos: Vec2;
  /** Knockback velocity, decays by friction. Steering movement is applied directly. */
  vel: Vec2;
  facing: number;
  state: UnitState;
  stateTime: number;
  /** How long the current stunned state lasts. */
  stunDuration: number;
  /** Seconds left in which the unit cannot be staggered again. */
  staggerImmunity: number;
  targetId: number | null;
  /** Seconds until the next basic attack may start (AI units). */
  attackCooldown: number;
  /** Hero: index into the attack chain of the current or last attack. */
  chain: number;
  /** Hero: true when the next chain step was requested during the current attack. */
  chainQueued: boolean;
  dodgeCooldown: number;
  /** Direction of the current dodge. */
  dodgeAngle: number;
  /** Hit-stop: while > 0 the unit is frozen in place (time does not advance for it). */
  hitstop: number;
  /** Hero input buffers: seconds left in which a press still counts. */
  attackBuffer: number;
  dodgeBuffer: number;
  statuses: Status[];
  /** Seconds until each ability may be used again. */
  abilityCooldowns: Partial<Record<AbilityId, number>>;
  /** The action in windup or recover (hero: `null` = basic attack, or an ability). */
  action: ActionId | null;
  /** Hero: 0..100, pays for abilities. */
  energy: number;
  /** Hero: the ability pressed most recently, remembered while `abilityBuffer` > 0. */
  queuedAbility: HeroAbilityId | null;
  abilityBuffer: number;
}

export type ProjectileKind = 'arrow' | 'piercing' | 'bolt' | 'fireball';

/**
 * Straight projectiles fly along `dir` and hit the first foe in their radius (piercing ones
 * hit every foe once). Arcing projectiles fly from `from` to `to` in `duration` and only carry
 * the look: their damage is the area effect `areaId`, telegraphed at launch.
 */
export interface Projectile {
  id: number;
  kind: ProjectileKind;
  team: Team;
  ownerId: number;
  pos: Vec2;
  arc: boolean;
  /** Straight: unit direction and speed. */
  dir: Vec2;
  speed: number;
  radius: number;
  /** Straight: metres left before it drops. */
  rangeLeft: number;
  power: number;
  multiplier: number;
  damageType: DamageType;
  pierce: boolean;
  hitIds: number[];
  /** Arcing: flight path and timing. */
  from: Vec2;
  to: Vec2;
  time: number;
  duration: number;
  areaId: number | null;
  /** The hero's basic attack: a hit gives energy. */
  basic: boolean;
}

export type AreaKind = 'fireball' | 'frostNova' | 'heilkreis' | 'frostring';

/**
 * A telegraphed ground circle: resolves on every foe inside once `time` reaches `delay`.
 * Healing areas resolve on allies instead, and areas with `pulses` > 1 resolve again every
 * `interval` seconds.
 */
export interface AreaEffect {
  id: number;
  kind: AreaKind;
  team: Team;
  ownerId: number;
  pos: Vec2;
  radius: number;
  delay: number;
  time: number;
  power: number;
  multiplier: number;
  damageType: DamageType;
  /** Seconds of `frozen` applied to those hit (0 = none). */
  freeze: number;
  /** Heals allies by `power × multiplier` per pulse instead of damaging foes. */
  heal: boolean;
  /** Resolutions left, including the next one. */
  pulses: number;
  interval: number;
}

export interface Battle {
  tick: number;
  rngState: number;
  arena: { width: number; depth: number };
  units: Unit[];
  projectiles: Projectile[];
  areas: AreaEffect[];
  /** Next id for projectiles and areas. */
  nextId: number;
  /** The enemy the hero marked as the squad's focus target (takes +15%). */
  markTargetId: number | null;
  /** The enemy the hero is locked on to: it faces it and aims at it. */
  lockTargetId: number | null;
  /** Seconds before the fight starts. */
  countdown: number;
  outcome: Outcome;
  /** Debug (`?peaceful`): enemies stand still and never act. */
  passiveEnemies: boolean;
}

/** Hero input for one tick. Movement is already camera-relative (world space), length <= 1. */
export interface HeroInput {
  moveX: number;
  moveZ: number;
  /** Facing used for attacks when there is no movement input (the camera's forward). */
  aimAngle: number;
  /** Edge-triggered: true on the tick the button was pressed. */
  attack: boolean;
  dodge: boolean;
  /** Class abilities (Q / E) and the leader ability (R). */
  ability1: boolean;
  ability2: boolean;
  leader: boolean;
  /** Tab: lock on to the enemy nearest the view centre, or cycle to the next one. */
  lock: boolean;
  /** Shift+Tab: release the lock. */
  unlock: boolean;
  /** F: mark the locked enemy (or the one nearest the view centre) as the squad's focus. */
  mark: boolean;
}

export function emptyInput(): HeroInput {
  return { moveX: 0, moveZ: 0, aimAngle: 0, attack: false, dodge: false, ability1: false, ability2: false, leader: false, lock: false, unlock: false, mark: false };
}

export type BattleEvent =
  | { type: 'countdown'; value: number }
  | { type: 'attackStart'; unitId: number; chain: number }
  | { type: 'swing'; unitId: number; chain: number }
  | { type: 'hit'; attackerId: number; targetId: number; amount: number; absorbed: number; heavy: boolean; x: number; z: number }
  | { type: 'heal'; sourceId: number; targetId: number; amount: number; x: number; z: number }
  | { type: 'action'; unitId: number; action: ActionId }
  /** A hero ability's windup completed and it took effect. */
  | { type: 'release'; unitId: number; action: HeroAbilityId }
  | { type: 'shoot'; projectileId: number; kind: ProjectileKind }
  | { type: 'areaStart'; areaId: number; kind: AreaKind }
  | { type: 'areaResolve'; areaId: number; kind: AreaKind; x: number; z: number; radius: number }
  | { type: 'status'; unitId: number; kind: StatusKind; on: boolean }
  | { type: 'lock'; targetId: number | null }
  | { type: 'mark'; targetId: number | null }
  | { type: 'evade'; unitId: number }
  | { type: 'dodge'; unitId: number }
  | { type: 'death'; unitId: number }
  | { type: 'outcome'; outcome: Exclude<Outcome, 'running'> };
