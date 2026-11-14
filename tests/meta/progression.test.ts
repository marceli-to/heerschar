import { describe, expect, it } from 'vitest';
import { CLASS_STATS } from '../../src/data/classes';
import { ENCOUNTERS, encounterById, playerSlotStats } from '../../src/data/encounters';
import { ITEMS, itemById } from '../../src/data/items';
import { LEVEL_CAP, PATH_LEVEL, statsAtLevel, xpToNext } from '../../src/data/progression';
import { PATHS, UPGRADES, pathsOf, upgradeById } from '../../src/data/upgrades';
import { characterOf, choose, currentChoice, equip, fittingItems, isUnlocked, newGame, recordBattle, rollLoot, takeLoot, unequip, type GameState } from '../../src/meta/game';
import { addXp, availableUpgrades, characterMods, characterStats, rollUpgradeOptions, statsWithItem, takePath, takeUpgrade } from '../../src/meta/progression';
import { battleSetupFor, HERO_ID, setFielded } from '../../src/meta/squad';
import { createBattle } from '../../src/sim/battle';
import { NEUTRAL_MODS, type PlayableClassId } from '../../src/sim/types';

const CLASSES: PlayableClassId[] = ['krieger', 'bogenschuetze', 'heiler', 'magier'];

function game(seed = 7): GameState {
  return newGame('krieger', 'Hero', seed);
}

/** Settles every pending choice with its first option and takes the first item. */
function settle(s: GameState): void {
  for (let c = currentChoice(s); c; c = currentChoice(s)) choose(s, c.options![0]!);
  if (s.rewards?.loot) takeLoot(s, s.rewards.loot[0]!);
}

describe('levels and stats', () => {
  it('level 1 stats are the Stage 3 stats; growth raises them', () => {
    for (const k of CLASSES) {
      const base = playerSlotStats(k, false);
      expect(statsAtLevel(base, k, 1)).toEqual(base);
      const l5 = statsAtLevel(base, k, 5);
      expect(l5.maxHp).toBeGreaterThan(base.maxHp);
      expect(l5.power).toBeGreaterThan(base.power);
    }
  });

  it('a fresh character has neutral mods and fights with its sheet stats', () => {
    const s = game();
    const hero = characterOf(s, HERO_ID);
    expect(characterMods(hero)).toEqual(NEUTRAL_MODS);
    hero.level = 4;
    takeUpgrade(hero, 'stout');
    hero.trinket = 'luckyCoin';
    const battle = createBattle(battleSetupFor(s.squad, encounterById('skirmish'), 1));
    const unit = battle.units.find((u) => u.isHero)!;
    expect(unit.stats).toEqual(characterStats(hero));
    expect(unit.mods.crit).toBeCloseTo(0.05, 5);
    expect(characterStats(hero).maxHp).toBeCloseTo(statsAtLevel(playerSlotStats('krieger', true), 'krieger', 4).maxHp * 1.12, 5);
  });

  it('enemies grow with the encounter level', () => {
    const e = encounterById('warband');
    const battle = createBattle(battleSetupFor(game().squad, e, 1));
    const shield = battle.units.find((u) => u.classId === 'schildtraeger')!;
    expect(shield.stats.maxHp).toBeGreaterThan(CLASS_STATS.schildtraeger.maxHp * 1.5 * e.strength);
  });

  it('xp levels up across several levels and stops at the cap', () => {
    const c = characterOf(game(), HERO_ID);
    expect(addXp(c, xpToNext(1) + xpToNext(2) + 5)).toEqual([2, 3]);
    expect(c.xp).toBe(5);
    expect(addXp(c, 1e9)).toHaveLength(LEVEL_CAP - 3);
    expect(c.level).toBe(LEVEL_CAP);
    expect(c.xp).toBe(0);
  });
});

