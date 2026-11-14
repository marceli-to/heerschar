import { describe, expect, it } from 'vitest';
import { ITEMS } from '../../src/data/items';
import { LEVEL_CAP, xpToNext } from '../../src/data/progression';
import { PATHS, UPGRADES } from '../../src/data/upgrades';
import { effectLines, formatPlayTime, upgradeTally, xpAt } from '../../src/meta/describe';
import type { XpGain } from '../../src/meta/game';

describe('effect lines', () => {
  it('formats percentages, flat amounts and skips zeros', () => {
    expect(effectLines({ hp: 0.12, armor: 12, resist: 0 })).toEqual(['+12% health', '+12 armour']);
    expect(effectLines({ toughness: 0.08, guardShield: 1.5 })).toEqual(['−8% damage taken', 'Taunt and Shield Bash shield self (1.5× power)']);
    expect(effectLines({ crit: 0.05 })).toEqual(['+5% critical chance']);
  });

  it('every upgrade, path and item has at least one line without placeholders', () => {
    for (const e of [...UPGRADES.map((u) => u.effect), ...PATHS.map((p) => p.signature), ...ITEMS.map((i) => i.effect)]) {
      const lines = effectLines(e);
      expect(lines.length).toBeGreaterThan(0);
      for (const l of lines) expect(l).not.toMatch(/\{v\}|NaN|undefined/);
    }
  });
});

describe('xp replay', () => {
  const gain = (fromLevel: number, fromXp: number, amount: number, toLevel: number, toXp: number): XpGain => ({ characterId: 1, amount, fromLevel, fromXp, toLevel, toXp });

  it('starts where the gain started and ends where it ended', () => {
    const g = gain(1, 40, 200, 2, 40);
    expect(xpAt(g, 0)).toEqual({ level: 1, xp: 40, needed: xpToNext(1) });
    expect(xpAt(g, 1)).toEqual({ level: 2, xp: 40, needed: xpToNext(2) });
  });

  it('wraps at each level reached', () => {
    const g = gain(1, 0, xpToNext(1) + xpToNext(2) + 10, 3, 10);
    expect(xpAt(g, 0.5).level).toBe(2);
    const levels = Array.from({ length: 101 }, (_, i) => xpAt(g, i / 100).level);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]!);
    expect(new Set(levels)).toEqual(new Set([1, 2, 3]));
  });

  it('stays empty at the cap', () => {
    const g = gain(LEVEL_CAP - 1, 0, 10_000, LEVEL_CAP, 0);
    expect(xpAt(g, 0.9)).toMatchObject({ level: LEVEL_CAP, xp: 0 });
  });
});

describe('upgrade tally', () => {
  it('groups repeats in the order first taken', () => {
    expect(upgradeTally(['stout', 'ironSkin', 'stout', 'bellow', 'stout'])).toEqual([
      { id: 'stout', count: 3 },
      { id: 'ironSkin', count: 1 },
      { id: 'bellow', count: 1 },
    ]);
    expect(upgradeTally([])).toEqual([]);
  });
});

describe('play time', () => {
  it('minutes, then hours with padded minutes', () => {
    expect(formatPlayTime(0)).toBe('0 min');
    expect(formatPlayTime(42 * 60000 + 20000)).toBe('42 min');
    expect(formatPlayTime(60 * 60000)).toBe('1 h 00 min');
    expect(formatPlayTime((2 * 60 + 5) * 60000)).toBe('2 h 05 min');
  });
});
