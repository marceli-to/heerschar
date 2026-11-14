import { ARENA } from './balance';
import { seedState } from './rng';
import type { Battle, BattleEvent, HeroInput } from './types';

export interface BattleSetup {
  seed: number;
}

export function createBattle(setup: BattleSetup): Battle {
  return {
    tick: 0,
    rngState: seedState(setup.seed),
    arena: { width: ARENA.width, depth: ARENA.depth },
    units: [],
    outcome: 'running',
  };
}

/**
 * Advances the battle by one fixed tick. Depends only on the battle state,
 * the hero input and the seeded RNG held in the state.
 */
export function step(battle: Battle, _input: HeroInput, _dt: number): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (battle.outcome !== 'running') return events;
  battle.tick++;
  return events;
}
