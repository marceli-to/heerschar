import { describe, expect, it } from 'vitest';
import { createBattle, heroOf, step } from '../../src/sim/battle';
import { COUNTDOWN, DT, ENEMY, HERO, heroAttack } from '../../src/sim/balance';
import { computeDamage } from '../../src/sim/combat';
import { nextFloat } from '../../src/sim/rng';
import { trialSetup } from '../../src/data/encounters';
import type { HeroInput } from '../../src/sim/types';
import { battleWith, enemy, hero, input, run, seconds } from './helpers';

describe('countdown', () => {
  it('holds everyone still for the countdown, then the fight runs', () => {
    const b = createBattle(trialSetup(1));
    const start = { ...heroOf(b)!.pos };
    const events = [];
    for (let i = 0; i < seconds(COUNTDOWN) - 1; i++) events.push(...step(b, input({ moveX: 1 }), DT));
    expect(heroOf(b)!.pos).toEqual(start);
    expect(events.filter((e) => e.type === 'countdown').map((e) => (e.type === 'countdown' ? e.value : -1))).toEqual([2, 1]);
    for (let i = 0; i < 30; i++) step(b, input({ moveX: 1 }), DT);
    expect(heroOf(b)!.pos.x).toBeGreaterThan(start.x);
  });
});

describe('hero movement', () => {
  it('moves at 5 m/s and faces the movement direction', () => {
    const b = battleWith([hero(), enemy(15)]);
    run(b, seconds(1), { moveZ: 1 });
    const h = heroOf(b)!;
    expect(h.pos.z).toBeCloseTo(HERO.moveSpeed, 0);
    expect(Math.abs(Math.cos(h.facing - Math.PI))).toBeCloseTo(1, 2);
  });
});

describe('dodge', () => {
  it('covers 4 m in 0.35 s', () => {
    const b = battleWith([hero(), enemy(15)]);
    run(b, seconds(HERO.dodge.duration) + 1, { moveX: -1, dodge: true });
    expect(heroOf(b)!.pos.x).toBeCloseTo(-HERO.dodge.distance, 0);
  });

  it('has a cooldown', () => {
    const b = battleWith([hero(), enemy(15)]);
    run(b, seconds(0.5), { moveX: -1, dodge: true });
    const x = heroOf(b)!.pos.x;
    const events = run(b, 2, { dodge: true });
    expect(events.some((e) => e.type === 'dodge')).toBe(false);
    expect(heroOf(b)!.pos.x).toBeCloseTo(x, 3);
  });

  it('makes the hero immune during the first 0.25 s', () => {
    const b = battleWith([hero(), enemy(1.4)]);
    const e = b.units[1]!;
    e.state = 'windup';
    e.targetId = 1;
    e.stateTime = ENEMY.attack.windup - 0.05;
    // Dodge sideways (straight through would leave the arc); the swing lands inside the i-frames.
    const events = run(b, 6, { moveZ: 1, dodge: true });
    expect(events.some((ev) => ev.type === 'evade')).toBe(true);
    expect(heroOf(b)!.hp).toBe(heroOf(b)!.stats.maxHp);
  });
});

