import { describe, expect, it } from 'vitest';
import { createBattle, slotPosition, step } from '../../src/sim/battle';
import { ACTIONS, DT, FORMATION, STATUS } from '../../src/sim/balance';
import { computeDamage } from '../../src/sim/combat';
import { fireStraight, placeArea } from '../../src/sim/projectiles';
import { botInput, createBot } from '../../src/sim/bot';
import { addStatus } from '../../src/sim/statuses';
import { squadSetup } from '../../src/data/encounters';
import type { BattleEvent } from '../../src/sim/types';
import { battleWith, hero, hold, run, seconds, unit } from './helpers';

/** Hero parked out of the way so it does not take part. */
const parked = () => hero(-20, 0);

const hits = (events: BattleEvent[], targetId: number) => events.filter((e) => e.type === 'hit' && e.targetId === targetId);

describe('formation', () => {
  it('places 3 × 2 slots per side with the front rows about 24 m apart', () => {
    expect(slotPosition('player', 1, 0).x - slotPosition('enemy', 1, 0).x).toBeCloseTo(-2 * FORMATION.frontX);
    expect(2 * FORMATION.frontX).toBeGreaterThanOrEqual(22);
    expect(2 * FORMATION.frontX).toBeLessThanOrEqual(26);
    const keys = new Set<string>();
    for (const team of ['player', 'enemy'] as const)
      for (let col = 0; col < 3; col++) for (let row = 0; row < 2; row++) keys.add(JSON.stringify(slotPosition(team, col, row)));
    expect(keys.size).toBe(12);
    // The back row stands behind the front row, as seen from each side.
    expect(slotPosition('player', 0, 1).x).toBeLessThan(slotPosition('player', 0, 0).x);
    expect(slotPosition('enemy', 0, 1).x).toBeGreaterThan(slotPosition('enemy', 0, 0).x);
  });

  it('the squad battle is five against six', () => {
    const b = createBattle(squadSetup(1));
    expect(b.units.filter((u) => u.team === 'player')).toHaveLength(5);
    expect(b.units.filter((u) => u.team === 'enemy')).toHaveLength(6);
    expect(b.units.filter((u) => u.isHero)).toHaveLength(1);
  });
});

describe('statuses', () => {
  it('frozen: cannot act and takes +50% physical damage', () => {
    const b = battleWith([parked(), unit('player', 'krieger', 0), unit('enemy', 'krieger', 1.5)]);
    hold(b, 3);
    const enemy = b.units[2]!;
    const events = run(b, seconds(2));
    expect(events.some((e) => e.type === 'attackStart' && e.unitId === 3)).toBe(false);
    expect(enemy.pos.x).toBeGreaterThan(1.4);

    const a = battleWith([parked(), unit('enemy', 'krieger', 5)]);
    const c = battleWith([parked(), unit('enemy', 'krieger', 5)]);
    hold(c, 2);
    const plain = computeDamage(a, 20, 1, a.units[1]!, 'physical');
    const frozen = computeDamage(c, 20, 1, c.units[1]!, 'physical');
    expect(frozen / plain).toBeCloseTo(STATUS.frozenPhysical, 5);
    expect(computeDamage(c, 20, 1, c.units[1]!, 'magic')).toBeLessThan(frozen);
  });

  it('marked: takes +15% damage, and the mark clears when the target dies', () => {
    const a = battleWith([parked(), unit('enemy', 'krieger', 5)]);
    const c = battleWith([parked(), unit('enemy', 'krieger', 5)]);
    c.markTargetId = 2;
    expect(computeDamage(c, 20, 1, c.units[1]!, 'magic') / computeDamage(a, 20, 1, a.units[1]!, 'magic')).toBeCloseTo(STATUS.marked, 5);
    c.units[1]!.state = 'dead';
    run(c, 1);
    expect(c.markTargetId).toBeNull();
  });

  it('rallied: moves 25% faster and the status runs out', () => {
    const plain = battleWith([parked(), unit('player', 'krieger', 0), unit('enemy', 'krieger', 15)]);
    const rallied = battleWith([parked(), unit('player', 'krieger', 0), unit('enemy', 'krieger', 15)]);
    hold(plain, 3);
    hold(rallied, 3);
    addStatus(rallied.units[1]!, 'rallied', 6, []);
    run(plain, seconds(1));
    run(rallied, seconds(1));
    expect(rallied.units[1]!.pos.x / plain.units[1]!.pos.x).toBeCloseTo(STATUS.rallied, 1);
    const events = run(rallied, seconds(5.5));
    expect(events.some((e) => e.type === 'status' && e.kind === 'rallied' && !e.on)).toBe(true);
  });

  it('shielded: absorbs damage before health', () => {
    const b = battleWith([parked(), unit('enemy', 'krieger', 5)]);
    const target = b.units[1]!;
    addStatus(target, 'shielded', 10, [], 1000);
    const shooter = b.units[0]!;
    shooter.pos = { x: 0, z: 0 };
    fireStraight(b, shooter, { kind: 'arrow', at: target.pos, speed: 30, radius: 0.3, range: 20, multiplier: 1, damageType: 'physical', pierce: false }, []);
    const events = run(b, seconds(0.5));
    const hit = hits(events, 2)[0];
    expect(hit?.type === 'hit' && hit.absorbed).toBeGreaterThan(0);
    expect(target.hp).toBe(target.stats.maxHp);
  });
});

