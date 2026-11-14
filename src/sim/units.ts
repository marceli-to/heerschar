import { ENERGY } from './balance';
import { NEUTRAL_MODS, type ClassId, type Stats, type Team, type Unit, type UnitMods } from './types';

export interface UnitSetup {
  team: Team;
  classId: ClassId;
  isHero: boolean;
  stats: Stats;
  /** Defaults to `NEUTRAL_MODS`. */
  mods?: Partial<UnitMods>;
  x: number;
  z: number;
  /** Set on units a boss summons mid-battle. */
  summonerId?: number;
}

export function createUnit(id: number, s: UnitSetup): Unit {
  return {
    id,
    team: s.team,
    classId: s.classId,
    isHero: s.isHero,
    stats: { ...s.stats },
    mods: { ...NEUTRAL_MODS, ...s.mods },
    hp: s.stats.maxHp,
    pos: { x: s.x, z: s.z },
    vel: { x: 0, z: 0 },
    // Each side faces the other across the arena (player side on -x).
    facing: s.team === 'player' ? Math.PI / 2 : -Math.PI / 2,
    state: 'idle',
    stateTime: 0,
    stunDuration: 0,
    staggerImmunity: 0,
    targetId: null,
    attackCooldown: 0,
    chain: 0,
    chainQueued: false,
    dodgeCooldown: 0,
    dodgeAngle: 0,
    hitstop: 0,
    attackBuffer: 0,
    dodgeBuffer: 0,
    statuses: [],
    abilityCooldowns: {},
    action: null,
    energy: s.isHero ? ENERGY.start : 0,
    queuedAbility: null,
    abilityBuffer: 0,
    hitIds: [],
    summonerId: s.summonerId ?? null,
    raised: false,
  };
}
