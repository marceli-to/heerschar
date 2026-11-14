import { createBattle, step, type UnitSetup } from '../../src/sim/battle';
import { DT } from '../../src/sim/balance';
import { CLASS_STATS } from '../../src/data/classes';
import { emptyInput, type Battle, type BattleEvent, type HeroInput } from '../../src/sim/types';

export function hero(x = 0, z = 0): UnitSetup {
  return { team: 'player', classId: 'krieger', isHero: true, stats: { ...CLASS_STATS.krieger }, x, z };
}

export function enemy(x: number, z = 0): UnitSetup {
  return { team: 'enemy', classId: 'krieger', isHero: false, stats: { ...CLASS_STATS.krieger }, x, z };
}

/** A battle with the countdown already over. */
export function battleWith(units: UnitSetup[], seed = 1): Battle {
  const b = createBattle({ seed, units });
  b.countdown = 0;
  return b;
}

export function input(p: Partial<HeroInput> = {}): HeroInput {
  return { ...emptyInput(), ...p };
}

/** Runs `ticks` steps with the same input (presses only on the first tick). */
export function run(b: Battle, ticks: number, p: Partial<HeroInput> = {}): BattleEvent[] {
  const events: BattleEvent[] = [];
  for (let i = 0; i < ticks; i++) {
    const inp = input(p);
    if (i > 0) {
      inp.attack = false;
      inp.dodge = false;
    }
    events.push(...step(b, inp, DT));
  }
  return events;
}

export function seconds(s: number): number {
  return Math.round(s / DT);
}
