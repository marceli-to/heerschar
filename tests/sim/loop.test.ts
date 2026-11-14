import { describe, expect, it } from 'vitest';
import { advanceLoop, MAX_FRAME_TIME, type LoopState } from '../../src/game/loop';
import { DT } from '../../src/sim/balance';

describe('fixed-timestep loop', () => {
  it('runs one tick per 1/60 s frame', () => {
    const s: LoopState = { accumulator: 0 };
    let ticks = 0;
    for (let i = 0; i < 600; i++) ticks += advanceLoop(s, DT, DT).steps;
    expect(ticks).toBe(600);
  });

  it('accumulates short frames and interpolates between ticks', () => {
    const s: LoopState = { accumulator: 0 };
    const a = advanceLoop(s, DT / 2, DT);
    expect(a.steps).toBe(0);
    expect(a.alpha).toBeCloseTo(0.5);
    expect(advanceLoop(s, DT / 2, DT).steps).toBe(1);
  });

  it('runs the same number of ticks at 144 Hz as at 60 Hz', () => {
    const s: LoopState = { accumulator: 0 };
    let ticks = 0;
    for (let i = 0; i < 144 * 10; i++) ticks += advanceLoop(s, 1 / 144, DT).steps;
    expect(Math.abs(ticks - 600)).toBeLessThanOrEqual(1);
  });

  it('clamps a long frame (backgrounded tab) instead of spiralling', () => {
    const s: LoopState = { accumulator: 0 };
    const a = advanceLoop(s, 30, DT);
    expect(a.steps).toBe(Math.round(MAX_FRAME_TIME / DT));
    expect(a.alpha).toBeGreaterThanOrEqual(0);
    expect(a.alpha).toBeLessThan(1);
  });

  it('ignores negative frame times', () => {
    const s: LoopState = { accumulator: 0 };
    expect(advanceLoop(s, -1, DT).steps).toBe(0);
  });
});
