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
}

export interface Battle {
  tick: number;
  rngState: number;
  arena: { width: number; depth: number };
  units: Unit[];
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
  | { type: 'hit'; attackerId: number; targetId: number; amount: number; heavy: boolean; x: number; z: number }
  | { type: 'evade'; unitId: number }
  | { type: 'dodge'; unitId: number }
  | { type: 'death'; unitId: number }
  | { type: 'outcome'; outcome: Exclude<Outcome, 'running'> };
