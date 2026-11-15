/**
 * Strength finder, not a test: `REPORT=1 [RUNS=12] [ONLY=…] npx vitest run tests/balance/tune.test.ts`
 * bisects each encounter's strength toward the middle of its win band (standard 80 %, elite 57 %,
 * boss 47 %) with the squads of `snapshots`, `RUNS` battles per hero class per probe, and prints
 * the strength found with the win rate per class and the solo win rate there (`AIM=0.75,0.5,0.4` aims
 * elsewhere in the bands; `MIN=1` aims the weakest hero class instead of the average). Copy the numbers into `ENCOUNTERS`.
 */
import { it } from 'vitest';
import { NODES } from '../../src/data/campaign';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import type { GameState } from '../../src/meta/game';
import { battleSetupFor } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';
import { snapshots } from './walk';

const RUNS = Number(process.env.RUNS ?? 16);
const WALKS = Number(process.env.WALKS ?? 8);
const HEROES: PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];
/** `AIM=0.75,0.5,0.4` aims standard, elite and boss battles elsewhere in their bands. */
const [battle = 0.8, elite = 0.575, boss = 0.475] = (process.env.AIM?.split(',') ?? []).map(Number);
const AIM = { battle, elite, boss } as const;

it.skipIf(!process.env.REPORT)('strength finder', () => {
  const walks = new Map(HEROES.map((k) => [k, Array.from({ length: WALKS }, (_, w) => snapshots(k, w + 1))] as const));
  const only = process.env.ONLY?.split(',');
  /** Win rate per hero class. */
  const perClass = (id: EncounterId, strength: number, solo: boolean): number[] => {
    const enc = { ...encounterById(id), strength };
    return HEROES.map((k) => {
      let w = 0;
      for (let r = 0; r < RUNS; r++) {
        const g: GameState = walks.get(k)![r % WALKS]!.get(id)!;
        const setup = battleSetupFor(g.squad, enc, 1000 + r);
        if (solo) setup.units = setup.units.filter((u) => u.team === 'enemy' || u.isHero);
        if (playHeadless(setup, 240).outcome === 'won') w++;
      }
      return w / RUNS;
    });
  };
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const play = (id: EncounterId, strength: number, solo: boolean): number => mean(perClass(id, strength, solo));
  /** `MIN=1` aims the weakest hero class at the target instead of the average over classes. */
  const aimed = (id: EncounterId, strength: number): number => {
    const xs = perClass(id, strength, false);
    return process.env.MIN ? Math.min(...xs) : mean(xs);
  };
  const rows: string[] = [];
  for (const node of NODES) {
    if (node.kind === 'camp' || (only && !only.includes(node.id))) continue;
    const id = node.id as EncounterId;
    const aim = AIM[node.kind as keyof typeof AIM];
    let lo = Math.log(0.3), hi = Math.log(10);
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      if (aimed(id, Math.exp(mid)) > aim) lo = mid;
      else hi = mid;
    }
    const s = Math.round(Math.exp((lo + hi) / 2) * 20) / 20;
    const xs = perClass(id, s, false);
    rows.push(`${id.padEnd(14)} ${encounterById(id).strength.toFixed(2)} -> ${s.toFixed(2)}  win ${Math.round(mean(xs) * 100)}% (${xs.map((x) => Math.round(x * 100)).join(' ')})  solo ${node.kind === 'battle' ? Math.round(play(id, s, true) * 100) + '%' : '-'}`);
    process.stderr.write(rows[rows.length - 1] + '\n');
  }
}, 3_600_000);
