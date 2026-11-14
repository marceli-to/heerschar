import { describe, expect, it } from 'vitest';
import { createBattle, heroOf, step } from '../../src/sim/battle';
import { DT, ENERGY, HERO_ABILITIES, HERO_SELF_HEAL, STATUS } from '../../src/sim/balance';
import { stun } from '../../src/sim/combat';
import { nextFloat } from '../../src/sim/rng';
import { hasStatus, getStatus } from '../../src/sim/statuses';
import { squadSetup } from '../../src/data/encounters';
import type { Battle, BattleEvent, ClassId, HeroInput } from '../../src/sim/types';
import { battleWith, enemy, hero, hold, input, PRESSES, run, seconds, unit } from './helpers';

const EAST = Math.PI / 2;
const WEST = -Math.PI / 2;

const H = (b: Battle) => heroOf(b)!;
const U = (b: Battle, id: number) => b.units[id - 1]!;
const hits = (events: BattleEvent[], targetId: number) => events.filter((e) => e.type === 'hit' && e.targetId === targetId);
const heals = (events: BattleEvent[], targetId: number) =>
  events.filter((e): e is Extract<BattleEvent, { type: 'heal' }> => e.type === 'heal' && e.targetId === targetId).reduce((s, e) => s + e.amount, 0);

/** Casts an ability (Q = 1, E = 2, R = leader) with full energy and runs until it has played out. */
function cast(b: Battle, which: 'ability1' | 'ability2' | 'leader', ticks = seconds(1), p: Partial<HeroInput> = {}): BattleEvent[] {
  H(b).energy = 100;
  return run(b, ticks, { aimAngle: EAST, [which]: true, ...p });
}

describe('energy', () => {
  it('starts at 30 and regenerates 4 per second up to 100', () => {
    const b = battleWith([hero(), enemy(15)]);
    hold(b, 2);
    expect(H(b).energy).toBe(ENERGY.start);
    run(b, seconds(1));
    expect(H(b).energy).toBeCloseTo(ENERGY.start + ENERGY.perSecond, 1);
    run(b, seconds(30));
    expect(H(b).energy).toBe(ENERGY.max);
  });

  it('does not regenerate during the countdown', () => {
    const b = createBattle({ seed: 1, units: [hero(), enemy(15)] });
    for (let i = 0; i < seconds(2); i++) step(b, input(), DT);
    expect(H(b).energy).toBe(ENERGY.start);
  });

  it('a basic melee attack that hits gives 5, once per swing however many it hits', () => {
    const b = battleWith([hero(), enemy(1.4, -0.4), enemy(1.4, 0.4)]);
    hold(b, 2, 3);
    const events = run(b, seconds(0.3), { aimAngle: EAST, attack: true });
    expect(hits(events, 2)).toHaveLength(1);
    expect(hits(events, 3)).toHaveLength(1);
    expect(H(b).energy).toBeCloseTo(ENERGY.start + ENERGY.perSecond * 0.3 + ENERGY.perBasicHit, 1);
  });

  it('a whiff gives nothing', () => {
    const b = battleWith([hero(), enemy(10)]);
    hold(b, 2);
    run(b, seconds(0.3), { aimAngle: EAST, attack: true });
    expect(H(b).energy).toBeCloseTo(ENERGY.start + ENERGY.perSecond * 0.3, 1);
  });

  it('ranged heroes shoot along the aim and gain energy when the shot lands', () => {
    const b = battleWith([hero(0, 0, 'bogenschuetze'), enemy(8, 0), enemy(0, 8)]);
    hold(b, 2, 3);
    const events = run(b, seconds(0.8), { aimAngle: EAST, attack: true });
    expect(events.some((e) => e.type === 'shoot' && e.kind === 'arrow')).toBe(true);
    expect(hits(events, 2)).toHaveLength(1);
    expect(hits(events, 3)).toHaveLength(0);
    expect(H(b).energy).toBeCloseTo(ENERGY.start + ENERGY.perSecond * 0.8 + ENERGY.perBasicHit, 1);
  });

  it('caster heroes shoot magic bolts', () => {
    const b = battleWith([hero(0, 0, 'magier'), enemy(8, 0)]);
    hold(b, 2);
    const events = run(b, seconds(0.8), { aimAngle: EAST, attack: true });
    expect(events.some((e) => e.type === 'shoot' && e.kind === 'bolt')).toBe(true);
    expect(hits(events, 2)).toHaveLength(1);
  });
});

