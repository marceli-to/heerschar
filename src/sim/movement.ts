import { BOUNDS_STRENGTH, KNOCKBACK_FRICTION, SEPARATION_STRENGTH } from './balance';
import { bodyMass, bodyRadius } from './body';
import { angleDiff, clamp } from './math';
import type { Battle, Unit } from './types';

/** Turns `unit` towards `angle` by at most `rate * dt`. */
export function turnTowards(unit: Unit, angle: number, rate: number, dt: number): void {
  const d = angleDiff(unit.facing, angle);
  const max = rate * dt;
  unit.facing += clamp(d, -max, max);
}

/** Moves `unit` along a direction (length <= 1) at `speed`. */
export function moveDir(unit: Unit, dx: number, dz: number, speed: number, dt: number): void {
  unit.pos.x += dx * speed * dt;
  unit.pos.z += dz * speed * dt;
}

/** Knockback integration with friction. Skipped while the unit is in hit-stop. */
export function applyKnockback(unit: Unit, dt: number): void {
  if (unit.vel.x === 0 && unit.vel.z === 0) return;
  unit.pos.x += unit.vel.x * dt;
  unit.pos.z += unit.vel.z * dt;
  const f = Math.exp(-KNOCKBACK_FRICTION * dt);
  unit.vel.x *= f;
  unit.vel.z *= f;
  if (Math.abs(unit.vel.x) < 0.01 && Math.abs(unit.vel.z) < 0.01) {
    unit.vel.x = 0;
    unit.vel.z = 0;
  }
}

function solid(u: Unit): boolean {
  // Dodging units slip through others: rolling past an enemy is part of the move. So does a
  // charging boss (it hits whoever it passes instead).
  if (u.state === 'recover' && u.action === 'charge') return false;
  return u.state !== 'dead' && u.state !== 'dodging';
}

/**
 * Pushes overlapping units apart, the heavier one (bosses) moving less. Iterates in id order so
 * the result is deterministic.
 */
export function separate(battle: Battle): void {
  const units = battle.units;
  for (let i = 0; i < units.length; i++) {
    const a = units[i]!;
    if (!solid(a)) continue;
    for (let j = i + 1; j < units.length; j++) {
      const b = units[j]!;
      if (!solid(b)) continue;
      const minDist = bodyRadius(a) + bodyRadius(b);
      let dx = b.pos.x - a.pos.x;
      let dz = b.pos.z - a.pos.z;
      const d2 = dx * dx + dz * dz;
      if (d2 >= minDist * minDist) continue;
      let d = Math.sqrt(d2);
      if (d < 1e-6) {
        // Exactly on top of each other: split along x by id order.
        dx = 1;
        dz = 0;
        d = 1;
      }
      const push = (minDist - Math.min(d, minDist)) * SEPARATION_STRENGTH;
      const ma = bodyMass(a);
      const mb = bodyMass(b);
      // Equal masses split the push in half, as before.
      const pa = (push * mb) / (ma + mb);
      const pb = (push * ma) / (ma + mb);
      const nx = dx / d;
      const nz = dz / d;
      a.pos.x -= nx * pa;
      a.pos.z -= nz * pa;
      b.pos.x += nx * pb;
      b.pos.z += nz * pb;
    }
  }
}

/** Soft elliptical bounds: units past the edge are pushed back in a little each tick. */
export function keepInBounds(battle: Battle, unit: Unit): void {
  const rx = battle.arena.width / 2 - bodyRadius(unit);
  const rz = battle.arena.depth / 2 - bodyRadius(unit);
  const e = Math.hypot(unit.pos.x / rx, unit.pos.z / rz);
  if (e <= 1) return;
  const k = 1 - ((e - 1) / e) * BOUNDS_STRENGTH;
  unit.pos.x *= k;
  unit.pos.z *= k;
  // A knockback into the wall stops there.
  unit.vel.x *= 0.5;
  unit.vel.z *= 0.5;
}
