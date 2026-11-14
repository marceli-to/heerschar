import { CLASS_STATS } from './classes';
import { formationSetup, type BattleSetup } from '../sim/battle';
import type { ClassId, Stats } from '../sim/types';

/**
 * Squad battles are tougher than the bare class lines (approved by Marcel in 2f): everyone has
 * more health and companions and enemies hit harder, so the hero cannot win alone and battles
 * last longer. The hero's own damage stays as tuned in Stage 1.
 */
export const SQUAD_SCALE = { hp: 1.5, armyPower: 1.2 } as const;

function heroStats(s: Stats): Stats {
  return { ...s, maxHp: s.maxHp * SQUAD_SCALE.hp };
}

function armyStats(s: Stats): Stats {
  return { ...s, maxHp: s.maxHp * SQUAD_SCALE.hp, power: s.power * SQUAD_SCALE.armyPower };
}

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
 * Stage 2 squad battle: the hero (warrior by default) and four companions against six: Schildtraeger,
 * Krieger, Berserker up front; Bogenschuetze, Schamane, Magier behind.
 */
export function squadSetup(seed: number, heroClass: ClassId = 'krieger'): BattleSetup {
  const s = CLASS_STATS;
  return formationSetup(
    seed,
    [
      { classId: heroClass, col: 1, row: 0, isHero: true, stats: heroStats(s[heroClass]) },
      { classId: 'krieger', col: 0, row: 0, stats: armyStats(s.krieger) },
      { classId: 'bogenschuetze', col: 0, row: 1, stats: armyStats(s.bogenschuetze) },
      { classId: 'heiler', col: 1, row: 1, stats: armyStats(s.heiler) },
      { classId: 'magier', col: 2, row: 1, stats: armyStats(s.magier) },
    ],
    [
      { classId: 'schildtraeger', col: 0, row: 0, stats: armyStats(s.schildtraeger) },
      { classId: 'krieger', col: 1, row: 0, stats: armyStats(s.krieger) },
      { classId: 'berserker', col: 2, row: 0, stats: armyStats(s.berserker) },
      { classId: 'bogenschuetze', col: 0, row: 1, stats: armyStats(s.bogenschuetze) },
      { classId: 'schamane', col: 1, row: 1, stats: armyStats(s.schamane) },
      { classId: 'magier', col: 2, row: 1, stats: armyStats(s.magier) },
    ],
  );
}
