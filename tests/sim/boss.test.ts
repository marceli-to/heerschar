import { describe, expect, it } from 'vitest';
import { BOSS_ACTIONS, DT } from '../../src/sim/balance';
import { stun } from '../../src/sim/combat';
import { createBattle, step } from '../../src/sim/battle';
import { createBot, botInput } from '../../src/sim/bot';
import { freeze, insideArea, placeArea } from '../../src/sim/projectiles';
import { encounterById, enemyReserves } from '../../src/data/encounters';
import { battleSetupFor } from '../../src/meta/squad';
import { newSquad, SANDBOX_COMPANIONS } from '../../src/data/roster';
import { CLASS_STATS } from '../../src/data/classes';
import type { AreaEffect, Battle, BattleEvent, ClassId, Unit } from '../../src/sim/types';
import { battleWith, hero, hold, run, seconds, unit } from './helpers';

function boss(classId: ClassId, x = 0, z = 0) {
  return unit('enemy', classId, x, z);
}

/** Lets a boss's brain pick `ready` next: every other action cools down, the beat is due. */
function only(u: Unit, ready: string): void {
  for (const k of ['sweep', 'charge', 'slam', 'poison', 'summon', 'mend', 'raise'] as const) u.abilityCooldowns[k] = k === ready ? 0 : 999;
  u.attackCooldown = 0;
}

function area(b: Battle, kind: AreaEffect['kind']): AreaEffect[] {
  return b.areas.filter((a) => a.kind === kind);
}

describe('boss bodies', () => {
  it('bosses are immune to stun and freeze', () => {
    const b = battleWith([hero(-10), boss('kriegsherr', 0)]);
    const w = b.units[1]!;
    stun(w, 2);
    expect(w.state).not.toBe('stunned');
    freeze(w, 2, []);
    expect(w.statuses.some((s) => s.kind === 'frozen')).toBe(false);
  });

  it('a frost ring does not freeze a boss but still damages it', () => {
    const b = battleWith([hero(-1, 0, 'magier'), boss('kriegsherr', 1)]);
    const w = b.units[1]!;
    const before = w.hp;
    placeArea(b, b.units[0]!, { kind: 'frostring', at: { x: -1, z: 0 }, radius: 4, delay: 0, multiplier: 0.5, damageType: 'magic', freeze: 2.5 }, []);
    run(b, 1);
    expect(w.hp).toBeLessThan(before);
    expect(w.statuses.some((s) => s.kind === 'frozen')).toBe(false);
  });

  it('a boss is pushed far less than a soldier and pushes others aside', () => {
    const b = battleWith([hero(-10), boss('kriegsherr', 0, 0), unit('player', 'krieger', 0.9, 0)]);
    hold(b, 2);
    b.units[1]!.statuses = [];
    b.units[1]!.attackCooldown = 99;
    for (const k of ['sweep', 'charge', 'slam', 'summon'] as const) b.units[1]!.abilityCooldowns[k] = 99;
    const w = b.units[1]!;
    const k = b.units[2]!;
    const start = { ...w.pos };
    hold(b, 3);
    run(b, 5);
    const bossMoved = Math.hypot(w.pos.x - start.x, w.pos.z - start.z);
    const soldierMoved = Math.abs(k.pos.x - 0.9);
    expect(soldierMoved).toBeGreaterThan(bossMoved * 3);
  });
});

describe('area shapes', () => {
  const base = { id: 1, kind: 'sweep', team: 'enemy', ownerId: 1, pos: { x: 0, z: 0 }, angle: Math.PI / 2, arc: Math.PI / 2, length: 10, radius: 2, knockback: 0, delay: 1, time: 0, power: 1, multiplier: 1, damageType: 'physical', freeze: 0, heal: false, pulses: 1, interval: 0 } as const;

  it('an arc covers its slice only', () => {
    const a: AreaEffect = { ...base, shape: 'arc' };
    expect(insideArea(a, { x: 1.5, z: 0 }, 0)).toBe(true); // straight ahead (+x)
    expect(insideArea(a, { x: -1.5, z: 0 }, 0)).toBe(false); // behind
    expect(insideArea(a, { x: 0, z: 1.5 }, 0)).toBe(false); // 90° off a 90° arc
    expect(insideArea(a, { x: 3, z: 0 }, 0)).toBe(false); // too far
  });

  it('a lane covers a strip along its angle', () => {
    const a: AreaEffect = { ...base, shape: 'lane' };
    expect(insideArea(a, { x: 8, z: 1.5 }, 0)).toBe(true);
    expect(insideArea(a, { x: 8, z: 2.5 }, 0)).toBe(false);
    expect(insideArea(a, { x: 11, z: 0 }, 0)).toBe(false);
    expect(insideArea(a, { x: -1, z: 0 }, 0)).toBe(false);
  });
});

