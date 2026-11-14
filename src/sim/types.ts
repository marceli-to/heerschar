import type { Vec2 } from './math';

export type Team = 'player' | 'enemy';
export type Outcome = 'running' | 'won' | 'lost';

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
  stats: Stats;
  hp: number;
  pos: Vec2;
  facing: number;
  state: UnitState;
  stateTime: number;
  isHero: boolean;
}

export interface Battle {
  tick: number;
  rngState: number;
  arena: { width: number; depth: number };
  units: Unit[];
  outcome: Outcome;
}

/** Hero input for one tick. Movement is already camera-relative, length <= 1. */
export interface HeroInput {
  moveX: number;
  moveZ: number;
  aimAngle: number;
  attack: boolean;
  dodge: boolean;
}

export function emptyInput(): HeroInput {
  return { moveX: 0, moveZ: 0, aimAngle: 0, attack: false, dodge: false };
}

export type BattleEvent = { type: 'outcome'; outcome: Exclude<Outcome, 'running'> };
