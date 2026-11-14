import { describe, expect, it } from 'vitest';
import { createBattle, step } from '../../src/sim/battle';
import { DT } from '../../src/sim/balance';
import { emptyInput } from '../../src/sim/types';

describe('battle', () => {
  it('advances one tick per step', () => {
    const b = createBattle({ seed: 1 });
    for (let i = 0; i < 10; i++) step(b, emptyInput(), DT);
    expect(b.tick).toBe(10);
  });

  it('is deterministic for the same seed and inputs', () => {
    const run = (): string => {
      const b = createBattle({ seed: 123 });
      for (let i = 0; i < 300; i++) step(b, emptyInput(), DT);
      return JSON.stringify(b);
    };
    expect(run()).toBe(run());
  });
});