describe('Iron Warlord', () => {
  it('sweep: a filling arc in front that resolves when the windup ends and spares those behind', () => {
    const b = battleWith([hero(-20, 10), unit('player', 'krieger', -2, 0), unit('player', 'krieger', 2, 0), boss('kriegsherr', 0, 0)]);
    hold(b, 2, 3);
    const w = b.units[3]!;
    only(w, 'sweep');
    run(b, 1);
    expect(w.action).toBe('sweep');
    const [warn] = area(b, 'sweep');
    expect(warn?.shape).toBe('arc');
    expect(warn?.delay).toBeCloseTo(BOSS_ACTIONS.sweep.windup);
    const front = b.units.find((u) => insideArea(warn!, u.pos, 0.5) && u.team === 'player')!;
    const back = b.units[front.id === 2 ? 2 : 1]!;
    run(b, seconds(BOSS_ACTIONS.sweep.windup) + 2);
    expect(front.hp).toBeLessThan(front.stats.maxHp);
    expect(back.hp).toBe(back.stats.maxHp);
  });

  it('charge: a lane warning, then a fast run that hits everyone in the way once', () => {
    const b = battleWith([hero(-20, 10), unit('player', 'heiler', -8, 0), boss('kriegsherr', 0, 0)]);
    const w = b.units[2]!;
    const h = b.units[1]!;
    hold(b, 2);
    only(w, 'charge');
    run(b, 1);
    expect(w.action).toBe('charge');
    expect(area(b, 'charge')[0]?.shape).toBe('lane');
    const startX = w.pos.x;
    const events = run(b, seconds(BOSS_ACTIONS.charge.windup + BOSS_ACTIONS.charge.dash) + 3);
    expect(startX - w.pos.x).toBeGreaterThan(BOSS_ACTIONS.charge.maxLength * 0.8);
    expect(events.filter((e) => e.type === 'hit' && e.targetId === h.id)).toHaveLength(1);
  });

  it('a sideways dodge as the lane fills gets out of the way', () => {
    const b = battleWith([hero(-8, 0), boss('kriegsherr', 0, 0)]);
    const w = b.units[1]!;
    only(w, 'charge');
    run(b, seconds(BOSS_ACTIONS.charge.windup - 0.2));
    const events = run(b, seconds(1.5), { dodge: true, moveZ: 1 });
    expect(events.some((e) => e.type === 'hit' && e.targetId === 1)).toBe(false);
    expect(w.pos.x).toBeLessThan(-8);
  });

  it('slam: a circle around him and one under each far foe', () => {
    const b = battleWith([hero(-20, 10), unit('player', 'krieger', -1.5, 0), unit('player', 'bogenschuetze', -8, 3), unit('player', 'magier', -9, -3), boss('kriegsherr', 0, 0)]);
    hold(b, 2, 3, 4);
    const w = b.units[4]!;
    only(w, 'slam');
    run(b, 1);
    const circles = area(b, 'slam');
    expect(circles).toHaveLength(3);
    run(b, seconds(BOSS_ACTIONS.slam.windup) + 2);
    for (const id of [2, 3, 4]) expect(b.units[id - 1]!.hp).toBeLessThan(b.units[id - 1]!.stats.maxHp);
  });

  it('calls raiders only once hurt, from his own edge, at most three of his at once', () => {
    const setup = battleSetupFor(newSquad('krieger', 'Aldric', SANDBOX_COMPANIONS), encounterById('ironWarlord'), 3);
    const b = createBattle(setup);
    b.countdown = 0;
    const w = b.units.find((u) => u.classId === 'kriegsherr')!;
    b.passiveEnemies = false;
    only(w, 'summon');
    const before = b.units.length;
    step(b, { ...emptyLike() }, DT);
    expect(w.action).not.toBe('summon'); // healthy: no call yet
    w.hp = w.stats.maxHp * 0.5;
    w.state = 'idle';
    w.action = null;
    only(w, 'summon');
    const events = run(b, seconds(BOSS_ACTIONS.summon.windup) + 2);
    const spawned = events.filter((e): e is Extract<BattleEvent, { type: 'spawn' }> => e.type === 'spawn');
    expect(spawned.map((e) => b.units[e.unitId - 1]!.classId).sort()).toEqual(['berserker', 'krieger']);
    expect(b.units.length).toBe(before + 2);
    const raider = b.units[before]!;
    expect(raider.summonerId).toBe(w.id);
    expect(raider.pos.x).toBeGreaterThan(15);
    expect(raider.stats.maxHp).toBeCloseTo(enemyReserves(encounterById('ironWarlord')).krieger!.maxHp);
  });
});