describe('attack chain', () => {
  it('a single press swings once', () => {
    const b = battleWith([hero(), enemy(1.5)]);
    const events = run(b, seconds(1.2), { attack: true, aimAngle: Math.PI / 2 });
    expect(events.filter((e) => e.type === 'swing' && e.unitId === 1)).toHaveLength(1);
    expect(events.filter((e) => e.type === 'hit' && e.attackerId === 1)).toHaveLength(1);
  });

  it('a second press in time chains into the heavy swing', () => {
    const b = battleWith([hero(), enemy(1.5)]);
    const events = run(b, 3, { attack: true, aimAngle: Math.PI / 2 });
    events.push(...run(b, 1, { attack: true, aimAngle: Math.PI / 2 }));
    events.push(...run(b, seconds(1.5), { aimAngle: Math.PI / 2 }));
    const swings = events.filter((e) => e.type === 'swing' && e.unitId === 1);
    expect(swings.map((e) => (e.type === 'swing' ? e.chain : -1))).toEqual([0, 1]);
    const hits = events.filter((e) => e.type === 'hit' && e.attackerId === 1);
    expect(hits.map((e) => (e.type === 'hit' ? e.heavy : null))).toEqual([false, true]);
  });

  it('aim assist turns the swing onto a nearby enemy', () => {
    const b = battleWith([hero(), enemy(1.2, 1.2)]);
    // Aiming straight east; the enemy stands 45° off to the south-east.
    const events = run(b, seconds(0.6), { attack: true, aimAngle: Math.PI / 2 });
    expect(events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('staggers and knocks back the target', () => {
    const b = battleWith([hero(), enemy(1.5)]);
    b.units[1]!.attackCooldown = 5;
    run(b, seconds(heroAttack(0).windup) + 2, { attack: true, aimAngle: Math.PI / 2 });
    const e = b.units[1]!;
    expect(e.state).toBe('stunned');
    run(b, seconds(0.3));
    expect(e.pos.x).toBeGreaterThan(1.6);
  });
});

describe('poise', () => {
  it('a light hit does not interrupt a windup, a heavy one does', () => {
    const b = battleWith([hero(), enemy(1.5)]);
    const e = b.units[1]!;
    e.state = 'windup';
    e.targetId = 1;
    run(b, seconds(heroAttack(0).windup) + 2, { attack: true, aimAngle: Math.PI / 2 });
    expect(e.state).not.toBe('stunned');

    const c = battleWith([hero(), enemy(1.5)]);
    const f = c.units[1]!;
    f.state = 'windup';
    f.targetId = 1;
    c.units[0]!.chain = 1;
    c.units[0]!.state = 'windup';
    run(c, seconds(heroAttack(1).windup) + 2, { aimAngle: Math.PI / 2 });
    expect(f.state).toBe('stunned');
  });

  it('cannot be stun-locked: a second stagger right after the first is ignored', () => {
    const b = battleWith([hero(), enemy(1.5)]);
    const e = b.units[1]!;
    e.attackCooldown = 10;
    run(b, seconds(0.3), { attack: true, aimAngle: Math.PI / 2 });
    expect(e.staggerImmunity).toBeGreaterThan(0);
  });
});

describe('enemies', () => {
  it('approach and wind up for at least 0.35 s before hitting', () => {
    const b = battleWith([hero(), enemy(8)]);
    let windupStart = -1;
    let hitTick = -1;
    for (let i = 0; i < seconds(6) && hitTick < 0; i++) {
      for (const ev of step(b, input(), DT)) {
        if (ev.type === 'attackStart' && windupStart < 0) windupStart = b.tick;
        if (ev.type === 'hit' && ev.targetId === 1) hitTick = b.tick;
      }
    }
    expect(windupStart).toBeGreaterThan(0);
    expect(hitTick).toBeGreaterThan(0);
    expect((hitTick - windupStart) * DT).toBeGreaterThanOrEqual(0.35);
  });

  it('take turns: no more than two attack at once', () => {
    const b = battleWith([hero(), enemy(3, -1), enemy(3, 0), enemy(3, 1), enemy(-3, 0)]);
    for (let i = 0; i < seconds(8); i++) {
      step(b, input(), DT);
      const attacking = b.units.filter((u) => u.team === 'enemy' && (u.state === 'windup' || u.state === 'recover'));
      expect(attacking.length).toBeLessThanOrEqual(ENEMY.maxAttackers);
    }
  });
});

describe('damage', () => {
  it('follows power × mult × 100 / (100 + armor) within ±10%', () => {
    const b = battleWith([hero(), enemy(5)]);
    const target = b.units[1]!;
    for (let i = 0; i < 200; i++) {
      const d = computeDamage(b, 14, 1, target, 'physical');
      const base = (14 * 100) / 140;
      expect(d).toBeGreaterThanOrEqual(base * 0.9);
      expect(d).toBeLessThanOrEqual(base * 1.1);
    }
  });
});

describe('outcome', () => {
  it('is won when all enemies are dead and lost when the hero falls', () => {
    const won = battleWith([hero(), enemy(1.5)]);
    won.units[1]!.hp = 1;
    expect(run(won, seconds(0.5), { attack: true, aimAngle: Math.PI / 2 }).some((e) => e.type === 'outcome')).toBe(true);
    expect(won.outcome).toBe('won');

    const lost = battleWith([hero(), enemy(1.5)]);
    lost.units[0]!.hp = 1;
    run(lost, seconds(4));
    expect(lost.outcome).toBe('lost');
  });

  it('a standing-still hero loses the trial', () => {
    const b = createBattle(trialSetup(3));
    for (let i = 0; i < seconds(120) && b.outcome === 'running'; i++) step(b, input(), DT);
    expect(b.outcome).toBe('lost');
  });
});

describe('determinism', () => {
  it('the same seed, setup and recorded input give an identical final state', () => {
    const inputs: HeroInput[] = [];
    const rec = { rngState: 99 };
    for (let i = 0; i < seconds(40); i++) {
      const a = nextFloat(rec) * Math.PI * 2;
      inputs.push(input({ moveX: Math.sin(a), moveZ: -Math.cos(a), aimAngle: a, attack: nextFloat(rec) < 0.08, dodge: nextFloat(rec) < 0.02 }));
    }
    const play = (): string => {
      const b = createBattle(trialSetup(7));
      for (const inp of inputs) step(b, inp, DT);
      return JSON.stringify(b);
    };
    const first = play();
    expect(play()).toBe(first);
    expect(JSON.parse(first).tick).toBeGreaterThan(seconds(COUNTDOWN + 5));
  });
});
