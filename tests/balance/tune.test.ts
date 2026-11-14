/**
 * Strength finder, not a test: `REPORT=1 [RUNS=12] [ONLY=…] npx vitest run tests/balance/tune.test.ts`
 * bisects each encounter's strength toward the middle of its win band (standard 80 %, elite 57 %,
 * boss 47 %) with the squads of `snapshots`, `RUNS` battles per hero class per probe, and prints
 * the strength found with the solo win rate there. Copy the numbers into `ENCOUNTERS`.
 */
import { it } from 'vitest';
import { NODES } from '../../src/data/campaign';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import type { GameState } from '../../src/meta/game';
import { battleSetupFor } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';
import { snapshots } from './walk';

const RUNS = Number(process.env.RUNS ?? 12);
const HEROES: PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];
const AIM = { battle: 0.8, elite: 0.575, boss: 0.475 } as const;

it.skipIf(!process.env.REPORT)('strength finder', () => {
  const walks = new Map(HEROES.map((k) => [k, Array.from({ length: 4 }, (_, w) => snapshots(k, w + 1))] as const));
  const only = process.env.ONLY?.split(',');
  const play = (id: EncounterId, strength: number, solo: boolean): number => {
    const enc = { ...encounterById(id), strength };
    let w = 0, n = 0;
    for (const k of HEROES) {
      for (let r = 0; r < RUNS; r++) {
        const g: GameState = walks.get(k)![r % 4]!.get(id)!;
        const setup = battleSetupFor(g.squad, enc, 1000 + r);
        if (solo) setup.units = setup.units.filter((u) => u.team === 'enemy' || u.isHero);
        if (playHeadless(setup, 240).outcome === 'won') w++;
        n++;
      }
    }
    return w / n;
  };
  const rows: string[] = [];
  for (const node of NODES) {
    if (node.kind === 'camp' || (only && !only.includes(node.id))) continue;
    const id = node.id as EncounterId;
    const aim = AIM[node.kind as keyof typeof AIM];
    let lo = Math.log(0.3), hi = Math.log(10);
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (play(id, Math.exp(mid), false) > aim) lo = mid;
      else hi = mid;
    }
    const s = Math.round(Math.exp((lo + hi) / 2) * 20) / 20;
    rows.push(`${id.padEnd(14)} ${encounterById(id).strength.toFixed(2)} -> ${s.toFixed(2)}  win ${Math.round(play(id, s, false) * 100)}%  solo ${node.kind === 'battle' ? Math.round(play(id, s, true) * 100) + '%' : '-'}`);
    process.stderr.write(rows[rows.length - 1] + '\n');
  }
}, 3_600_000);