describe('krieger', () => {
  it('intercepts a foe heading for the back row over a nearer one', () => {
    const b = battleWith([parked(), unit('player', 'krieger', 0), unit('player', 'bogenschuetze', -8), unit('enemy', 'krieger', 3), unit('enemy', 'krieger', 4, 6)]);
    b.units[4]!.targetId = 3;
    run(b, 1);
    expect(b.units[1]!.targetId).toBe(5);
  });

  it('taunts a crowd: nearby foes target him for 4 s', () => {
    const b = battleWith([parked(), unit('player', 'krieger', 0), unit('player', 'magier', 2, 3), unit('enemy', 'krieger', 3), unit('enemy', 'krieger', 3, 2)]);
    b.units[2]!.abilityCooldowns.frostNova = 99;
    const events = run(b, seconds(ACTIONS.taunt.windup) + 2);
    expect(events.some((e) => e.type === 'action' && e.unitId === 2 && e.action === 'taunt')).toBe(true);
    for (const id of [4, 5]) {
      const foe = b.units[id - 1]!;
      expect(foe.statuses.some((s) => s.kind === 'taunted' && s.sourceId === 2)).toBe(true);
      expect(foe.targetId).toBe(2);
    }
  });

  it('the hero cannot be taunted', () => {
    const b = battleWith([hero(1), unit('enemy', 'krieger', 0), unit('player', 'krieger', 2), unit('player', 'krieger', 2, 2)]);
    run(b, seconds(1));
    expect(b.units[0]!.statuses.some((s) => s.kind === 'taunted')).toBe(false);
  });
});

describe('bogenschuetze', () => {
  it('shoots the lowest-health foe in range', () => {
    const b = battleWith([parked(), unit('player', 'bogenschuetze', 0), unit('enemy', 'krieger', 10, -2), unit('enemy', 'krieger', 10, 2)]);
    hold(b, 3, 4);
    b.units[1]!.abilityCooldowns.pierce = 99;
    b.units[3]!.hp = 40;
    const events = run(b, seconds(1.5));
    expect(hits(events, 4).length).toBeGreaterThan(0);
    expect(hits(events, 3)).toHaveLength(0);
  });

  it('obeys the mark over the weakest foe', () => {
    const b = battleWith([parked(), unit('player', 'bogenschuetze', 0), unit('enemy', 'krieger', 10, -2), unit('enemy', 'krieger', 10, 2)]);
    hold(b, 3, 4);
    b.units[1]!.abilityCooldowns.pierce = 99;
    b.units[3]!.hp = 40;
    b.markTargetId = 3;
    const events = run(b, seconds(1.5));
    expect(hits(events, 3).length).toBeGreaterThan(0);
    expect(hits(events, 4)).toHaveLength(0);
  });

  it('backs away from a melee attacker while reloading', () => {
    const b = battleWith([parked(), unit('player', 'bogenschuetze', 0), unit('enemy', 'krieger', 2)]);
    b.units[1]!.attackCooldown = 1;
    b.units[2]!.attackCooldown = 5;
    run(b, seconds(0.5));
    expect(b.units[1]!.pos.x).toBeLessThan(-1);
  });

  it('piercing shot hits every foe in its line', () => {
    const b = battleWith([parked(), unit('player', 'bogenschuetze', 0), unit('enemy', 'krieger', 6), unit('enemy', 'krieger', 9)]);
    hold(b, 3, 4);
    const events = run(b, seconds(ACTIONS.pierce.windup + 0.6));
    expect(events.some((e) => e.type === 'shoot' && e.kind === 'piercing')).toBe(true);
    expect(hits(events, 3)).toHaveLength(1);
    expect(hits(events, 4)).toHaveLength(1);
  });
});

