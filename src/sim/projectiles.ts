import { HERO, UNIT_RADIUS } from './balance';
import { addStatus } from './statuses';
import { applyDamage, computeDamage, isAlive, isInvulnerable } from './combat';
import { clamp, dist, lerp, type Vec2 } from './math';
import type { AreaEffect, AreaKind, Battle, BattleEvent, DamageType, Projectile, ProjectileKind, Unit } from './types';

const INVULNERABLE = HERO.dodge.invulnerable;

export interface StraightShot {
  kind: ProjectileKind;
  /** Where it flies: the target's position at release (so a moving target can sidestep). */
  at: Vec2;
  speed: number;
  radius: number;
  range: number;
  multiplier: number;
  damageType: DamageType;
  pierce: boolean;
}

function blankProjectile(battle: Battle, owner: Unit, kind: ProjectileKind): Projectile {
  return {
    id: battle.nextId++,
    kind,
    team: owner.team,
    ownerId: owner.id,
    pos: { x: owner.pos.x, z: owner.pos.z },
    arc: false,
    dir: { x: 0, z: 0 },
    speed: 0,
    radius: 0,
    rangeLeft: 0,
    power: owner.stats.power,
    multiplier: 0,
    damageType: 'physical',
    pierce: false,
    hitIds: [],
    from: { x: owner.pos.x, z: owner.pos.z },
    to: { x: owner.pos.x, z: owner.pos.z },
    time: 0,
    duration: 0,
    areaId: null,
  };
}

/** Launches a straight projectile from `owner` towards a point. */
export function fireStraight(battle: Battle, owner: Unit, shot: StraightShot, events: BattleEvent[]): Projectile {
  const p = blankProjectile(battle, owner, shot.kind);
  const dx = shot.at.x - owner.pos.x;
  const dz = shot.at.z - owner.pos.z;
  const len = Math.hypot(dx, dz);
  p.dir = len > 1e-6 ? { x: dx / len, z: dz / len } : { x: Math.sin(owner.facing), z: -Math.cos(owner.facing) };
  p.speed = shot.speed;
  p.radius = shot.radius;
  p.rangeLeft = shot.range;
  p.multiplier = shot.multiplier;
  p.damageType = shot.damageType;
  p.pierce = shot.pierce;
  battle.projectiles.push(p);
  events.push({ type: 'shoot', projectileId: p.id, kind: p.kind });
  return p;
}

export interface AreaSpec {
  kind: AreaKind;
  at: Vec2;
  radius: number;
  delay: number;
  multiplier: number;
  damageType: DamageType;
  freeze: number;
}

/** Places a telegraphed ground circle. */
export function placeArea(battle: Battle, owner: Unit, spec: AreaSpec, events: BattleEvent[]): AreaEffect {
  const a: AreaEffect = {
    id: battle.nextId++,
    kind: spec.kind,
    team: owner.team,
    ownerId: owner.id,
    pos: { x: spec.at.x, z: spec.at.z },
    radius: spec.radius,
    delay: spec.delay,
    time: 0,
    power: owner.stats.power,
    multiplier: spec.multiplier,
    damageType: spec.damageType,
    freeze: spec.freeze,
  };
  battle.areas.push(a);
  events.push({ type: 'areaStart', areaId: a.id, kind: a.kind });
  return a;
}

/**
 * Lobs an arcing projectile at a point. The damage is an area placed at the landing point
 * right away, so the ground warning shows for the whole flight.
 */
export function lob(battle: Battle, owner: Unit, kind: ProjectileKind, at: Vec2, speed: number, minFlight: number, maxFlight: number, area: Omit<AreaSpec, 'at' | 'delay'>, events: BattleEvent[]): Projectile {
  const duration = clamp(dist(owner.pos, at) / speed, minFlight, maxFlight);
  const zone = placeArea(battle, owner, { ...area, at, delay: duration }, events);
  const p = blankProjectile(battle, owner, kind);
  p.arc = true;
  p.to = { x: at.x, z: at.z };
  p.duration = duration;
  p.multiplier = area.multiplier;
  p.damageType = area.damageType;
  p.areaId = zone.id;
  battle.projectiles.push(p);
  events.push({ type: 'shoot', projectileId: p.id, kind: p.kind });
  return p;
}

