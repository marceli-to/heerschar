/**
 * Class spread diagnosis, not a test:
 * `REPORT=1 [RUNS=40] [HEROES=krieger] [ONLY=…] [STRS=…] npx vitest run tests/balance/diag.test.ts`
 *
 * Per hero class and encounter (squads of `snapshots`): win / timeout rate, the hero's level and
 * battle stats, the fielded squad, and for lost battles who landed the killing blow on the hero,
 * when, and how much enemy health was left.
 */
import { it } from 'vitest';
import { NODES } from '../../src/data/campaign';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import type { GameState } from '../../src/meta/game';
import { characterOf } from '../../src/meta/game';
import { characterStats } from '../../src/meta/progression';
import { battleSetupFor, fieldedCharacters, HERO_ID } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';
import { snapshots } from './walk';

const RUNS = Number(process.env.RUNS ?? 40);
const WALKS = 4;
const HEROES = (process.env.HEROES?.split(',') ?? ['krieger', 'bogenschuetze', 'heiler', 'magier']) as PlayableClassId[];
const STRS: Record<string, number> = Object.fromEntries((process.env.STRS ?? '').split(',').filter(Boolean).map((x) => [x.split('=')[0], Number(x.split('=')[1])]));

it.skipIf(!process.env.REPORT)('class spread diagnosis', () => {
  const only = process.env.ONLY?.split(',');
  const rows: string[] = [];
  for (const k of HEROES) {
    const walks: Map<EncounterId, GameState>[] = Array.from({ length: WALKS }, (_, w) => snapshots(k, w + 1));
    rows.push(`== ${k}`);
    for (const node of NODES) {
      if (node.kind === 'camp' || (only && !only.includes(node.id))) continue;
      const id = node.id as EncounterId;
      const enc = { ...encounterById(id), strength: STRS[id] ?? encounterById(id).strength };
      let won = 0, timeouts = 0, lossT = 0, enemyLeft = 0, losses = 0;
      const killers = new Map<string, number>();
      for (let r = 0; r < RUNS; r++) {
        const game = walks[r % WALKS]!.get(id)!;
        const setup = battleSetupFor(game.squad, enc, 1000 + r);
        const res = playHeadless(setup, 240);
        if (res.outcome === 'won') { won++; continue; }
        if (res.outcome === 'running') { timeouts++; continue; }
        losses++;
        lossT += res.seconds;
        const b = res.battle;
        const enemies = b.units.filter((u) => u.team === 'enemy');
        enemyLeft += enemies.reduce((a, u) => a + Math.max(0, u.hp), 0) / enemies.reduce((a, u) => a + u.stats.maxHp, 0);
        const lastHit = [...res.events].reverse().find((e) => e.type === 'hit' && e.targetId === 1);
        const killer = lastHit && lastHit.type === 'hit' ? b.units.find((u) => u.id === lastHit.attackerId)?.classId ?? 'area' : '?';
        killers.set(killer, (killers.get(killer) ?? 0) + 1);
      }
      const g = walks[0]!.get(id)!;
      const hero = characterOf(g, HERO_ID);
      const st = characterStats(hero);
      const squad = fieldedCharacters(g.squad).map((c) => c.classId.slice(0, 3) + c.level).join(' ');
      const kill = [...killers].sort((a, b) => b[1] - a[1]).map(([c, n]) => `${c}:${n}`).join(' ');
      rows.push(
        `${id.padEnd(14)} win ${String(Math.round((won / RUNS) * 100)).padStart(3)}% t/o ${String(timeouts).padStart(2)}  ` +
          `hero L${hero.level} hp ${st.maxHp.toFixed(0)} pw ${st.power.toFixed(0)} ar ${st.armor.toFixed(0)} rs ${st.resist.toFixed(0)}  ` +
          `loss@${losses ? (lossT / losses).toFixed(0) : '-'}s left ${losses ? Math.round((enemyLeft / losses) * 100) : '-'}%  by ${kill}  [${squad}]`,
      );
    }
  }
  process.stderr.write(rows.join('\n') + '\n');
}, 3_600_000);
