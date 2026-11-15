import { describe, expect, it } from 'vitest';
import { FINALE, finaleCloseIn, finaleTimeScale, orbitProgress } from '../../src/game/cinematics';
import { COUNTDOWN, DT } from '../../src/sim/balance';

describe('final-blow slow motion', () => {
  it('drops to the slow speed, holds, and is back to normal when the end screen shows', () => {
    expect(finaleTimeScale(0)).toBe(1);
    expect(finaleTimeScale(FINALE.easeIn)).toBe(FINALE.scale);
    expect(finaleTimeScale(FINALE.duration / 2)).toBe(FINALE.scale);
    expect(finaleTimeScale(FINALE.duration - 0.01)).toBeGreaterThan(0.95);
    expect(finaleTimeScale(FINALE.duration)).toBe(1);
    for (let t = 0; t < FINALE.duration; t += 0.01) {
      expect(finaleTimeScale(t)).toBeGreaterThanOrEqual(FINALE.scale);
      expect(finaleTimeScale(t)).toBeLessThanOrEqual(1);
    }
  });

  it('closes in on the victim and stays there', () => {
    expect(finaleCloseIn(0)).toBe(0);
    expect(finaleCloseIn(FINALE.closeIn)).toBe(1);
    expect(finaleCloseIn(10)).toBe(1);
  });
});

describe('countdown orbit', () => {
  it('runs 0 → 1 over the countdown', () => {
    expect(orbitProgress(COUNTDOWN, 0)).toBe(0);
    expect(orbitProgress(COUNTDOWN / 2, 0)).toBeCloseTo(0.5);
    expect(orbitProgress(DT, 1)).toBe(1);
    expect(orbitProgress(0, 0.5)).toBe(1);
  });
});
