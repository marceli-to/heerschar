import type { Vec2 } from './math';

export type ClassId = 'krieger' | 'bogenschuetze' | 'heiler' | 'magier';
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

export type UnitState = 'idle' | 'moving' | 'windup' | 'recover' | 'dodging' | 'stunned' | 'dead';

/** What an AI unit is winding up or recovering from. See `ACTIONS` in balance.ts. */
export type ActionId = 'strike' | 'taunt' | 'shot' | 'pierce' | 'heal' | 'groupHeal' | 'bolt' | 'fireball' | 'frostNova';
/** Abilities with a cooldown, a subset of the actions. */
export type AbilityId = 'taunt' | 'pierce' | 'groupHeal' | 'frostNova';

/**
 * Timed conditions on a unit. `stunned` is a unit state (it shares the stagger timer) and
 * `marked` lives on `Battle.markTargetId`, so neither appears here.
 * - frozen: cannot act, takes +50% physical damage
 * - rallied: +25% attack speed and move speed
 * - shielded: absorbs `amount` damage
 * - taunted: must target `sourceId`
 */
export type StatusKind = 'frozen' | 'rallied' | 'shielded' | 'taunted';

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
  /** AI: the action in windup or recover. */
  action: ActionId | null;
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
}

export type AreaKind = 'fireball' | 'frostNova';

/** A telegraphed ground circle: resolves on every foe inside once `time` reaches `delay`. */
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
  /** Seconds before the fight starts. */
  countdown: number;
  outcome: Outcome;
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
}

export function emptyInput(): HeroInput {
  return { moveX: 0, moveZ: 0, aimAngle: 0, attack: false, dodge: false };
}

export type BattleEvent =
  | { type: 'countdown'; value: number }
  | { type: 'attackStart'; unitId: number; chain: number }
  | { type: 'swing'; unitId: number; chain: number }
  | { type: 'hit'; attackerId: number; targetId: number; amount: number; absorbed: number; heavy: boolean; x: number; z: number }
  | { type: 'heal'; sourceId: number; targetId: number; amount: number; x: number; z: number }
  | { type: 'action'; unitId: number; action: ActionId }
  | { type: 'shoot'; projectileId: number; kind: ProjectileKind }
  | { type: 'areaStart'; areaId: number; kind: AreaKind }
  | { type: 'areaResolve'; areaId: number; kind: AreaKind; x: number; z: number; radius: number }
  | { type: 'status'; unitId: number; kind: StatusKind; on: boolean }
  | { type: 'evade'; unitId: number }
  | { type: 'dodge'; unitId: number }
  | { type: 'death'; unitId: number }
  | { type: 'outcome'; outcome: Exclude<Outcome, 'running'> };
