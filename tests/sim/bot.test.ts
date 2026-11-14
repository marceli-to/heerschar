import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { DT } from '../../src/sim/balance';
import { botInput, createBot } from '../../src/sim/bot';
import { trialSetup } from '../../src/data/encounters';

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

describe('stage 1 trial with the bot hero', () => {
  it('is winnable when the hero dodges', () => {
    expect(winRate(true)).toBeGreaterThanOrEqual(0.8);
  });

  it('is lost when the hero never dodges', () => {
    expect(winRate(false)).toBeLessThanOrEqual(0.2);
  });
});