describe('upgrades and paths', () => {
  it('every class has two paths, a base pool and a pool per path', () => {
    for (const k of CLASSES) {
      const [a, b] = pathsOf(k);
      expect(a.id).not.toBe(b.id);
      expect(UPGRADES.filter((u) => u.classId === k && u.path === null).length).toBeGreaterThanOrEqual(5);
      for (const p of [a, b]) expect(UPGRADES.filter((u) => u.path === p.id).length).toBeGreaterThanOrEqual(3);
    }
    expect(PATHS).toHaveLength(8);
  });

  it('offers three distinct options, only from own pools, never past the max', () => {
    const s = game();
    const c = characterOf(s, HERO_ID);
    for (let i = 0; i < LEVEL_CAP - 2; i++) {
      const opts = rollUpgradeOptions(s, c);
      expect(new Set(opts).size).toBe(opts.length);
      expect(opts.length).toBeGreaterThanOrEqual(i < 12 ? 3 : 2);
      for (const id of opts) {
        const u = upgradeById(id);
        expect(u.classId === null || u.classId === 'krieger').toBe(true);
        expect(u.path === null || u.path === c.path).toBe(true);
      }
      takeUpgrade(c, opts[0]!);
      if (i === 3) takePath(c, 'waechter');
    }
    for (const u of UPGRADES) expect(c.upgrades.filter((x) => x === u.id).length).toBeLessThanOrEqual(u.max);
    expect(c.upgrades.some((id) => upgradeById(id).path === 'waechter')).toBe(true);
  });

  it('pools last a whole career (filler only as a last resort)', () => {
    for (const k of CLASSES) for (const p of pathsOf(k)) {
      const c = { ...characterOf(newGame(k, 'X', 1), HERO_ID), path: p.id };
      const stacks = availableUpgrades(c).reduce((n, u) => n + u.max, 0);
      expect(stacks).toBeGreaterThanOrEqual(LEVEL_CAP - 2 - 2);
    }
  });

  it('a path cannot be taken twice or across classes', () => {
    const c = characterOf(game(), HERO_ID);
    expect(() => takePath(c, 'eis')).toThrow();
    takePath(c, 'berserker');
    expect(() => takePath(c, 'waechter')).toThrow();
    expect(() => takeUpgrade(c, 'bulwark')).toThrow();
  });
});

describe('rewards', () => {
  it('a first win shares xp: fielded equally, benched half', () => {
    const s = game();
    const r = recordBattle(s, 'skirmish', true)!;
    const e = encounterById('skirmish');
    const share = Math.floor(e.xp / s.squad.fielded.length);
    for (const g of r.xp) expect(g.amount).toBe(s.squad.fielded.includes(g.characterId) ? share : Math.floor((e.xp / s.squad.fielded.length) * 0.5));
    expect(s.won).toEqual(['skirmish']);
    expect(r.loot).toHaveLength(3);
  });

  it('fewer fielded means bigger shares', () => {
    const s = game();
    setFielded(s.squad, s.squad.fielded[1]!, false);
    const r = recordBattle(s, 'skirmish', true)!;
    expect(r.xp.find((g) => g.characterId === HERO_ID)!.amount).toBe(Math.floor(encounterById('skirmish').xp / 5));
  });

  it('replays and losses pay nothing', () => {
    const s = game();
    expect(recordBattle(s, 'skirmish', false)).toBeNull();
    recordBattle(s, 'skirmish', true);
    settle(s);
    const before = JSON.stringify(s.squad);
    expect(recordBattle(s, 'skirmish', true)).toBeNull();
    expect(JSON.stringify(s.squad)).toBe(before);
    expect(s.rewards).toBeNull();
    expect(s.battles).toBe(3);
    expect(s.lost).toBe(1);
  });

  it('level-ups queue choices; level 5 asks for a path; options stay put once drawn', () => {
    const s = game();
    const hero = characterOf(s, HERO_ID);
    hero.level = 3;
    hero.xp = xpToNext(3) + xpToNext(4) - 50;
    s.rewards = null;
    recordBattle(s, 'skirmish', true);
    const choices = s.rewards!.choices.filter((c) => c.characterId === HERO_ID);
    expect(choices.map((c) => c.level)).toEqual([4, PATH_LEVEL]);
    expect(choices[1]!.kind).toBe('path');
    const first = currentChoice(s)!;
    const opts = [...first.options!];
    const copy = JSON.parse(JSON.stringify(s)) as GameState;
    expect(currentChoice(copy)!.options).toEqual(opts);
    settle(s);
    expect(hero.path).toBe('waechter');
    expect(hero.upgrades).toHaveLength(1);
    expect(s.rewards).toBeNull();
    expect(s.inventory).toHaveLength(1);
  });

  it('battles unlock in order', () => {
    const s = game();
    expect(isUnlocked(s, ENCOUNTERS[0]!.id)).toBe(true);
    expect(isUnlocked(s, ENCOUNTERS[1]!.id)).toBe(false);
    recordBattle(s, ENCOUNTERS[0]!.id, true);
    expect(isUnlocked(s, ENCOUNTERS[1]!.id)).toBe(true);
    expect(isUnlocked(s, ENCOUNTERS[2]!.id)).toBe(false);
  });
});

