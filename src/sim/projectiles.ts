import { ENERGY, HERO, HERO_SELF_HEAL } from './balance';
import { bodyRadius, isBoss } from './body';
import { addStatus } from './statuses';
import { applyDamage, applyHeal, computeDamage, gainEnergy, isAlive, isInvulnerable, push } from './combat';
import { range as rngRange } from './rng';
import { angleDiff, angleTo, clamp, dist, lerp, type Vec2 } from './math';
import type { AreaEffect, AreaKind, AreaShape, Battle, BattleEvent, DamageType, Projectile, ProjectileKind, Unit } from './types';

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
  /** The hero's basic attack: a hit gives energy. */
  basic?: boolean;
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
    basic: false,
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
  p.basic = shot.basic ?? false;
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
  /** Heals allies instead of damaging foes. */
  heal?: boolean;
  /** How often it resolves (default 1), `interval` seconds apart. */
  pulses?: number;
  interval?: number;
  /** Default circle. Arc and lane point along `angle`; an arc spans `arc`, a lane runs `length`. */
  shape?: AreaShape;
  angle?: number;
  arc?: number;
  length?: number;
  /** Knockback speed on those hit. */
  knockback?: number;
}

/** Places a telegraphed ground circle (radius scaled by the owner's `mods.area`, freezes lengthened by `mods.control`). */
export function placeArea(battle: Battle, owner: Unit, spec: AreaSpec, events: BattleEvent[]): AreaEffect {
  const a: AreaEffect = {
    id: battle.nextId++,
    kind: spec.kind,
    team: owner.team,
    ownerId: owner.id,
    pos: { x: spec.at.x, z: spec.at.z },
    shape: spec.shape ?? 'circle',
    angle: spec.angle ?? 0,
    arc: spec.arc ?? 0,
    length: spec.length ?? 0,
    radius: spec.radius * owner.mods.area,
    knockback: spec.knockback ?? 0,
    delay: spec.delay,
    time: 0,
    power: owner.stats.power,
    multiplier: spec.multiplier,
    damageType: spec.damageType,
    freeze: spec.freeze > 0 ? spec.freeze + owner.mods.control : 0,
    heal: spec.heal ?? false,
    pulses: spec.pulses ?? 1,
    interval: spec.interval ?? 0,
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

/** The first living foe of `team` touching a ball of `radius` at `pos`, in id order, skipping `exclude`. */
function foeAt(battle: Battle, team: Battle['units'][number]['team'], pos: Vec2, radius: number, exclude: number[]): Unit | null {
  for (const u of battle.units) {
    if (u.team === team || !isAlive(u) || exclude.includes(u.id)) continue;
    if (dist(u.pos, pos) <= radius + bodyRadius(u)) return u;
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
      const target = foeAt(battle, p.team, p.pos, p.radius, p.hitIds);
      if (!target) break;
      p.hitIds.push(target.id);
      if (isInvulnerable(target, INVULNERABLE)) {
        events.push({ type: 'evade', unitId: target.id });
        continue;
      }
      if (owner) {
        const died = applyDamage(owner, target, computeDamage(battle, p.power, p.multiplier, target, p.damageType, owner), p.pierce, events);
        if (p.basic && owner.isHero) gainEnergy(owner, ENERGY.perBasicHit);
        if (!died && owner.mods.slowOnHit > 0 && (p.kind === 'arrow' || p.kind === 'piercing')) addStatus(target, 'slowed', owner.mods.slowOnHit, events, 0, owner.id);
      }
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
    events.push({ type: 'areaResolve', areaId: a.id, kind: a.kind, ownerId: a.ownerId, x: a.pos.x, z: a.pos.z, radius: a.radius, angle: a.angle });
    const owner = ownerOf(battle, a.ownerId);
    if (a.pulses > 1) {
      a.pulses--;
      a.delay += a.interval;
      keep.push(a);
    }
    if (a.heal) {
      if (owner) healInside(battle, owner, a, events);
      continue;
    }
    // A warning only (the boss charge lane): its owner deals the damage itself.
    if (a.multiplier <= 0 && a.freeze <= 0) continue;
    for (const u of battle.units) {
      if (u.team === a.team || !isAlive(u) || !insideArea(a, u.pos, bodyRadius(u))) continue;
      if (isInvulnerable(u, INVULNERABLE)) {
        events.push({ type: 'evade', unitId: u.id });
        continue;
      }
      if (a.knockback > 0) push(u, knockbackAngle(a, u.pos), a.knockback);
      if (a.multiplier > 0 && owner) {
        // Freeze after the damage, so the +50% physical bonus does not apply to the nova itself.
        if (applyDamage(owner, u, computeDamage(battle, a.power, a.multiplier, u, a.damageType, owner), true, events)) continue;
      }
      if (a.freeze > 0) freeze(u, a.freeze, events);
    }
  }
  battle.areas = keep;
}

/** One pulse of a healing area on every ally inside. The hero heals himself at reduced strength. */
function healInside(battle: Battle, owner: Unit, a: AreaEffect, events: BattleEvent[]): void {
  for (const u of battle.units) {
    if (u.team !== a.team || !isAlive(u) || !insideArea(a, u.pos, bodyRadius(u))) continue;
    const self = u === owner && owner.isHero ? HERO_SELF_HEAL : 1;
    applyHeal(owner, u, a.power * a.multiplier * self * rngRange(battle, 0.9, 1.1), events);
  }
}

/**
 * Whether a body of radius `r` at `pos` touches the area: within the circle, inside the arc's
 * slice, or within the lane's strip.
 */
export function insideArea(a: AreaEffect, pos: Vec2, r: number): boolean {
  const d = dist(a.pos, pos);
  switch (a.shape) {
    case 'circle':
      return d <= a.radius + r;
    case 'arc':
      if (d > a.radius + r) return false;
      // Bodies standing on the centre are always inside; otherwise allow the body's width at the edge.
      if (d <= r) return true;
      return Math.abs(angleDiff(a.angle, angleTo(a.pos, pos))) <= a.arc / 2 + Math.asin(Math.min(1, r / d));
    case 'lane': {
      const dx = pos.x - a.pos.x;
      const dz = pos.z - a.pos.z;
      const along = dx * Math.sin(a.angle) - dz * Math.cos(a.angle);
      const across = Math.abs(dx * Math.cos(a.angle) + dz * Math.sin(a.angle));
      return along >= -r && along <= a.length + r && across <= a.radius + r;
    }
  }
}

/** Which way an area throws those it hits: away from the centre, or sideways out of a lane. */
function knockbackAngle(a: AreaEffect, pos: Vec2): number {
  if (a.shape !== 'lane') return dist(a.pos, pos) > 1e-6 ? angleTo(a.pos, pos) : a.angle;
  const side = (pos.x - a.pos.x) * Math.cos(a.angle) + (pos.z - a.pos.z) * Math.sin(a.angle);
  return a.angle + (side >= 0 ? Math.PI / 2 : -Math.PI / 2);
}

/** Freezes a unit: it cannot act, and any windup is lost. Bosses are immune. */
export function freeze(unit: Unit, duration: number, events: BattleEvent[]): void {
  if (!isAlive(unit) || isBoss(unit)) return;
  if (unit.state === 'windup' || unit.state === 'recover') {
    unit.state = 'idle';
    unit.stateTime = 0;
    unit.action = null;
    unit.chain = 0;
    unit.chainQueued = false;
  }
  addStatus(unit, 'frozen', duration, events);
}