describe('heiler', () => {
  it('heals the ally with the lowest health fraction', () => {
    const b = battleWith([parked(), unit('player', 'heiler', 0), unit('player', 'krieger', 3), unit('player', 'magier', -3), unit('enemy', 'krieger', 30)]);
    hold(b, 3, 4, 5);
    b.units[1]!.abilityCooldowns.groupHeal = 99;
    b.units[2]!.hp = b.units[2]!.stats.maxHp * 0.6;
    b.units[3]!.hp = b.units[3]!.stats.maxHp * 0.4;
    const events = run(b, seconds(ACTIONS.heal.windup) + 2);
    const heals = events.filter((e) => e.type === 'heal');
    expect(heals.map((e) => (e.type === 'heal' ? e.targetId : -1))).toEqual([4]);
  });

  it('the hero comes first on a tie', () => {
    const b = battleWith([hero(3), unit('player', 'heiler', 0), unit('player', 'krieger', -3), unit('enemy', 'krieger', 30)]);
    hold(b, 3, 4);
    b.units[1]!.abilityCooldowns.groupHeal = 99;
    b.units[0]!.hp = b.units[0]!.stats.maxHp * 0.5;
    b.units[2]!.hp = b.units[2]!.stats.maxHp * 0.5;
    const events = run(b, seconds(ACTIONS.heal.windup) + 2);
    const first = events.find((e) => e.type === 'heal');
    expect(first?.type === 'heal' && first.targetId).toBe(1);
  });

  it('casts the group heal when several allies nearby are hurt', () => {
    const b = battleWith([hero(1.5), unit('player', 'heiler', 0), unit('player', 'krieger', -1.5), unit('enemy', 'krieger', 30)]);
    hold(b, 3, 4);
    b.units[0]!.hp = b.units[0]!.stats.maxHp * 0.5;
    b.units[2]!.hp = b.units[2]!.stats.maxHp * 0.5;
    const events = run(b, seconds(ACTIONS.groupHeal.windup) + 2);
    expect(events.some((e) => e.type === 'action' && e.action === 'groupHeal')).toBe(true);
    expect(new Set(events.filter((e) => e.type === 'heal').map((e) => (e.type === 'heal' ? e.targetId : -1)))).toEqual(new Set([1, 2, 3]));
  });

  it('stays back from foes', () => {
    const b = battleWith([parked(), unit('player', 'heiler', 0), unit('enemy', 'krieger', 3)]);
    hold(b, 3);
    // It may loose a bolt first; then it backs off while recharging.
    run(b, seconds(2));
    expect(b.units[1]!.pos.x).toBeLessThan(-2);
  });
});

describe('magier', () => {
  it('lobs a fireball at the largest cluster, telegraphed on the ground', () => {
    const b = battleWith([parked(), unit('player', 'magier', 0), unit('enemy', 'krieger', 8, -5), unit('enemy', 'krieger', 9, 4), unit('enemy', 'krieger', 10, 5), unit('enemy', 'krieger', 9, 6)]);
    hold(b, 3, 4, 5, 6);
    const events = run(b, seconds(ACTIONS.fireball.windup) + 2);
    expect(events.some((e) => e.type === 'shoot' && e.kind === 'fireball')).toBe(true);
    const area = b.areas[0]!;
    expect(area.kind).toBe('fireball');
    expect(area.pos.z).toBeGreaterThan(3);
    expect(area.delay).toBeGreaterThanOrEqual(ACTIONS.fireball.minFlight);
    expect(area.delay).toBeLessThanOrEqual(ACTIONS.fireball.maxFlight);
    const later = run(b, seconds(area.delay));
    expect(later.some((e) => e.type === 'areaResolve')).toBe(true);
    expect(hits(later, 4).length + hits(later, 5).length + hits(later, 6).length).toBeGreaterThanOrEqual(2);
  });

  it('casts frost nova when a foe comes close, freezing those still inside', () => {
    const b = battleWith([parked(), unit('player', 'magier', 0), unit('enemy', 'krieger', 2)]);
    b.units[2]!.attackCooldown = 5;
    const events = run(b, seconds(ACTIONS.frostNova.windup + ACTIONS.frostNova.delay) + 3);
    expect(events.some((e) => e.type === 'action' && e.action === 'frostNova')).toBe(true);
    expect(b.units[2]!.statuses.some((s) => s.kind === 'frozen')).toBe(true);
  });
});