describe('ability rules', () => {
  it('cannot be cast without the energy, and is paid on release with a cooldown', () => {
    const b = battleWith([hero(), enemy(1.6)]);
    hold(b, 2);
    H(b).energy = HERO_ABILITIES.wirbel.cost - 1;
    let events = run(b, 2, { ability2: true });
    expect(events.some((e) => e.type === 'action')).toBe(false);
    // A press is remembered briefly, so it fires once the energy arrives.
    H(b).energy = HERO_ABILITIES.wirbel.cost;
    events = run(b, seconds(0.6), { ability2: true });
    expect(events.some((e) => e.type === 'release' && e.action === 'wirbel')).toBe(true);
    expect(H(b).energy).toBeLessThan(5);
    expect(H(b).abilityCooldowns.wirbel).toBeGreaterThan(HERO_ABILITIES.wirbel.cooldown - 1);
    H(b).energy = 100;
    events = run(b, seconds(1), { ability2: true });
    expect(events.some((e) => e.type === 'action')).toBe(false);
  });

  it('an interrupted cast costs nothing', () => {
    const b = battleWith([hero(), enemy(1.6)]);
    hold(b, 2);
    H(b).energy = 100;
    run(b, 2, { ability1: true });
    expect(H(b).action).toBe('schildstoss');
    stun(H(b), 0.5);
    run(b, seconds(0.6));
    expect(H(b).energy).toBeGreaterThanOrEqual(100 - 1e-9);
    expect(H(b).abilityCooldowns.schildstoss ?? 0).toBe(0);
  });

  it('the hero kit follows the class', () => {
    const kits: [ClassId, string, string][] = [
      ['krieger', 'schildstoss', 'wirbel'],
      ['bogenschuetze', 'salve', 'rueckzug'],
      ['heiler', 'heilkreis', 'segen'],
      ['magier', 'feuerball', 'frostring'],
    ];
    for (const [c, q, e] of kits) {
      const b = battleWith([hero(0, 0, c), enemy(20)]);
      hold(b, 2);
      const ev1 = cast(b, 'ability1');
      const ev2 = cast(b, 'ability2', seconds(1.2));
      const ev3 = cast(b, 'leader');
      expect(ev1.find((x) => x.type === 'release')).toMatchObject({ action: q });
      expect(ev2.find((x) => x.type === 'release')).toMatchObject({ action: e });
      expect(ev3.find((x) => x.type === 'release')).toMatchObject({ action: 'sammeln' });
    }
  });
});

describe('Krieger kit', () => {
  it('Schildstoss stuns everyone in the cone in front, regardless of poise', () => {
    const b = battleWith([hero(), enemy(1.8, -0.5), enemy(1.8, 0.5), enemy(-1.8, 0)]);
    U(b, 2).staggerImmunity = 5;
    cast(b, 'ability1', seconds(0.3));
    expect(U(b, 2).state).toBe('stunned');
    expect(U(b, 3).state).toBe('stunned');
    expect(U(b, 4).state).not.toBe('stunned');
    expect(U(b, 2).stunDuration).toBe(HERO_ABILITIES.schildstoss.stun);
  });

  it('Wirbel hits everyone around', () => {
    const b = battleWith([hero(), enemy(1.8), enemy(-1.8), enemy(0, 1.8), enemy(0, -6)]);
    hold(b, 2, 3, 4, 5);
    const events = cast(b, 'ability2', seconds(0.4));
    for (const id of [2, 3, 4]) expect(hits(events, id)).toHaveLength(1);
    expect(hits(events, 5)).toHaveLength(0);
  });
});

describe('Bogenschuetze kit', () => {
  it('Salve fires three arrows in a fan', () => {
    const b = battleWith([hero(0, 0, 'bogenschuetze'), enemy(20)]);
    hold(b, 2);
    const events = cast(b, 'ability1', seconds(0.4));
    expect(events.filter((e) => e.type === 'shoot' && e.kind === 'arrow')).toHaveLength(3);
    const dirs = b.projectiles.map((p) => Math.atan2(p.dir.x, -p.dir.z)).sort();
    expect(dirs[2]! - dirs[0]!).toBeCloseTo(2 * HERO_ABILITIES.salve.spread, 5);
  });

  it('Rueckzug slows enemies in front and leaps back', () => {
    const b = battleWith([hero(0, 0, 'bogenschuetze'), enemy(3), enemy(-3)]);
    const events = cast(b, 'ability2', seconds(0.6));
    expect(events.some((e) => e.type === 'status' && e.unitId === 2 && e.kind === 'slowed' && e.on)).toBe(true);
    expect(hasStatus(U(b, 3), 'slowed')).toBe(false);
    expect(H(b).pos.x).toBeLessThan(-HERO_ABILITIES.rueckzug.distance + 1.5);
  });

  it('slowed units move slower', () => {
    const b = battleWith([hero(-20, 0), unit('enemy', 'krieger', 0)]);
    const free = battleWith([hero(-20, 0), unit('enemy', 'krieger', 0)]);
    U(b, 2).statuses.push({ kind: 'slowed', time: 99, amount: 0, sourceId: 0 });
    run(b, seconds(1));
    run(free, seconds(1));
    expect(Math.abs(U(b, 2).pos.x) / Math.abs(U(free, 2).pos.x)).toBeCloseTo(STATUS.slowed, 1);
  });
});

