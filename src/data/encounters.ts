import { CLASS_STATS } from './classes';
import type { BattleSetup } from '../sim/battle';

/** Stage 1 feel test: the warrior hero alone against three melee raiders. */
export function trialSetup(seed: number): BattleSetup {
  const raider = { ...CLASS_STATS.krieger, maxHp: 170, power: 18, armor: 30 };
  return {
    seed,
    units: [
      { team: 'player', classId: 'krieger', isHero: true, stats: { ...CLASS_STATS.krieger }, x: -8, z: 0 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 8, z: -3 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 9, z: 0 },
      { team: 'enemy', classId: 'krieger', isHero: false, stats: raider, x: 8, z: 3 },
    ],
  };
}
