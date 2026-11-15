/**
 * Hero curve finder, not a test:
 * `REPORT=1 [RUNS=20] [HEROES=krieger] [ONLY=…] npx vitest run tests/balance/heroTune.test.ts`
 *
 * Per hero class and encounter, bisects a factor on the hero's health and power (on top of
 * `HERO_HP` / `HERO_POWER`) until the bot's win rate sits at the middle of the encounter's band.
 * Prints `class encounter level factor` lines; a line per class through them gives the hero curve.
 */
import { it } from 'vitest';
import { NODES } from '../../src/data/campaign';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import { characterOf, type GameState } from '../../src/meta/game';
import { battleSetupFor, HERO_ID } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';
import { snapshots } from './walk';

const RUNS = Number(process.env.RUNS ?? 20);
const HEROES = (process.env.HEROES?.split(',') ?? ['krieger', 'bogenschuetze', 'heiler', 'magier']) as PlayableClassId[];
const AIM = { battle: 0.8, elite: 0.575, boss: 0.475 } as const;

it.skipIf(!process.env.REPORT)('hero curve finder', () => {
  const only = process.env.ONLY?.split(',');
  for (const k of HEROES) {
    const walks: Map<EncounterId, GameState>[] = Array.from({ length: 4 }, (_, w) => snapshots(k, w + 1));
    for (const node of NODES) {
      if (node.kind === 'camp' || (only && !only.includes(node.id))) continue;
      const id = node.id as EncounterId;
      const enc = encounterById(id);
      const play = (f: number): number => {
        let w = 0;
        for (let r = 0; r < RUNS; r++) {
          const setup = battleSetupFor(walks[r % 4]!.get(id)!.squad, enc, 1000 + r);
          const hero = setup.units.find((u) => u.isHero)!;
          hero.stats = { ...hero.stats, maxHp: hero.stats.maxHp * f, power: hero.stats.power * f };
          if (playHeadless(setup, 240).outcome === 'won') w++;
        }
        return w / RUNS;
      };
      const aim = AIM[node.kind as keyof typeof AIM];
      let lo = Math.log(0.4), hi = Math.log(2.5);
      for (let i = 0; i < 6; i++) {
        const mid = (lo + hi) / 2;
        if (play(Math.exp(mid)) > aim) hi = mid;
        else lo = mid;
      }
      const level = characterOf(walks[0]!.get(id)!, HERO_ID).level;
      process.stderr.write(`TUNE ${k} ${id} ${level} ${Math.exp((lo + hi) / 2).toFixed(3)}\n`);
    }
  }
}, 3_600_000);
