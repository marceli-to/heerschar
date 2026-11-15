import { ARENA, COUNTDOWN, FORMATION } from './balance';
import { updateAi } from './ai';
import { isAlive } from './combat';
import { bufferHeroInput, updateHero } from './heroControl';
import { clearDeadTargets, updateTargeting } from './heroTargeting';
import { applyKnockback, keepInBounds, separate } from './movement';
import { updateAreas, updateProjectiles } from './projectiles';
import { seedState } from './rng';
import { hasStatus, tickStatuses } from './statuses';
import { createUnit, type UnitSetup } from './units';
import { emptyInput, type Battle, type BattleEvent, type ClassId, type HeroInput, type Stats, type Team, type Unit, type UnitMods } from './types';

export type { UnitSetup } from './units';

export interface BattleSetup {
  seed: number;
  units: UnitSetup[];
  /** Debug: enemies stand still and never act (they can still be hit). */
  passiveEnemies?: boolean;
  /** Stats of the units bosses may summon, by class. */
  reserves?: Partial<Record<ClassId, Stats>>;
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
    settled: false,
    reserves: { ...setup.reserves },
  };
}

export function heroOf(battle: Battle): Unit | undefined {
  return battle.units.find((u) => u.isHero);
}

/**
 * Advances the battle by one fixed tick. Depends only on the battle state,
 * the hero input and the seeded RNG held in the state.
 */
/** A living unit after the battle has settled: drops whatever it was doing and stands idle. */
function standDown(unit: Unit, dt: number): void {
  if (unit.state !== 'idle') {
    unit.state = 'idle';
    unit.stateTime = 0;
    unit.action = null;
    unit.chain = 0;
  }
  unit.stateTime += dt;
}

export function step(battle: Battle, input: HeroInput, dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  // After the outcome the battle runs on as an aftermath (falls finish, shots land) for the
  // view's final-blow slow motion: no hero input, and the outcome is never reported again.
  const aftermath = battle.outcome !== 'running';
  if (aftermath) input = emptyInput();
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
    unit.dodgeStunImmunity = Math.max(0, unit.dodgeStunImmunity - dt);
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
      if (battle.settled) standDown(unit, dt);
      else if (unit.isHero) updateHero(battle, unit, input, dt, events);
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

  if (aftermath) return events;
  if (!hero || !isAlive(hero)) {
    battle.outcome = 'lost';
    events.push({ type: 'outcome', outcome: 'lost' });
  } else if (!battle.units.some((u) => u.team === 'enemy' && isAlive(u))) {
    battle.outcome = 'won';
    events.push({ type: 'outcome', outcome: 'won' });
  }
  return events;
}