describe('projectiles', () => {
  it('a straight shot hits the first foe in its path and stops', () => {
    const b = battleWith([parked(), unit('player', 'bogenschuetze', 0), unit('enemy', 'krieger', 5), unit('enemy', 'krieger', 8)]);
    hold(b, 2, 3, 4);
    fireStraight(b, b.units[1]!, { kind: 'arrow', at: { x: 8, z: 0 }, speed: 24, radius: 0.3, range: 20, multiplier: 1, damageType: 'physical', pierce: false }, []);
    const events = run(b, seconds(1));
    expect(hits(events, 3)).toHaveLength(1);
    expect(hits(events, 4)).toHaveLength(0);
    expect(b.projectiles).toHaveLength(0);
  });

  it('aims at where the target stood, so stepping aside avoids it', () => {
    const b = battleWith([parked(), unit('player', 'bogenschuetze', 0), unit('enemy', 'krieger', 10)]);
    hold(b, 2);
    fireStraight(b, b.units[1]!, { kind: 'arrow', at: { x: 10, z: 0 }, speed: 24, radius: 0.3, range: 20, multiplier: 1, damageType: 'physical', pierce: false }, []);
    b.units[2]!.pos.z = 2;
    expect(hits(run(b, seconds(1)), 3)).toHaveLength(0);
  });

  it('a dodging hero evades during the i-frames', () => {
    const b = battleWith([hero(10), unit('enemy', 'bogenschuetze', 0)]);
    hold(b, 2);
    fireStraight(b, b.units[1]!, { kind: 'arrow', at: { x: 10, z: 0 }, speed: 60, radius: 0.3, range: 20, multiplier: 1, damageType: 'physical', pierce: false }, []);
    const events = run(b, seconds(0.25), { moveX: 1, dodge: true });
    expect(events.some((e) => e.type === 'evade' && e.unitId === 1)).toBe(true);
    expect(b.units[0]!.hp).toBe(b.units[0]!.stats.maxHp);
  });
});

describe('areas', () => {
  it('resolve after their delay, only on those still inside', () => {
    const b = battleWith([parked(), unit('player', 'magier', 0), unit('enemy', 'krieger', 6), unit('enemy', 'krieger', 6.5, 1)]);
    hold(b, 2, 3, 4);
    placeArea(b, b.units[1]!, { kind: 'fireball', at: { x: 6, z: 0 }, radius: 2, delay: 1, multiplier: 1, damageType: 'magic', freeze: 0 }, []);
    expect(hits(run(b, seconds(0.9)), 3)).toHaveLength(0);
    b.units[3]!.pos = { x: 6, z: 6 };
    const events = run(b, seconds(0.2));
    expect(hits(events, 3)).toHaveLength(1);
    expect(hits(events, 4)).toHaveLength(0);
    expect(b.areas).toHaveLength(0);
  });
});

describe('squad battle', () => {
  it('ends within three minutes with the bot hero', () => {
    for (const seed of [1, 2, 3]) {
      const b = createBattle(squadSetup(seed));
      const bot = createBot();
      while (b.outcome === 'running' && b.tick < seconds(180)) step(b, botInput(b, bot), DT);
      expect(b.outcome).not.toBe('running');
    }
  });

  it('is deterministic', () => {
    const play = (): string => {
      const b = createBattle(squadSetup(11));
      const bot = createBot();
      for (let i = 0; i < seconds(40); i++) step(b, botInput(b, bot), DT);
      return JSON.stringify(b);
    };
    expect(play()).toBe(play());
  });
});

describe('schildtraeger', () => {
  it('shrugs off physical damage but not magic', () => {
    const b = battleWith([parked(), unit('enemy', 'schildtraeger', 5), unit('enemy', 'krieger', 8)]);
    const [, shield, krieger] = b.units;
    // Averaged over many rolls to wash out the damage variance.
    const avg = (u: typeof shield, type: 'physical' | 'magic') => {
      let sum = 0;
      for (let i = 0; i < 400; i++) sum += computeDamage(b, 20, 1, u!, type);
      return sum / 400;
    };
    expect(avg(shield, 'physical') / avg(krieger, 'physical')).toBeLessThan(0.75);
    expect(avg(shield, 'magic')).toBeGreaterThan(avg(krieger, 'magic'));
  });

  it('is slower than a krieger and attacks the nearest foe', () => {
    const b = battleWith([parked(), unit('player', 'krieger', 0, -4), unit('player', 'heiler', -6, 4), unit('enemy', 'schildtraeger', 10), unit('enemy', 'krieger', 10, 8)]);
    run(b, seconds(1));
    expect(b.units[3]!.targetId).toBe(2);
    const travelled = (id: number, x: number, z: number) => Math.hypot(b.units[id - 1]!.pos.x - x, b.units[id - 1]!.pos.z - z);
    expect(travelled(4, 10, 0)).toBeLessThan(travelled(5, 10, 8) * 0.85);
  });
});

