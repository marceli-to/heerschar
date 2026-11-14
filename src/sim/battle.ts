import { ARENA, COUNTDOWN } from './balance';
import { updateEnemy } from './ai';
import { isAlive } from './combat';
import { bufferHeroInput, updateHero } from './heroControl';
import { applyKnockback, keepInBounds, separate } from './movement';
import { seedState } from './rng';
import type { Battle, BattleEvent, ClassId, HeroInput, Stats, Team, Unit } from './types';

export interface UnitSetup {
  team: Team;
  classId: ClassId;
  isHero: boolean;
  stats: Stats;
  x: number;
  z: number;
}

export interface BattleSetup {
  seed: number;
  units: UnitSetup[];
}

function createUnit(id: number, s: UnitSetup): Unit {
  return {
    id,
    team: s.team,
    classId: s.classId,
    isHero: s.isHero,
    stats: { ...s.stats },
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
  };
}

export function createBattle(setup: BattleSetup): Battle {
  return {
    tick: 0,
    rngState: seedState(setup.seed),
    arena: { width: ARENA.width, depth: ARENA.depth },
    units: setup.units.map((u, i) => createUnit(i + 1, u)),
    countdown: COUNTDOWN,
    outcome: 'running',
  };
}

export function heroOf(battle: Battle): Unit | undefined {
  return battle.units.find((u) => u.isHero);
}

/**
 * Advances the battle by one fixed tick. Depends only on the battle state,
 * the hero input and the seeded RNG held in the state.
 */
export function step(battle: Battle, input: HeroInput, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (battle.outcome !== 'running') return events;
  battle.tick++;

  if (battle.countdown > 0) {
    const before = Math.ceil(battle.countdown);
    battle.countdown = Math.max(0, battle.countdown - dt);
    const after = Math.ceil(battle.countdown);
    if (after !== before) events.push({ type: 'countdown', value: after });
    return events;
  }

  for (const unit of battle.units) {
    if (unit.isHero) bufferHeroInput(unit, input, dt);
    if (unit.state !== 'stunned') unit.staggerImmunity = Math.max(0, unit.staggerImmunity - dt);
    if (unit.state !== 'dead') {
      if (unit.hitstop > 0) {
        unit.hitstop = Math.max(0, unit.hitstop - dt);
        continue;
      }
      if (unit.isHero) updateHero(battle, unit, input, dt, events);
      else updateEnemy(battle, unit, dt, events);
    } else {
      unit.stateTime += dt;
    }
    applyKnockback(unit, dt);
  }

  separate(battle);
  for (const unit of battle.units) keepInBounds(battle, unit);

  const hero = heroOf(battle);
  if (!hero || !isAlive(hero)) {
    battle.outcome = 'lost';
    events.push({ type: 'outcome', outcome: 'lost' });
  } else if (!battle.units.some((u) => u.team === 'enemy' && isAlive(u))) {
    battle.outcome = 'won';
    events.push({ type: 'outcome', outcome: 'won' });
  }
  return events;
}
