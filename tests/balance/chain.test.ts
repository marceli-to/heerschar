import { it } from 'vitest';
import type { CampId } from '../../src/data/campaign';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import { campaignWon, characterOf, newGame, recordBattle } from '../../src/meta/game';
import { battleSetupFor, HERO_ID } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';
import { nextNode, settle, visitCamp } from './walk';

/**
 * Campaign report, not a test: `REPORT=1 [RUNS=6] [HEROES=krieger,…] npx vitest run tests/balance/chain.test.ts`
 * lets the bot play the whole map per hero class, node by node in map order (`nextNode`): camps
 * recruit one of the two offers, a lost battle is retried up to `TRIES` times (as a player would;
 * an elite still lost after that is skipped, it is a side road),
 * level-ups are seeded picks, loot the rarest item. Prints how many runs finished, the tries per
 * battle and the hero's level at the end.
 */
const RUNS = Number(process.env.RUNS ?? 6);
const TRIES = 5;

it.skipIf(!process.env.REPORT)('campaign chain report', () => {
  const rows: string[] = [];
  for (const k of (process.env.HEROES?.split(',') ?? ['krieger', 'bogenschuetze', 'heiler', 'magier']) as PlayableClassId[]) {
    const tally = new Map<EncounterId, { fights: number; wins: number }>();
    let finished = 0, level = 0;
    const stuck: string[] = [];
    for (let run = 1; run <= RUNS; run++) {
      const s = newGame(k, 'Hero', run);
      const done = new Set<string>();
      let seed = run * 1000, pick = run;
      for (let node = nextNode(s, done); node; node = nextNode(s, done)) {
        if (node.kind === 'camp') {
          visitCamp(s, node.id as CampId, pick++);
          done.add(node.id);
          continue;
        }
        const id = node.id as EncounterId;
        const t = tally.get(id) ?? { fights: 0, wins: 0 };
        tally.set(id, t);
        let won = false;
        for (let i = 0; i < TRIES && !won; i++) {
          won = playHeadless(battleSetupFor(s.squad, encounterById(id), seed++), 240).outcome === 'won';
          t.fights++;
          if (won) t.wins++;
          recordBattle(s, id, won);
          settle(s, pick++);
        }
        done.add(node.id);
        // Elites are side roads: a player who cannot win one walks on.
        if (!won && node.kind !== 'elite') {
          stuck.push(id);
          break;
        }
      }
      if (campaignWon(s)) finished++;
      level += characterOf(s, HERO_ID).level;
    }
    const per = [...tally].map(([id, t]) => `${id} ${Math.round((t.wins / t.fights) * 100)}%`).join('  ');
    rows.push(`${k.padEnd(14)} finished ${finished}/${RUNS}  hero level ${(level / RUNS).toFixed(1)}  stuck at: ${stuck.join(', ') || '-'}\n    ${per}`);
  }
  process.stderr.write(rows.join('\n') + '\n');
}, 3_600_000);
