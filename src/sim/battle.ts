import { ARENA, COUNTDOWN, ENERGY, FORMATION } from './balance';
import { updateAi } from './ai';
import { isAlive } from './combat';
import { bufferHeroInput, updateHero } from './heroControl';
import { clearDeadTargets, updateTargeting } from './heroTargeting';
import { applyKnockback, keepInBounds, separate } from './movement';
import { updateAreas, updateProjectiles } from './projectiles';
import { seedState } from './rng';
import { hasStatus, tickStatuses } from './statuses';
import { NEUTRAL_MODS, type Battle, type BattleEvent, type ClassId, type HeroInput, type Stats, type Team, type Unit, type UnitMods } from './types';

export interface UnitSetup {
  team: Team;
  classId: ClassId;
  isHero: boolean;
  stats: Stats;
  /** Defaults to `NEUTRAL_MODS`. */
  mods?: Partial<UnitMods>;
  x: number;
  z: number;
}

export interface BattleSetup {
  seed: number;
  units: UnitSetup[];
  /** Debug: enemies stand still and never act (they can still be hit). */
  passiveEnemies?: boolean;
}

function createUnit(id: number, s: UnitSetup): Unit {
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
  };
}

export interface FormationSlot {
  classId: ClassId;
  /** 0..2, left to right as seen from the player side. */
  col: number;
  /** 0 = front, 1 = back. */
  row: number;
  isHero?: boolean;
  stats: Stats;
  mods?: Partial<UnitMods>;
}

/** World position of a formation slot. The player side stands on -x and faces +x. */
export function slotPosition(team: Team, col: number, row: number): { x: number; z: number } {
  const side = team === 'player' ? -1 : 1;
  const x = side * (FORMATION.frontX + row * FORMATION.rowGap);
  // Columns run left to right as each side sees it, so they mirror across the field.
  const z = (col - 1) * FORMATION.colGap * (team === 'player' ? 1 : -1);
  return { x, z };
}

/** Builds a battle setup from two formations of 3 × 2 slots. */
export function formationSetup(seed: number, player: FormationSlot[], enemy: FormationSlot[]): BattleSetup {
  const place = (team: Team) => (s: FormationSlot): UnitSetup => ({ team, classId: s.classId, isHero: s.isHero ?? false, stats: { ...s.stats }, ...(s.mods ? { mods: { ...s.mods } } : {}), ...slotPosition(team, s.col, s.row) });
  return { seed, units: [...player.map(place('player')), ...enemy.map(place('enemy'))] };
}

export function createBattle(setup: BattleSetup): Battle {
  return {
    tick: 0,
    rngState: seedState(setup.seed),
    arena: { width: ARENA.width, depth: ARENA.depth },
    units: setup.units.map((u, i) => createUnit(i + 1, u)),
    projectiles: [],
    areas: [],
    nextId: 1,
    markTargetId: null,
    lockTargetId: null,
    countdown: COUNTDOWN,
    outcome: 'running',
    passiveEnemies: setup.passiveEnemies ?? false,
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

  const hero = heroOf(battle);
  if (hero) updateTargeting(battle, hero, input, events);

  for (const unit of battle.units) {
    if (unit.isHero) bufferHeroInput(unit, input, dt);
    if (unit.state !== 'stunned') unit.staggerImmunity = Math.max(0, unit.staggerImmunity - dt);
    if (unit.state !== 'dead') {
      if (unit.hitstop > 0) {
        unit.hitstop = Math.max(0, unit.hitstop - dt);
        continue;
      }
      tickStatuses(unit, dt, events);
      if (hasStatus(unit, 'frozen')) {
        applyKnockback(unit, dt);
        continue;
      }
      if (unit.isHero) updateHero(battle, unit, input, dt, events);
      else if (!(battle.passiveEnemies && unit.team === 'enemy')) updateAi(battle, unit, dt, events);
      else unit.stateTime += dt;
    } else {
      unit.stateTime += dt;
    }
    applyKnockback(unit, dt);
  }

  updateProjectiles(battle, dt, events);
  updateAreas(battle, dt, events);
  clearDeadTargets(battle, events);

  separate(battle);
  for (const unit of battle.units) keepInBounds(battle, unit);

  if (!hero || !isAlive(hero)) {
    battle.outcome = 'lost';
    events.push({ type: 'outcome', outcome: 'lost' });
  } else if (!battle.units.some((u) => u.team === 'enemy' && isAlive(u))) {
    battle.outcome = 'won';
    events.push({ type: 'outcome', outcome: 'won' });
  }
  return events;
}