describe('loot and equipment', () => {
  it('three distinct items, only for classes in the roster, deterministic', () => {
    const s = game();
    const archerOnly = [{ ...characterOf(s, HERO_ID), classId: 'bogenschuetze' as const }];
    for (let i = 0; i < 50; i++) {
      const a = rollLoot({ rngState: i }, 'normal', archerOnly);
      expect(a).toEqual(rollLoot({ rngState: i }, 'normal', archerOnly));
      expect(new Set(a).size).toBe(3);
      for (const id of a) expect([null, 'bogenschuetze']).toContain(itemById(id).classId);
    }
  });

  it('elite loot is richer than normal', () => {
    const roster = game().squad.roster;
    const rareShare = (tier: 'normal' | 'elite') => {
      let good = 0;
      for (let i = 0; i < 200; i++) good += rollLoot({ rngState: i }, tier, roster).filter((id) => itemById(id).rarity !== 'common').length;
      return good / 600;
    };
    expect(rareShare('elite')).toBeGreaterThan(rareShare('normal') + 0.3);
  });

  it('equip swaps with the inventory and respects classes', () => {
    const s = game();
    s.inventory.push('ironSword', 'knightsBlade', 'huntingBow');
    expect(equip(s, HERO_ID, 'huntingBow')).toBe(false);
    expect(equip(s, HERO_ID, 'ironSword')).toBe(true);
    expect(equip(s, HERO_ID, 'knightsBlade')).toBe(true);
    expect(characterOf(s, HERO_ID).weapon).toBe('knightsBlade');
    expect(s.inventory.sort()).toEqual(['huntingBow', 'ironSword']);
    expect(unequip(s, HERO_ID, 'weapon')).toBe(true);
    expect(s.inventory).toHaveLength(3);
    expect(equip(s, HERO_ID, 'garnetRing')).toBe(false);
  });

  it('fitting items: only the slot and class, grouped, best rarity first', () => {
    const s = game();
    s.inventory.push('ironSword', 'huntingBow', 'copperRing', 'oathkeeper', 'ironSword', 'knightsBlade');
    expect(fittingItems(s, HERO_ID, 'weapon')).toEqual([
      { id: 'oathkeeper', count: 1 },
      { id: 'knightsBlade', count: 1 },
      { id: 'ironSword', count: 2 },
    ]);
    expect(fittingItems(s, HERO_ID, 'trinket')).toEqual([{ id: 'copperRing', count: 1 }]);
  });

  it('the stat preview matches what equipping gives', () => {
    const s = game();
    s.inventory.push('knightsBlade', 'garnetRing');
    const c = characterOf(s, HERO_ID);
    const preview = statsWithItem(c, 'weapon', 'knightsBlade');
    expect(c.weapon).toBeNull();
    equip(s, HERO_ID, 'knightsBlade');
    expect(characterStats(c)).toEqual(preview);
    expect(statsWithItem(c, 'weapon', null)).toEqual(characterStats({ ...c, weapon: null }));
    expect(statsWithItem(c, 'weapon', null).power).toBeLessThan(preview.power);
  });

  it('every item has a valid slot and class', () => {
    for (const i of ITEMS) expect(i.slot === 'weapon' ? i.classId !== null : i.classId === null).toBe(true);
  });
});

describe('strings', () => {
  it('every upgrade, path and item has a name', async () => {
    const { STRINGS } = await import('../../src/data/strings');
    for (const u of UPGRADES) expect(STRINGS.upgrades[u.id], u.id).toBeTruthy();
    for (const p of PATHS) expect(STRINGS.paths[p.id].name).toBeTruthy();
    for (const i of ITEMS) expect(STRINGS.items[i.id], i.id).toBeTruthy();
  });
});
