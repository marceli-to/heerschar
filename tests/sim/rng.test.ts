import { describe, expect, it } from 'vitest';
import { int, nextFloat, pick, range, seedState, type RngHolder } from '../../src/sim/rng';

const holder = (seed: number): RngHolder => ({ rngState: seedState(seed) });

describe('rng', () => {
  it('repeats the same sequence for the same seed', () => {
    const a = holder(42);
    const b = holder(42);
    for (let i = 0; i < 100; i++) expect(nextFloat(a)).toBe(nextFloat(b));
  });

  it('differs for different seeds', () => {
    expect(nextFloat(holder(1))).not.toBe(nextFloat(holder(2)));
  });

  it('stays within bounds', () => {
    const h = holder(7);
    for (let i = 0; i < 1000; i++) {
      const f = nextFloat(h);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const r = range(h, -2, 3);
      expect(r).toBeGreaterThanOrEqual(-2);
      expect(r).toBeLessThan(3);
      const n = int(h, 5);
      expect(Number.isInteger(n) && n >= 0 && n < 5).toBe(true);
    }
  });

  it('can resume from a stored state', () => {
    const a = holder(9);
    nextFloat(a);
    const copy: RngHolder = { rngState: a.rngState };
    expect(nextFloat(copy)).toBe(nextFloat(a));
  });

  it('picks from a list and rejects an empty one', () => {
    const h = holder(3);
    expect(['a', 'b', 'c']).toContain(pick(h, ['a', 'b', 'c']));
    expect(() => pick(h, [])).toThrow();
  });
});
