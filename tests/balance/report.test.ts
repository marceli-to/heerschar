import { it } from 'vitest';
import { squadSetup } from '../../src/data/encounters';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';

/**
 * Balance report, not a test: `REPORT=1 npx vitest run tests/balance` prints the bot's win
 * rate, battle length and damage share per hero class, with and without companions.
 */
const RUNS = Number(process.env.RUNS ?? 40);

it.skipIf(!process.env.REPORT)('balance report', () => {
  const rows: string[] = [];
  for (const c of ['krieger', 'bogenschuetze', 'heiler', 'magier'] as PlayableClassId[]) {
    for (const solo of [false, true]) {
      let wins = 0;
      let secs = 0;
      let share = 0;
      for (let seed = 1; seed <= RUNS; seed++) {
        const setup = squadSetup(seed, c);
        if (solo) setup.units = setup.units.filter((u) => u.team === 'enemy' || u.isHero);
        const r = playHeadless(setup);
        if (r.outcome === 'won') wins++;
        secs += r.seconds;
        share += r.playerDamage > 0 ? r.heroDamage / r.playerDamage : 0;
      }
      rows.push(`${c.padEnd(14)} ${solo ? 'solo ' : 'squad'}  win ${((wins / RUNS) * 100).toFixed(0).padStart(3)}%  ${(secs / RUNS).toFixed(1).padStart(5)} s  hero share ${((share / RUNS) * 100).toFixed(0)}%`);
    }
  }
  process.stderr.write(rows.join("\n") + "\n");
}, 600_000);