describe('Heiler kit', () => {
  it('Heilkreis heals allies inside over time, the hero at reduced strength', () => {
    const b = battleWith([hero(0, 0, 'heiler'), unit('player', 'krieger', 1.5), enemy(20)]);
    hold(b, 2, 3);
    H(b).hp = 20;
    U(b, 2).hp = 20;
    const events = cast(b, 'ability1', seconds(6));
    const onHero = heals(events, 1);
    const onAlly = heals(events, 2);
    expect(onAlly).toBeGreaterThan(30);
    expect(onHero / onAlly).toBeCloseTo(HERO_SELF_HEAL, 1);
  });

  it('Segen shields the ally with the lowest health fraction', () => {
    const b = battleWith([hero(0, 0, 'heiler'), unit('player', 'krieger', 2), unit('player', 'magier', 0, 2), enemy(20)]);
    hold(b, 2, 3, 4);
    U(b, 3).hp = 30;
    cast(b, 'ability2', seconds(0.5));
    const shield = getStatus(U(b, 3), 'shielded');
    expect(shield?.amount).toBeCloseTo(H(b).stats.power * HERO_ABILITIES.segen.shield);
    expect(hasStatus(U(b, 2), 'shielded')).toBe(false);
  });
});

describe('Magier kit', () => {
  it('Feuerball lands on the lock target with a telegraphed circle', () => {
    const b = battleWith([hero(0, 0, 'magier'), enemy(8, 3), enemy(8, -3)]);
    hold(b, 2, 3);
    run(b, 1, { aimAngle: EAST, lock: true });
    const locked = b.lockTargetId!;
    const events = cast(b, 'ability1', seconds(2));
    const start = events.find((e) => e.type === 'areaStart');
    const resolve = events.find((e): e is Extract<BattleEvent, { type: 'areaResolve' }> => e.type === 'areaResolve');
    expect(start).toMatchObject({ kind: 'fireball' });
    expect(resolve).toMatchObject({ kind: 'fireball', x: U(b, locked).pos.x, z: U(b, locked).pos.z });
    expect(hits(events, locked)).toHaveLength(1);
  });

  it('Frostring freezes everyone around the hero', () => {
    const b = battleWith([hero(0, 0, 'magier'), enemy(2), enemy(-2.5, 1), enemy(10)]);
    cast(b, 'ability2', seconds(0.4));
    expect(hasStatus(U(b, 2), 'frozen')).toBe(true);
    expect(hasStatus(U(b, 3), 'frozen')).toBe(true);
    expect(hasStatus(U(b, 4), 'frozen')).toBe(false);
  });
});

describe('Sammeln', () => {
  it('rallies all living companions for 6 s, not the hero', () => {
    const b = battleWith([hero(), unit('player', 'bogenschuetze', -3), unit('player', 'heiler', -4, 2), enemy(20)]);
    hold(b, 4);
    cast(b, 'leader', seconds(0.5));
    expect(hasStatus(U(b, 2), 'rallied')).toBe(true);
    expect(hasStatus(U(b, 3), 'rallied')).toBe(true);
    expect(hasStatus(H(b), 'rallied')).toBe(false);
    run(b, seconds(6));
    expect(hasStatus(U(b, 2), 'rallied')).toBe(false);
  });
});

describe('lock-on', () => {
  it('Tab locks the enemy nearest the view centre', () => {
    const b = battleWith([hero(), enemy(10, 0), enemy(4, 6), enemy(-5, 0)]);
    hold(b, 2, 3, 4);
    run(b, 1, { aimAngle: EAST, lock: true });
    expect(b.lockTargetId).toBe(2);
    run(b, 1, { aimAngle: WEST, unlock: true });
    run(b, 1, { aimAngle: WEST, lock: true });
    expect(b.lockTargetId).toBe(4);
  });

  it('Tab again cycles through every enemy in range; Shift+Tab releases', () => {
    const b = battleWith([hero(), enemy(8, 0), enemy(0, 8), enemy(-8, 0), enemy(0, -8)]);
    hold(b, 2, 3, 4, 5);
    const seen = new Set<number>();
    for (let i = 0; i < 4; i++) {
      run(b, 1, { aimAngle: EAST, lock: true });
      seen.add(b.lockTargetId!);
    }
    expect(seen.size).toBe(4);
    run(b, 1, { lock: true });
    expect(seen.has(b.lockTargetId!)).toBe(true);
    const events = run(b, 1, { unlock: true });
    expect(b.lockTargetId).toBeNull();
    expect(events).toContainEqual({ type: 'lock', targetId: null });
  });

  it('the hero faces the lock target while moving and attacks towards it', () => {
    const b = battleWith([hero(), enemy(0, -6)]);
    hold(b, 2);
    run(b, 1, { aimAngle: 0, lock: true });
    run(b, seconds(0.5), { moveX: 1, moveZ: 0, aimAngle: EAST });
    // Strafing along +x while the target sits to the north-west: facing points at it, not along x.
    const toTarget = Math.atan2(U(b, 2).pos.x - H(b).pos.x, -(U(b, 2).pos.z - H(b).pos.z));
    expect(H(b).facing).toBeCloseTo(toTarget, 1);
    expect(H(b).pos.x).toBeGreaterThan(2);
  });

  it('is released when the target dies', () => {
    const b = battleWith([hero(), enemy(1.5), enemy(10)]);
    run(b, 1, { aimAngle: EAST, lock: true });
    expect(b.lockTargetId).toBe(2);
    U(b, 2).hp = 1;
    hold(b, 2, 3);
    const events = run(b, seconds(0.4), { attack: true });
    expect(b.lockTargetId).toBeNull();
    expect(events).toContainEqual({ type: 'lock', targetId: null });
  });
});

