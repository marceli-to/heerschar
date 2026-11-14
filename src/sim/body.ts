import { BODY_RADIUS, BOSS_BODY, BOSSES, UNIT_RADIUS } from './balance';
import type { BossId, ClassId, Unit } from './types';

/** True for the region bosses (immune to stun and freeze, hard to push). */
export function isBossClass(classId: ClassId): classId is BossId {
  return (BOSSES as readonly ClassId[]).includes(classId);
}

export function isBoss(unit: Unit): boolean {
  return isBossClass(unit.classId);
}

/** The unit's body radius: for hits, separation and the arena bounds. */
export function bodyRadius(unit: Unit): number {
  return BODY_RADIUS[unit.classId] ?? UNIT_RADIUS;
}

/** Multiplier on knockback the unit receives. */
export function knockbackFactor(unit: Unit): number {
  return isBoss(unit) ? BOSS_BODY.knockback : 1;
}

/** How hard the unit is to push aside when bodies overlap. */
export function bodyMass(unit: Unit): number {
  return isBoss(unit) ? BOSS_BODY.mass : 1;
}
