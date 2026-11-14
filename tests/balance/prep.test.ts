/**
 * Preparation report, not a test: `REPORT=1 npx vitest run tests/balance/prep.test.ts` prints, per
 * encounter, how the bot squad fares with other compositions and formations.
 */
import { it } from 'vitest';
import { ENCOUNTERS } from '../../src/data/encounters';
import { SANDBOX_COMPANIONS, newSquad } from '../../src/data/roster';
import { battleSetupFor, HERO_ID, placeCharacter, setFielded, type SquadState } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';

const RUNS = Number(process.env.RUNS ?? 30);
type V = [string, (s: SquadState) => void];
const byName = (s: SquadState, n: string) => s.roster.find((c) => c.name === n)!.id;
const swap = (s: SquadState, out: string, inn: string) => { setFielded(s, byName(s, out), false); setFielded(s, byName(s, inn), true); };
const variants: V[] = [
  ['default', () => {}],
  ['no mage', (s) => swap(s, 'Osric', 'Wulf')],
  ['2 mages', (s) => swap(s, 'Hilde', 'Ansel')],
  ['no healer', (s) => swap(s, 'Maren', 'Ansel')],
  ['hero back', (s) => { const back = s.fielded.find((id) => s.formation[id]!.row === 1 && s.formation[id]!.col === 1)!; placeCharacter(s, HERO_ID, s.formation[back]!); }],
  ['healer front', (s) => { placeCharacter(s, byName(s, 'Maren'), { col: 0, row: 0 }); }],
  ['inverted', (s) => {
    for (const id of s.fielded) { const sl = s.formation[id]!; s.formation[id] = { col: sl.col, row: (1 - sl.row) as 0 | 1 }; }
  }],
];
it.skipIf(!process.env.REPORT)('prep experiment', () => {
  const rows: string[] = [];
  for (const enc of ENCOUNTERS) for (const [name, f] of variants) {
    let wins = 0, secs = 0, deaths = 0;
    for (let seed = 1; seed <= RUNS; seed++) {
      const s = newSquad('krieger', 'H', SANDBOX_COMPANIONS); f(s);
      const r = playHeadless(battleSetupFor(s, enc, seed));
      if (r.outcome === 'won') wins++;
      secs += r.seconds;
      deaths += r.battle.units.filter((u) => u.team === 'player' && u.state === 'dead').length;
    }
    rows.push(`${enc.id.padEnd(14)} ${name.padEnd(10)} win ${String(Math.round(wins / RUNS * 100)).padStart(3)}%  ${(secs / RUNS).toFixed(1).padStart(5)} s  fallen ${(deaths / RUNS).toFixed(1)}`);
  }
  process.stderr.write(rows.join('\n') + '\n');
}, 900_000);