function emptyLike() {
  return { moveX: 0, moveZ: 0, aimAngle: 0, attack: false, dodge: false, ability1: false, ability2: false, leader: false, lock: false, unlock: false, mark: false };
}

describe('Fen Witch', () => {
  function witchBattle(): Battle {
    const b = battleWith([hero(-20, 10), unit('player', 'krieger', -6, 0), unit('player', 'magier', -9, 3), unit('enemy', 'berserker', 3, 2), boss('sumpfhexe', 6, 0)]);
    b.reserves = { wolf: { ...CLASS_STATS.wolf }, schamane: { ...CLASS_STATS.schamane } };
    return b;
  }

  it('poison: green circles under the nearest foes', () => {
    const b = witchBattle();
    hold(b, 2, 3, 4);
    const w = b.units[4]!;
    only(w, 'poison');
    run(b, 1);
    const circles = area(b, 'poison');
    expect(circles.length).toBeGreaterThanOrEqual(2);
    expect(circles.every((c) => c.damageType === 'magic')).toBe(true);
    run(b, seconds(BOSS_ACTIONS.poison.windup) + 2);
    expect(b.units[1]!.hp).toBeLessThan(b.units[1]!.stats.maxHp);
  });

  it('mend heals her hurt escort, not herself', () => {
    const b = witchBattle();
    hold(b, 2, 3, 4);
    const w = b.units[4]!;
    const escort = b.units[3]!;
    escort.hp = escort.stats.maxHp * 0.3;
    w.hp = w.stats.maxHp * 0.3;
    only(w, 'mend');
    run(b, seconds(BOSS_ACTIONS.mend.windup) + 2);
    expect(escort.hp).toBeGreaterThan(escort.stats.maxHp * 0.3);
    expect(w.hp).toBeCloseTo(w.stats.maxHp * 0.3);
  });

  it('calls three wolves, then a shaman', () => {
    const b = witchBattle();
    hold(b, 2, 3, 4);
    const w = b.units[4]!;
    w.hp = w.stats.maxHp * 0.5;
    only(w, 'summon');
    run(b, seconds(BOSS_ACTIONS.summon.windup + BOSS_ACTIONS.summon.recover) + 2);
    expect(b.units.slice(5).map((u) => u.classId)).toEqual(['wolf', 'wolf', 'wolf']);
    for (const u of b.units.slice(5)) u.hp = 0, (u.state = 'dead');
    only(w, 'summon');
    run(b, seconds(BOSS_ACTIONS.summon.windup + BOSS_ACTIONS.summon.recover) + 2);
    expect(b.units.slice(8).map((u) => u.classId)).toEqual(['schamane']);
  });
});

describe('Bone King', () => {
  it('raises fallen allies once each, at half health; never a boss', () => {
    const b = battleWith([hero(-20, 10), unit('enemy', 'krieger', 4, 2), unit('enemy', 'krieger', 4, -2), boss('knochenkoenig', 2, 0)]);
    const k = b.units[3]!;
    for (const u of [b.units[1]!, b.units[2]!]) {
      u.hp = 0;
      u.state = 'dead';
    }
    only(k, 'raise');
    const events = run(b, seconds(BOSS_ACTIONS.raise.windup) + 2);
    expect(events.filter((e) => e.type === 'raise')).toHaveLength(2);
    for (const u of [b.units[1]!, b.units[2]!]) {
      expect(u.state).not.toBe('dead');
      expect(u.hp).toBeCloseTo(u.stats.maxHp * BOSS_ACTIONS.raise.hp);
      expect(u.raised).toBe(true);
      u.hp = 0;
      u.state = 'dead';
    }
    only(k, 'raise');
    const again = run(b, seconds(BOSS_ACTIONS.raise.windup) + 2);
    expect(again.filter((e) => e.type === 'raise')).toHaveLength(0);
  });
});

describe('boss battles with the bot', () => {
  for (const id of ['ironWarlord', 'fenWitch', 'boneKing'] as const) {
    it(`${id}: deterministic replay`, () => {
      const play = () => {
        const setup = battleSetupFor(newSquad('krieger', 'Aldric', SANDBOX_COMPANIONS), encounterById(id), 11);
        const b = createBattle(setup);
        const bot = createBot();
        const kinds = new Set<string>();
        for (let i = 0; i < seconds(40) && b.outcome === 'running'; i++) {
          for (const e of step(b, botInput(b, bot), DT)) {
            if (e.type === 'action' || e.type === 'spawn' || e.type === 'raise') kinds.add(e.type === 'action' ? e.action : e.type);
          }
        }
        return { b, kinds };
      };
      const first = play();
      const second = play();
      expect(JSON.stringify(second.b)).toBe(JSON.stringify(first.b));
      expect(first.kinds.size).toBeGreaterThan(1);
    });
  }
});