describe('mark', () => {
  it('F marks the locked enemy, F again clears it', () => {
    const b = battleWith([hero(), enemy(8, 0), enemy(0, 8)]);
    hold(b, 2, 3);
    run(b, 1, { aimAngle: Math.PI, lock: true });
    expect(b.lockTargetId).toBe(3);
    run(b, 1, { aimAngle: EAST, mark: true });
    expect(b.markTargetId).toBe(3);
    run(b, 1, { mark: true });
    expect(b.markTargetId).toBeNull();
  });

  it('without a lock, F marks the enemy nearest the view centre', () => {
    const b = battleWith([hero(), enemy(8, 0), enemy(0, 8)]);
    hold(b, 2, 3);
    run(b, 1, { aimAngle: EAST, mark: true });
    expect(b.markTargetId).toBe(2);
    expect(b.lockTargetId).toBeNull();
  });

  it('companion damage dealers focus the marked enemy', () => {
    const b = battleWith([hero(-10), unit('player', 'bogenschuetze', 0), enemy(10, 0), enemy(10, 4)]);
    hold(b, 3, 4);
    U(b, 3).hp = 20; // the archer's natural pick would be the weakest
    run(b, 1, { aimAngle: Math.atan2(20, -4), mark: true });
    expect(b.markTargetId).toBe(4);
    const events = run(b, seconds(3));
    expect(hits(events, 4).length).toBeGreaterThan(0);
    expect(hits(events, 3)).toHaveLength(0);
  });
});

describe('hero kit in a full battle', () => {
  /** Random presses of every hero input, recorded once so a replay is exact. */
  function recorded(seed: number, ticks: number): HeroInput[] {
    const rec = { rngState: seed };
    const out: HeroInput[] = [];
    for (let i = 0; i < ticks; i++) {
      const a = nextFloat(rec) * Math.PI * 2;
      const inp = input({ moveX: Math.sin(a), moveZ: -Math.cos(a), aimAngle: EAST + (nextFloat(rec) - 0.5) });
      for (const k of PRESSES) inp[k] = nextFloat(rec) < (k === 'attack' ? 0.08 : 0.01);
      out.push(inp);
    }
    return out;
  }

  for (const c of ['krieger', 'bogenschuetze', 'heiler', 'magier'] as const) {
    it(`${c}: the same seed and input replay identically, and only a Heiler hero heals himself`, () => {
      const inputs = recorded(17, seconds(45));
      const play = () => {
        const setup = squadSetup(11);
        const h = setup.units.find((u) => u.isHero)!;
        h.classId = c;
        const b = createBattle(setup);
        const events: BattleEvent[] = [];
        for (const inp of inputs) events.push(...step(b, inp, DT));
        return { state: JSON.stringify(b), events };
      };
      const first = play();
      expect(play().state).toBe(first.state);
      const hero = 1;
      const casts = first.events.filter((e) => e.type === 'release' && e.unitId === hero);
      expect(casts.length).toBeGreaterThan(0);
      const selfHeal = first.events.some((e) => e.type === 'heal' && e.sourceId === hero && e.targetId === hero && e.amount > 0);
      if (c !== 'heiler') expect(selfHeal).toBe(false);
    });
  }
});

describe('debug: passive enemies', () => {
  it('enemies never act, but still take hits', () => {
    const b = createBattle({ seed: 1, units: [hero(), enemy(1.5), enemy(3, 2)], passiveEnemies: true });
    b.countdown = 0;
    const events = run(b, seconds(10), { aimAngle: EAST, attack: true });
    expect(events.some((e) => e.type === 'hit' && e.targetId === 1)).toBe(false);
    expect(hits(events, 2).length).toBeGreaterThan(0);
  });
});
