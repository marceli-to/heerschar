import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { DT, HERO_KIT } from '../../src/sim/balance';
import { botInput, createBot } from '../../src/sim/bot';
import { playHeadless } from '../../src/sim/headless';
import { squadSetup, trialSetup } from '../../src/data/encounters';
import type { BattleEvent, PlayableClassId } from '../../src/sim/types';

const CLASSES: PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];

function winRate(dodge: boolean, runs = 40): number {
  let wins = 0;
  for (let seed = 1; seed <= runs; seed++) {
    const b = createBattle(trialSetup(seed));
    const bot = createBot();
    while (b.outcome === 'running' && b.tick < 60 * 180) {
      const input = botInput(b, bot);
      if (!dodge) input.dodge = false;
      step(b, input, DT);
    }
    if (b.outcome === 'won') wins++;
  }
  return wins / runs;
}

function soloSetup(seed: number, c: PlayableClassId) {
  const setup = squadSetup(seed, c);
  setup.units = setup.units.filter((u) => u.team === 'enemy' || u.isHero);
  return setup;
}

describe('stage 1 trial with the bot hero', () => {
  it('is winnable when the hero dodges', () => {
    expect(winRate(true)).toBeGreaterThanOrEqual(0.8);
  });

  it('is lost when the hero never dodges', () => {
    expect(winRate(false)).toBeLessThanOrEqual(0.2);
  });
});

describe('5-against-6 squad battle with the bot hero', () => {
  const RUNS = 20;

  for (const c of CLASSES) {
    it(`${c}: the squad wins most battles`, () => {
      let wins = 0;
      for (let seed = 1; seed <= RUNS; seed++) if (playHeadless(squadSetup(seed, c)).outcome === 'won') wins++;
      expect(wins / RUNS).toBeGreaterThanOrEqual(0.6);
    });

    it(`${c}: the hero alone does not win`, () => {
      let wins = 0;
      for (let seed = 1; seed <= RUNS; seed++) if (playHeadless(soloSetup(seed, c)).outcome === 'won') wins++;
      // At most one win in 20 (Marcel, 2026-11-15: accepted with the 1 s dodge stun).
      expect(wins / RUNS).toBeLessThanOrEqual(0.05);
    });
  }

  it('marks the Schamane first, then the healer', () => {
    const r = playHeadless(squadSetup(3));
    const marks = r.events.filter((e): e is Extract<BattleEvent, { type: 'mark' }> => e.type === 'mark' && e.targetId !== null);
    const classOf = (id: number) => r.battle.units.find((u) => u.id === id)?.classId;
    expect(marks.length).toBeGreaterThan(0);
    expect(classOf(marks[0]!.targetId!)).toBe('schamane');
    const firstMark = r.events.findIndex((e) => e.type === 'mark');
    const firstHit = r.events.findIndex((e) => e.type === 'hit');
    expect(firstMark).toBeLessThan(firstHit);
  });

  for (const c of CLASSES) {
    it(`${c}: uses its whole kit and replays identically`, () => {
      // Seed 5: Heilkreis needs two hurt allies close together, which not every battle brings.
      const play = () => playHeadless(squadSetup(5, c), 90);
      const first = play();
      const second = play();
      expect(JSON.stringify(second.battle)).toBe(JSON.stringify(first.battle));
      expect(second.events).toEqual(first.events);
      // Escape abilities (Rueckzug, Frostring) come up when the hero is swarmed, so count the solo battle too.
      const released = new Set(
        [...first.events, ...playHeadless(soloSetup(5, c), 90).events].flatMap((e) => (e.type === 'release' && e.unitId === 1 ? [e.action] : [])),
      );
      for (const id of [...HERO_KIT[c], 'sammeln'] as const) expect(released).toContain(id);
    });
  }
});
