/**
 * Boss report, not a test: `REPORT=1 npx vitest run tests/balance/boss.test.ts` plays each boss
 * battle with the sandbox squad at the encounter's level (no upgrades or items) and prints win
 * rate, length, squad left standing, and damage by source ("H<" = taken by the hero, "E:" = dealt
 * by the enemy to the rest, "P:" = dealt by the squad to the boss or the others).
 * `STR=1` overrides the encounter strength; `SWAP=schildtraeger` puts a plain unit in the boss slot.
 */
import { it } from 'vitest';
import { encounterById, type Encounter } from '../../src/data/encounters';
import { SANDBOX_COMPANIONS, newSquad } from '../../src/data/roster';
import { battleSetupFor } from '../../src/meta/squad';
import { isBossClass } from '../../src/sim/body';
import { playHeadless } from '../../src/sim/headless';
import type { ClassId } from '../../src/sim/types';

const RUNS = Number(process.env.RUNS ?? 20);

it.skipIf(!process.env.REPORT)('boss report', () => {
  const rows: string[] = [];
  for (const id of ['ironWarlord', 'fenWitch', 'boneKing'] as const) {
    const base = encounterById(id);
    const swap = process.env.SWAP as ClassId | undefined;
    const enc: Encounter = {
      ...base,
      strength: Number(process.env.STR ?? base.strength),
      enemies: base.enemies.map((e) => (swap && isBossClass(e.classId) ? { ...e, classId: swap } : e)),
    };
    let wins = 0, secs = 0, alive = 0;
    const dmg: Record<string, number> = {};
    for (let seed = 1; seed <= RUNS; seed++) {
      const s = newSquad('krieger', 'H', SANDBOX_COMPANIONS);
      for (const c of s.roster) c.level = enc.level;
      const r = playHeadless(battleSetupFor(s, enc, seed), 240);
      if (r.outcome === 'won') wins++;
      secs += r.seconds;
      alive += r.battle.units.filter((u) => u.team === 'player' && u.state !== 'dead').length;
      const byId = new Map(r.battle.units.map((u) => [u.id, u]));
      for (const e of r.events) {
        if (e.type !== 'hit') continue;
        const a = byId.get(e.attackerId)!;
        const t = byId.get(e.targetId)!;
        const k = a.team === 'enemy' ? (t.isHero ? 'H<' : 'E:') + a.classId : 'P:' + (isBossClass(t.classId) ? 'boss' : 'others');
        dmg[k] = (dmg[k] ?? 0) + e.amount / RUNS;
      }
    }
    const d = Object.entries(dmg).map(([k, v]) => `${k} ${Math.round(v)}`).join('  ');
    rows.push(`${id.padEnd(12)} win ${String(Math.round((wins / RUNS) * 100)).padStart(3)}%  ${(secs / RUNS).toFixed(0).padStart(4)} s  standing ${(alive / RUNS).toFixed(1)}  ${d}`);
  }
  process.stderr.write(rows.join('\n') + '\n');
}, 900_000);
