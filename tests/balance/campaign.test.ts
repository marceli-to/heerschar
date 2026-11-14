/**
 * Campaign balance report (PLAN section 13), not a test:
 * `REPORT=1 [RUNS=200] [WALKS=4] [HEROES=krieger,…] [ONLY=raiders,…] npx vitest run tests/balance/campaign.test.ts`
 *
 * Each encounter is played by the bot with the squad a player brings there (`snapshots`: the map
 * walked in order, every node once), `RUNS` battles spread over `WALKS` walks per hero class.
 * Prints per encounter: win rate per hero class and overall against its target band (standard
 * 70–90 %, elite 45–70 %, boss 35–60 %), mean length (standard 45–150 s), the hero's damage share
 * (20–30 %) and the bot hero alone (standard battles < 5 %). `!` marks a number off target.
 */
import { it } from 'vitest';
import { NODES, nodeById } from '../../src/data/campaign';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import { battleSetupFor } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';
import type { PlayableClassId } from '../../src/sim/types';
import type { GameState } from '../../src/meta/game';
import { snapshots } from './walk';

const RUNS = Number(process.env.RUNS ?? 40);
const WALKS = Number(process.env.WALKS ?? 4);
const HEROES = (process.env.HEROES?.split(',') ?? ['krieger', 'bogenschuetze', 'heiler', 'magier']) as PlayableClassId[];
const MAX_SECONDS = 240;
/** `STRS=raiders=1.4,farmstead=1.5` tries other strengths without editing the data. */
const STRS: Record<string, number> = Object.fromEntries((process.env.STRS ?? '').split(',').filter(Boolean).map((x) => [x.split('=')[0], Number(x.split('=')[1])]));

const TARGETS = {
  battle: { win: [0.7, 0.9], seconds: [45, 150] },
  elite: { win: [0.45, 0.7], seconds: [45, 180] },
  boss: { win: [0.35, 0.6], seconds: [45, 210] },
} as const;

const pct = (x: number) => `${Math.round(x * 100)}`.padStart(3) + '%';
const flag = (x: number, [lo, hi]: readonly [number, number]) => (x < lo || x > hi ? '!' : ' ');

it.skipIf(!process.env.REPORT)('campaign balance report', () => {
  const walks = new Map<PlayableClassId, Map<EncounterId, GameState>[]>();
  for (const k of HEROES) walks.set(k, Array.from({ length: WALKS }, (_, w) => snapshots(k, w + 1)));
  const only = process.env.ONLY?.split(',');
  const rows: string[] = [`${'encounter'.padEnd(14)} lvl  str  ` + HEROES.map((k) => k.slice(0, 5).padStart(6)).join('') + '    all    secs  share   solo  t/o'];
  for (const node of NODES) {
    if (node.kind === 'camp' || (only && !only.includes(node.id))) continue;
    const id = node.id as EncounterId;
    const enc = { ...encounterById(id), strength: STRS[id] ?? encounterById(id).strength * Number(process.env.SCALE ?? 1) };
    const target = TARGETS[nodeById(id).kind as keyof typeof TARGETS];
    let timeouts = 0, wins = 0, fights = 0, secs = 0, share = 0, solo = 0, soloFights = 0;
    const perHero: string[] = [];
    for (const k of HEROES) {
      let w = 0;
      for (let r = 0; r < RUNS; r++) {
        const game = walks.get(k)![r % WALKS]!.get(id)!;
        const setup = battleSetupFor(game.squad, enc, 1000 + r);
        const res = playHeadless(setup, MAX_SECONDS);
        if (res.outcome === 'won') w++;
        if (res.outcome === 'running') timeouts++;
        secs += res.seconds;
        share += res.playerDamage > 0 ? res.heroDamage / res.playerDamage : 0;
        if (node.kind === 'battle' && r < RUNS / 4) {
          setup.units = setup.units.filter((u) => u.team === 'enemy' || u.isHero);
          if (playHeadless(setup, MAX_SECONDS).outcome === 'won') solo++;
          soloFights++;
        }
      }
      wins += w;
      fights += RUNS;
      perHero.push(pct(w / RUNS).padStart(6));
    }
    const win = wins / fights, s = secs / fights, sh = share / fights;
    const soloCol = soloFights ? pct(solo / soloFights) + (solo / soloFights >= 0.05 ? '!' : ' ') : '   -  ';
    rows.push(
      `${id.padEnd(14)} ${String(enc.level).padStart(3)}  ${enc.strength.toFixed(2)} ${perHero.join('')}  ${pct(win)}${flag(win, target.win)}  ${s.toFixed(0).padStart(4)}${flag(s, target.seconds)}  ${pct(sh)}${flag(sh, [0.35, 0.5])}  ${soloCol}  ${pct(timeouts / fights)}`,
    );
  }
  process.stderr.write(rows.join('\n') + '\n');
}, 3_600_000);