describe('berserker', () => {
  it('runs past the front line for the healer', () => {
    const b = battleWith([parked(), unit('player', 'krieger', 0), unit('player', 'bogenschuetze', -6, -3), unit('player', 'heiler', -6, 3), unit('enemy', 'berserker', 6)]);
    hold(b, 2, 3, 4);
    const events = run(b, seconds(4));
    expect(b.units[4]!.targetId).toBe(4);
    expect(hits(events, 4).length).toBeGreaterThan(0);
    expect(hits(events, 2)).toHaveLength(0);
  });

  it('goes for the nearest back-row foe when there is no healer', () => {
    const b = battleWith([parked(), unit('player', 'krieger', 2), unit('player', 'magier', -6, -3), unit('player', 'bogenschuetze', -6, 6), unit('enemy', 'berserker', 6)]);
    hold(b, 2, 3, 4);
    run(b, 1);
    expect(b.units[4]!.targetId).toBe(3);
  });

  it('ignores the two-attacker cap', () => {
    const b = battleWith([parked(), unit('player', 'heiler', 0), unit('enemy', 'krieger', 1.6, -1), unit('enemy', 'krieger', 1.6, 1), unit('enemy', 'berserker', 3)]);
    hold(b, 2);
    const events = run(b, seconds(2));
    for (const id of [3, 4, 5]) expect(events.some((e) => e.type === 'attackStart' && e.unitId === id)).toBe(true);
  });

  it('a krieger taunt pulls it off the healer', () => {
    const b = battleWith([parked(), unit('player', 'heiler', -6), unit('player', 'krieger', 0), unit('enemy', 'berserker', 1), unit('enemy', 'krieger', 1, 2)]);
    hold(b, 2);
    run(b, seconds(ACTIONS.taunt.windup) + 2);
    expect(b.units[3]!.statuses.some((s) => s.kind === 'taunted')).toBe(true);
    expect(b.units[3]!.targetId).toBe(3);
  });
});

describe('schamane', () => {
  it('heals the most hurt ally', () => {
    const b = battleWith([parked(), unit('enemy', 'schamane', 10), unit('enemy', 'krieger', 6, -2), unit('enemy', 'krieger', 6, 2)]);
    hold(b, 3, 4);
    b.units[2]!.hp = b.units[2]!.stats.maxHp * 0.7;
    b.units[3]!.hp = b.units[3]!.stats.maxHp * 0.4;
    const events = run(b, seconds(ACTIONS.heal.windup) + 2);
    const first = events.find((e) => e.type === 'heal');
    expect(first?.type === 'heal' && first.targetId).toBe(4);
  });

  it('shields an ally under attack', () => {
    const b = battleWith([parked(), unit('enemy', 'schamane', 10), unit('enemy', 'krieger', 5), unit('player', 'krieger', 3.5)]);
    hold(b, 3, 4);
    b.units[3]!.targetId = 3;
    const events = run(b, seconds(ACTIONS.ward.windup) + 2);
    expect(events.some((e) => e.type === 'action' && e.unitId === 2 && e.action === 'ward')).toBe(true);
    const shield = b.units[2]!.statuses.find((s) => s.kind === 'shielded');
    expect(shield?.amount).toBeCloseTo(b.units[1]!.stats.power * ACTIONS.ward.shield, 5);
    expect(b.units[1]!.abilityCooldowns.ward).toBeGreaterThan(0);
  });

  it('does not ward an ally nobody is attacking', () => {
    const b = battleWith([parked(), unit('enemy', 'schamane', 10), unit('enemy', 'krieger', 5)]);
    hold(b, 3);
    const events = run(b, seconds(2));
    expect(events.some((e) => e.type === 'action' && e.action === 'ward')).toBe(false);
  });

  it('keeps away from foes', () => {
    const b = battleWith([parked(), unit('enemy', 'schamane', 0), unit('player', 'krieger', -3)]);
    hold(b, 3);
    run(b, seconds(2));
    expect(b.units[1]!.pos.x).toBeGreaterThan(2);
  });
});
