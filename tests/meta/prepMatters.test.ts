import { describe, expect, it } from 'vitest';
import { encounterById, type EncounterId } from '../../src/data/encounters';
import { SANDBOX_COMPANIONS, newSquad } from '../../src/data/roster';
import { battleSetupFor, HERO_ID, placeCharacter, setFielded, type SquadState } from '../../src/meta/squad';
import { playHeadless } from '../../src/sim/headless';

/** Stage 3 "done when": composition and formation visibly change how a given battle goes. */
const RUNS = 20;

/** The battles at the levels they had in Stage 3 (the campaign places them later), for a level 1 squad. */
const STAGE3_LEVEL: Partial<Record<EncounterId, number>> = { skirmish: 1, shieldWall: 2 };

function play(encounter: EncounterId, change: (s: SquadState) => void): { winRate: number; seconds: number } {
  let wins = 0;
  let seconds = 0;
  for (let seed = 1; seed <= RUNS; seed++) {
    const s = newSquad('krieger', 'Hero', SANDBOX_COMPANIONS);
    change(s);
    const r = playHeadless(battleSetupFor(s, { ...encounterById(encounter), level: STAGE3_LEVEL[encounter] ?? 1 }, seed));
    if (r.outcome === 'won') wins++;
    seconds += r.seconds;
  }
  return { winRate: wins / RUNS, seconds: seconds / RUNS };
}

const id = (s: SquadState, name: string) => s.roster.find((c) => c.name === name)!.id;
function swap(s: SquadState, out: string, inn: string): void {
  setFielded(s, id(s, out), false);
  setFielded(s, id(s, inn), true);
}

describe('preparation changes the battle', () => {
  it('skirmish: leaving the healer at home loses far more often', () => {
    const base = play('skirmish', () => {});
    const noHealer = play('skirmish', (s) => swap(s, 'Maren', 'Ansel'));
    expect(base.winRate - noHealer.winRate).toBeGreaterThanOrEqual(0.3);
  }, 120_000);

  it('skirmish: putting the hero in the back row costs battles', () => {
    const base = play('skirmish', () => {});
    const heroBack = play('skirmish', (s) => placeCharacter(s, HERO_ID, { col: 1, row: 1 }));
    expect(base.winRate - heroBack.winRate).toBeGreaterThanOrEqual(0.2);
  }, 120_000);

  it('shield wall: magic breaks it much faster than arrows', () => {
    const noMage = play('shieldWall', (s) => swap(s, 'Osric', 'Wulf'));
    const twoMages = play('shieldWall', (s) => swap(s, 'Hilde', 'Ansel'));
    expect(twoMages.seconds).toBeLessThan(noMage.seconds * 0.8);
  }, 120_000);
});
