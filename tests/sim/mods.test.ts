import { describe, expect, it } from 'vitest';
import { ACTIONS, CRIT_MULTIPLIER, GUARD_SHIELD_TIME, HERO_ABILITIES } from '../../src/sim/balance';
import { applyDamage, applyHeal, computeDamage } from '../../src/sim/combat';
import { fireStraight, placeArea } from '../../src/sim/projectiles';
import { getStatus, hasStatus } from '../../src/sim/statuses';
import type { BattleEvent, UnitMods } from '../../src/sim/types';
import { battleWith, hero, hold, run, seconds, unit } from './helpers';
import type { UnitSetup } from '../../src/sim/battle';

const withMods = (u: UnitSetup, mods: Partial<UnitMods>): UnitSetup => ({ ...u, mods });

describe('unit mods', () => {
  it('neutral by default', () => {
    const b = battleWith([hero(), unit('enemy', 'krieger', 5)]);
    expect(b.units[0]!.mods).toEqual({ damage: 1, damageTaken: 1, healing: 1, cooldown: 1, lifesteal: 0, control: 0, slowOnHit: 0, area: 1, guardShield: 0, crit: 0, selfRally: 0 });
  });

  it('damage and damage taken scale hits', () => {
    const plain = battleWith([hero(), unit('enemy', 'krieger', 5)]);
    const modded = battleWith([withMods(hero(), { damage: 1.5 }), withMods(unit('enemy', 'krieger', 5), { damageTaken: 0.5 })]);
    const a = computeDamage(plain, 20, 1, plain.units[1]!, 'physical', plain.units[0]);
    const b = computeDamage(modded, 20, 1, modded.units[1]!, 'physical', modded.units[0]);
    expect(b / a).toBeCloseTo(0.75, 5);
  });

  it('crit always lands at chance 1', () => {
    const plain = battleWith([hero(), unit('enemy', 'krieger', 5)]);
    const crit = battleWith([withMods(hero(), { crit: 1 }), unit('enemy', 'krieger', 5)]);
    const a = computeDamage(plain, 20, 1, plain.units[1]!, 'physical', plain.units[0]);
    const b = computeDamage(crit, 20, 1, crit.units[1]!, 'physical', crit.units[0]);
    expect(b / a).toBeCloseTo(CRIT_MULTIPLIER, 5);
  });

  it('lifesteal heals the dealer, healing scales heals', () => {
    const b = battleWith([withMods(hero(), { lifesteal: 0.5, healing: 2 }), unit('enemy', 'krieger', 5)]);
    const [h, e] = b.units as [typeof b.units[0], typeof b.units[0]];
    h.hp = 50;
    const events: BattleEvent[] = [];
    applyDamage(h, e, 20, false, events);
    expect(h.hp).toBe(60);
    applyHeal(h, h, 10, events);
    expect(h.hp).toBe(80);
  });

  it('cooldown shortens companion abilities', () => {
    const b = battleWith([hero(-20), withMods(unit('player', 'krieger', 0), { cooldown: 0.5 }), unit('enemy', 'krieger', 2, 1), unit('enemy', 'krieger', 2, -1)]);
    run(b, seconds(1));
    expect(b.units[1]!.abilityCooldowns.taunt).toBeGreaterThan(ACTIONS.taunt.cooldown * 0.5 - 1.1);
    expect(b.units[1]!.abilityCooldowns.taunt).toBeLessThanOrEqual(ACTIONS.taunt.cooldown * 0.5);
  });

  it('control lengthens taunts; guard shield and self rally fire on taunt', () => {
    const b = battleWith([hero(-20), withMods(unit('player', 'krieger', 0), { control: 2, guardShield: 1, selfRally: 3 }), unit('enemy', 'krieger', 2, 1), unit('enemy', 'krieger', 2, -1)]);
    run(b, seconds(ACTIONS.taunt.windup + 0.1));
    const taunt = getStatus(b.units[2]!, 'taunted');
    expect(taunt!.time).toBeGreaterThan(ACTIONS.taunt.duration + 1.5);
    const k = b.units[1]!;
    expect(getStatus(k, 'shielded')!.amount).toBeCloseTo(k.stats.power, 5);
    expect(getStatus(k, 'shielded')!.time).toBeLessThanOrEqual(GUARD_SHIELD_TIME);
    expect(hasStatus(k, 'rallied')).toBe(true);
  });

  it('hero cooldown mod shortens hero abilities', () => {
    const b = battleWith([withMods(hero(), { cooldown: 0.5 }), unit('enemy', 'krieger', 1.5)]);
    hold(b, 2);
    b.units[0]!.energy = 100;
    run(b, seconds(HERO_ABILITIES.schildstoss.windup + 0.05), { ability1: true });
    expect(b.units[0]!.abilityCooldowns.schildstoss).toBeCloseTo(HERO_ABILITIES.schildstoss.cooldown * 0.5, 1);
  });

  it('area scales circles, control lengthens freezes', () => {
    const b = battleWith([withMods(hero(), { area: 1.5, control: 1 }), unit('enemy', 'krieger', 5)]);
    const a = placeArea(b, b.units[0]!, { kind: 'frostring', at: { x: 0, z: 0 }, radius: 4, delay: 0, multiplier: 0, damageType: 'magic', freeze: 2 }, []);
    expect(a.radius).toBeCloseTo(6, 5);
    expect(a.freeze).toBeCloseTo(3, 5);
  });

  it('slow on hit: arrows slow the target', () => {
    const b = battleWith([hero(-20, 10), withMods(unit('player', 'bogenschuetze', 0), { slowOnHit: 2 }), unit('enemy', 'krieger', 4)]);
    hold(b, 2, 3);
    fireStraight(b, b.units[1]!, { kind: 'arrow', at: { x: 4, z: 0 }, speed: 30, radius: 0.3, range: 20, multiplier: 0.1, damageType: 'physical', pierce: false }, []);
    run(b, seconds(0.3));
    expect(hasStatus(b.units[2]!, 'slowed')).toBe(true);
  });
});
