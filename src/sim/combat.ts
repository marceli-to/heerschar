import { DAMAGE_VARIANCE, STAGGER_IMMUNITY, UNIT_RADIUS, type MeleeAttack } from './balance';
import { angleDiff, angleTo, dist } from './math';
import { range } from './rng';
import type { Battle, BattleEvent, DamageType, Unit } from './types';

export function isAlive(u: Unit): boolean {
  return u.state !== 'dead';
}

export function isInvulnerable(u: Unit, invulnerableTime: number): boolean {
  return u.state === 'dodging' && u.stateTime < invulnerableTime;
}

/** `power × multiplier × 100 / (100 + armor or resist)`, ±variance from the battle RNG. */
export function computeDamage(battle: Battle, power: number, multiplier: number, target: Unit, type: DamageType): number {
  const defence = type === 'physical' ? target.stats.armor : target.stats.resist;
  const base = (power * multiplier * 100) / (100 + defence);
  return base * range(battle, 1 - DAMAGE_VARIANCE, 1 + DAMAGE_VARIANCE);
}

/** True when `target` lies inside the attack's arc in front of `attacker`. */
export function inArc(attacker: Unit, target: Unit, attack: MeleeAttack): boolean {
  if (dist(attacker.pos, target.pos) > attack.reach + UNIT_RADIUS) return false;
  return Math.abs(angleDiff(attacker.facing, angleTo(attacker.pos, target.pos))) <= attack.arc / 2;
}

/** Poise rules: see STAGGER_IMMUNITY. */
export function canStagger(target: Unit, attack: MeleeAttack): boolean {
  if (attack.stagger <= 0 || target.staggerImmunity > 0) return false;
  if (target.state === 'windup' && !attack.heavy) return false;
  return true;
}

export interface MeleeOptions {
  /** Seconds of dodge invulnerability, to tell evades from hits. */
  invulnerableTime: number;
}

/**
 * Resolves a melee attack at its hit moment: every living enemy in the arc is hit.
 * Returns how many units were hit.
 */
export function resolveMelee(battle: Battle, attacker: Unit, attack: MeleeAttack, opts: MeleeOptions, events: BattleEvent[]): number {
  let hits = 0;
  for (const target of battle.units) {
    if (target.team === attacker.team || !isAlive(target) || !inArc(attacker, target, attack)) continue;
    if (isInvulnerable(target, opts.invulnerableTime)) {
      events.push({ type: 'evade', unitId: target.id });
      continue;
    }
    hits++;
    const amount = computeDamage(battle, attacker.stats.power, attack.multiplier, target, 'physical');
    target.hp = Math.max(0, target.hp - amount);
    events.push({ type: 'hit', attackerId: attacker.id, targetId: target.id, amount, heavy: attack.heavy, x: target.pos.x, z: target.pos.z });

    const away = angleTo(attacker.pos, target.pos);
    target.vel.x += Math.sin(away) * attack.knockback;
    target.vel.z += -Math.cos(away) * attack.knockback;
    target.hitstop = Math.max(target.hitstop, attack.hitstop);

    if (target.hp <= 0) {
      target.state = 'dead';
      target.stateTime = 0;
      events.push({ type: 'death', unitId: target.id });
    } else if (canStagger(target, attack)) {
      target.state = 'stunned';
      target.stateTime = 0;
      target.stunDuration = attack.stagger;
      target.staggerImmunity = STAGGER_IMMUNITY;
    }
  }
  if (hits > 0) attacker.hitstop = Math.max(attacker.hitstop, attack.hitstop);
  return hits;
}
