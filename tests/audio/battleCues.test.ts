import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { battleCues, type CueContext } from '../../src/audio/battleCues';
import { BattleSound } from '../../src/audio/battleSound';
import { step } from '../../src/sim/battle';
import { DT } from '../../src/sim/balance';
import { botInput, createBot } from '../../src/sim/bot';
import type { BattleEvent } from '../../src/sim/types';
import { battleWith, hero, unit } from '../sim/helpers';

const SOUNDS = new Set(Object.keys(JSON.parse(readFileSync('public/audio/sfx/index.json', 'utf8')) as Record<string, number>));

function ctxOf(b: ReturnType<typeof battleWith>, region: CueContext['region'] = 'greenmarch'): CueContext {
  return { unit: (id) => b.units.find((u) => u.id === id), projectile: (id) => b.projectiles.find((p) => p.id === id), region };
}

describe('battle cues', () => {
  const b = battleWith([hero(0, 0), unit('player', 'krieger', 2), unit('enemy', 'berserker', 0, 5), unit('enemy', 'krieger', 2, 5)]);
  const hit = (attackerId: number, targetId: number, extra: Partial<Extract<BattleEvent, { type: 'hit' }>> = {}): BattleEvent => ({ type: 'hit', attackerId, targetId, amount: 10, absorbed: 0, heavy: false, x: 0, z: 0, ...extra });

  it('puts the hero first and the rest of the fight in the crowd', () => {
    expect(battleCues(hit(1, 3), ctxOf(b))[0]).toMatchObject({ sound: 'hitBlade', priority: 'hero' });
    expect(battleCues(hit(3, 1), ctxOf(b))[0]!.priority).toBe('hero');
    expect(battleCues(hit(2, 4), ctxOf(b))[0]!.priority).toBe('crowd');
  });

  it('a fully absorbed blow only rings the shield; skeletons rattle', () => {
    expect(battleCues(hit(3, 1, { amount: 0, absorbed: 8 }), ctxOf(b)).map((c) => c.sound)).toEqual(['hitShield']);
    expect(battleCues(hit(1, 3), ctxOf(b, 'barrowlands')).map((c) => c.sound)).toContain('hitBone');
  });

  it('deaths are always heard', () => {
    expect(battleCues({ type: 'death', unitId: 4 }, ctxOf(b)).every((c) => c.priority === 'always')).toBe(true);
  });
});

describe('battle sound mix', () => {
  it('caps crowd cues per tick and keeps the hero', () => {
    const b = battleWith([hero(0, 0), unit('player', 'krieger', 2), unit('player', 'krieger', 4), unit('enemy', 'krieger', 0, 5), unit('enemy', 'krieger', 2, 5), unit('enemy', 'krieger', 4, 5)]);
    const events: BattleEvent[] = [
      { type: 'hit', attackerId: 2, targetId: 5, amount: 5, absorbed: 0, heavy: false, x: 0, z: 0 },
      { type: 'hit', attackerId: 3, targetId: 6, amount: 5, absorbed: 0, heavy: false, x: 0, z: 0 },
      { type: 'swing', unitId: 5, chain: 0 },
      { type: 'swing', unitId: 6, chain: 0 },
      { type: 'hit', attackerId: 1, targetId: 4, amount: 5, absorbed: 0, heavy: false, x: 0, z: 0 },
    ];
    const cues = new BattleSound('greenmarch').pick(b, events);
    expect(cues[0]).toMatchObject({ sound: 'hitBlade', priority: 'hero' });
    expect(cues.filter((c) => c.priority === 'crowd').length).toBeLessThanOrEqual(2);
  });

  it('every sound a whole battle cues exists, for each hero class and region', () => {
    for (const [cls, region] of [['krieger', 'greenmarch'], ['bogenschuetze', 'darkwood'], ['heiler', 'barrowlands'], ['magier', 'greenmarch']] as const) {
      const b = battleWith([hero(0, 0, cls), unit('player', 'heiler', 2), unit('player', 'magier', -2), unit('player', 'bogenschuetze', 0, -2), unit('enemy', 'schildtraeger', 0, 6), unit('enemy', 'berserker', 2, 6), unit('enemy', 'schamane', -2, 8), unit('enemy', 'magier', 0, 9)]);
      b.countdown = 3;
      const bot = createBot();
      const sound = new BattleSound(region);
      const used = new Set<string>();
      for (let i = 0; i < 60 / DT && b.outcome === 'running'; i++) {
        for (const c of sound.pick(b, step(b, botInput(b, bot), DT))) used.add(c.sound);
      }
      for (const s of used) expect(SOUNDS.has(s), s).toBe(true);
      expect(used.size).toBeGreaterThan(5);
    }
  });
});
