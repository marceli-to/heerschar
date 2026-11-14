import { it } from 'vitest';
import { ENCOUNTERS, encounterById } from '../../src/data/encounters';
import { itemById } from '../../src/data/items';
import { characterOf, choose, currentChoice, equip, newGame, recordBattle, takeLoot, type GameState } from '../../src/meta/game';
import { battleSetupFor, HERO_ID } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';

/**
 * Chain report, not a test: `REPORT=1 npx vitest run tests/balance/chain.test.ts` lets the bot
 * play the ten-battle chain per hero class (sandbox squad, default formation), retrying a lost
 * battle up to `TRIES` times, settling level-ups with a random option and taking the best loot.
 * Prints the win rate per battle and the hero's level.
 */
const RUNS = Number(process.env.RUNS ?? 6);
const TRIES = 5;

function settle(s: GameState, seed: number): void {
  for (let c = currentChoice(s); c; c = currentChoice(s)) choose(s, c.options![seed % c.options!.length]!);
  const loot = s.rewards?.loot;
  if (!loot) return;
  const rank = { common: 0, rare: 1, epic: 2 } as const;
  const best = [...loot].sort((a, b) => rank[itemById(b).rarity] - rank[itemById(a).rarity])[0]!;
  takeLoot(s, best);
  // Equip it on the first fielded character with that slot free (or wearing something worse).
  const item = itemById(best);
  for (const id of s.squad.fielded) {
    const c = characterOf(s, id);
    const worn = c[item.slot];
    if ((item.classId === null || item.classId === c.classId) && (!worn || rank[itemById(worn).rarity] < rank[item.rarity])) {
      equip(s, id, best);
      return;
    }
  }
}

it.skipIf(!process.env.REPORT)('chain report', () => {
  const rows: string[] = [];
  for (const k of (process.env.HEROES?.split(',') ?? ['krieger', 'bogenschuetze', 'heiler', 'magier']) as PlayableClassId[]) {
    const tries = ENCOUNTERS.map(() => ({ fights: 0, wins: 0 }));
    let finished = 0;
    let level = 0;
    for (let run = 1; run <= RUNS; run++) {
      const s = newGame(k, 'Hero', run);
      let seed = run * 1000;
      let ok = true;
      for (const [i, e] of ENCOUNTERS.entries()) {
        let won = false;
        for (let t = 0; t < TRIES && !won; t++) {
          const r = playHeadless(battleSetupFor(s.squad, encounterById(e.id), seed++));
          won = r.outcome === 'won';
          tries[i]!.fights++;
          if (won) tries[i]!.wins++;
          recordBattle(s, e.id, won);
          settle(s, seed);
        }
        if (!won) {
          ok = false;
          break;
        }
      }
      if (ok) finished++;
      level += characterOf(s, HERO_ID).level;
    }
    rows.push(`${k.padEnd(14)} finished ${finished}/${RUNS}  hero level ${(level / RUNS).toFixed(1)}  ` + tries.map((t, i) => `${ENCOUNTERS[i]!.id} ${t.fights ? Math.round((t.wins / t.fights) * 100) : '-'}%`).join('  '));
  }
  process.stderr.write(rows.join('\n') + '\n');
}, 600_000);