function ownerOf(battle: Battle, id: number): Unit | undefined {
  return battle.units.find((u) => u.id === id);
}

/** The first living foe of `team` within `reach` of `pos`, in id order, skipping `exclude`. */
function foeAt(battle: Battle, team: Battle['units'][number]['team'], pos: Vec2, reach: number, exclude: number[]): Unit | null {
  for (const u of battle.units) {
    if (u.team === team || !isAlive(u) || exclude.includes(u.id)) continue;
    if (dist(u.pos, pos) <= reach) return u;
  }
  return null;
}

/** Moves projectiles and resolves their hits. Owners that died meanwhile still deal damage. */
export function updateProjectiles(battle: Battle, dt: number, events: BattleEvent[]): void {
  const keep: Projectile[] = [];
  for (const p of battle.projectiles) {
    if (p.arc) {
      p.time += dt;
      const t = Math.min(1, p.time / p.duration);
      p.pos.x = lerp(p.from.x, p.to.x, t);
      p.pos.z = lerp(p.from.z, p.to.z, t);
      if (t < 1) keep.push(p);
      continue;
    }
    const stepLen = p.speed * dt;
    p.pos.x += p.dir.x * stepLen;
    p.pos.z += p.dir.z * stepLen;
    p.rangeLeft -= stepLen;
    let spent = false;
    const owner = ownerOf(battle, p.ownerId);
    for (;;) {
      const target = foeAt(battle, p.team, p.pos, p.radius + UNIT_RADIUS, p.hitIds);
      if (!target) break;
      p.hitIds.push(target.id);
      if (isInvulnerable(target, INVULNERABLE)) {
        events.push({ type: 'evade', unitId: target.id });
        continue;
      }
      if (owner) applyDamage(owner, target, computeDamage(battle, p.power, p.multiplier, target, p.damageType), p.pierce, events);
      if (!p.pierce) {
        spent = true;
        break;
      }
    }
    if (!spent && p.rangeLeft > 0) keep.push(p);
  }
  battle.projectiles = keep;
}

/** Counts area timers down and resolves those that are due on every foe inside. */
export function updateAreas(battle: Battle, dt: number, events: BattleEvent[]): void {
  const keep: AreaEffect[] = [];
  for (const a of battle.areas) {
    a.time += dt;
    if (a.time < a.delay) {
      keep.push(a);
      continue;
    }
    events.push({ type: 'areaResolve', areaId: a.id, kind: a.kind, x: a.pos.x, z: a.pos.z, radius: a.radius });
    const owner = ownerOf(battle, a.ownerId);
    for (const u of battle.units) {
      if (u.team === a.team || !isAlive(u) || dist(u.pos, a.pos) > a.radius + UNIT_RADIUS) continue;
      if (isInvulnerable(u, INVULNERABLE)) {
        events.push({ type: 'evade', unitId: u.id });
        continue;
      }
      if (a.multiplier > 0 && owner) {
        // Freeze after the damage, so the +50% physical bonus does not apply to the nova itself.
        if (applyDamage(owner, u, computeDamage(battle, a.power, a.multiplier, u, a.damageType), true, events)) continue;
      }
      if (a.freeze > 0) freeze(u, a.freeze, events);
    }
  }
  battle.areas = keep;
}

/** Freezes a unit: it cannot act, and any windup is lost. */
export function freeze(unit: Unit, duration: number, events: BattleEvent[]): void {
  if (!isAlive(unit)) return;
  if (unit.state === 'windup' || unit.state === 'recover') {
    unit.state = 'idle';
    unit.stateTime = 0;
    unit.action = null;
    unit.chain = 0;
    unit.chainQueued = false;
  }
  addStatus(unit, 'frozen', duration, events);
}
