import { CLASS_STATS } from './classes';
import { formationSetup, type BattleSetup } from '../sim/battle';
import type { ClassId } from '../sim/types';

/** Stage 1 feel test: the hero (warrior by default) alone against three melee raiders. */
export function trialSetup(seed: number, heroClass: ClassId = 'krieger'): BattleSetup {
  const raider = { ...CLASS_STATS.krieger, maxHp: 170, power: 18, armor: 30 };
  return {
    seed,
    units: [
      { team: 'player', classId: heroClass, isHero: true, stats: { ...CLASS_STATS[heroClass] }, x: -8, z: 0 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 8, z: -3 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 9, z: 0 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 8, z: 3 },
    ],
  };
}

/**
 * Stage 2 squad battle: the warrior hero and four companions against six: Schildtraeger,
 * Krieger, Berserker up front; Bogenschuetze, Schamane, Magier behind.
 */
export function squadSetup(seed: number): BattleSetup {
  const s = CLASS_STATS;
  return formationSetup(
    seed,
    [
      { classId: 'krieger', col: 1, row: 0, isHero: true, stats: s.krieger },
      { classId: 'krieger', col: 0, row: 0, stats: s.krieger },
      { classId: 'bogenschuetze', col: 0, row: 1, stats: s.bogenschuetze },
      { classId: 'heiler', col: 1, row: 1, stats: s.heiler },
      { classId: 'magier', col: 2, row: 1, stats: s.magier },
    ],
    [
      { classId: 'schildtraeger', col: 0, row: 0, stats: s.schildtraeger },
      { classId: 'krieger', col: 1, row: 0, stats: s.krieger },
      { classId: 'berserker', col: 2, row: 0, stats: s.berserker },
      { classId: 'bogenschuetze', col: 0, row: 1, stats: s.bogenschuetze },
      { classId: 'schamane', col: 1, row: 1, stats: s.schamane },
      { classId: 'magier', col: 2, row: 1, stats: s.magier },
    ],
  );
}
