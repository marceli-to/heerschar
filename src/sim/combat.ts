import { CRIT_MULTIPLIER, DAMAGE_VARIANCE, ENERGY, STAGGER_IMMUNITY, STATUS, type MeleeAttack } from './balance';
import { bodyRadius, isBoss, knockbackFactor } from './body';
import { clamp } from './math';
import { angleDiff, angleTo, dist } from './math';
import { nextFloat, range } from './rng';
import { getStatus, hasStatus, removeStatus } from './statuses';
import type { Battle, BattleEvent, DamageType, Unit } from './types';

export function isAlive(u: Unit): boolean {
  return u.state !== 'dead';
}

export function isInvulnerable(u: Unit, invulnerableTime: number): boolean {
  return u.state === 'dodging' && u.stateTime < invulnerableTime;
}

/**
 * `power × multiplier × 100 / (100 + armor or resist)`, ±variance from the battle RNG,
 * then +50% physical on frozen targets and +15% on the marked target, then the dealer's and
 * the target's mods (a crit roll only when the dealer has a crit chance, so plain battles draw
 * the same random numbers as before).
 */
export function computeDamage(battle: Battle, power: number, multiplier: number, target: Unit, type: DamageType, source?: Unit): number {
  const defence = type === 'physical' ? target.stats.armor : target.stats.resist;
  let amount = ((power * multiplier * 100) / (100 + defence)) * range(battle, 1 - DAMAGE_VARIANCE, 1 + DAMAGE_VARIANCE);
  if (type === 'physical' && hasStatus(target, 'frozen')) amount *= STATUS.frozenPhysical;
  if (battle.markTargetId === target.id) amount *= STATUS.marked;
  if (source) {
    amount *= source.mods.damage;
    if (source.mods.crit > 0 && nextFloat(battle) < source.mods.crit) amount *= CRIT_MULTIPLIER;
  }
  return amount * target.mods.damageTaken;
}

export function kill(unit: Unit, events: BattleEvent[]): void {
  unit.state = 'dead';
  unit.stateTime = 0;
  unit.action = null;
  unit.statuses = [];
  events.push({ type: 'death', unitId: unit.id });
}

/**
 * Deals already computed damage: a shield absorbs first, then health. Emits the hit and,
 * when the target falls, its death. Returns true if the target died.
 */
export function applyDamage(attacker: Unit, target: Unit, amount: number, heavy: boolean, events: BattleEvent[]): boolean {
  let absorbed = 0;
  const shield = getStatus(target, 'shielded');
  if (shield) {
    absorbed = Math.min(shield.amount, amount);
    shield.amount -= absorbed;
    if (shield.amount <= 0) removeStatus(target, 'shielded', events);
  }
  const dealt = Math.min(target.hp, amount - absorbed);
  target.hp -= dealt;
  events.push({ type: 'hit', attackerId: attacker.id, targetId: target.id, amount: dealt, absorbed, heavy, x: target.pos.x, z: target.pos.z });
  if (attacker.mods.lifesteal > 0 && dealt > 0 && attacker !== target) restore(attacker, attacker, dealt * attacker.mods.lifesteal, events);
  if (target.hp <= 0) {
    target.hp = 0;
    kill(target, events);
    return true;
  }
  return false;
}

function restore(source: Unit, target: Unit, amount: number, events: BattleEvent[]): void {
  if (!isAlive(target)) return;
  const restored = Math.min(amount, target.stats.maxHp - target.hp);
  target.hp += restored;
  events.push({ type: 'heal', sourceId: source.id, targetId: target.id, amount: restored, x: target.pos.x, z: target.pos.z });
}

/**
 * Restores health up to the maximum, scaled by the healer's `mods.healing`. Emits the heal
 * with the amount actually restored.
 */
export function applyHeal(source: Unit, target: Unit, amount: number, events: BattleEvent[]): void {
  restore(source, target, amount * source.mods.healing, events);
}

/** Puts a unit into the stunned state; any windup in progress is lost. Bosses are immune. */
export function stun(unit: Unit, duration: number): void {
  if (!isAlive(unit) || isBoss(unit)) return;
  unit.state = 'stunned';
  unit.stateTime = 0;
  unit.stunDuration = duration;
  unit.action = null;
}

/** True when `target` lies inside the attack's arc in front of `attacker`. */
export function inArc(attacker: Unit, target: Unit, attack: MeleeAttack): boolean {
  if (dist(attacker.pos, target.pos) > attack.reach + bodyRadius(target)) return false;
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
  /** A stun ability: stuns for `attack.stagger` regardless of poise, and grants no immunity. */
  stun?: boolean;
}

/** Knockback along a facing angle (bosses barely move). */
export function push(target: Unit, angle: number, speed: number): void {
  const k = speed * knockbackFactor(target);
  target.vel.x += Math.sin(angle) * k;
  target.vel.z += -Math.cos(angle) * k;
}

/** Hero energy, kept within 0..max. */
export function gainEnergy(unit: Unit, amount: number): void {
  unit.energy = clamp(unit.energy + amount, 0, ENERGY.max);
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
    const amount = computeDamage(battle, attacker.stats.power, attack.multiplier, target, 'physical', attacker);
    push(target, angleTo(attacker.pos, target.pos), attack.knockback);
    target.hitstop = Math.max(target.hitstop, attack.hitstop);

    if (applyDamage(attacker, target, amount, attack.heavy, events)) continue;
    if (opts.stun) {
      stun(target, attack.stagger + attacker.mods.control);
    } else if (canStagger(target, attack) && !hasStatus(target, 'frozen')) {
      stun(target, attack.stagger);
      target.staggerImmunity = STAGGER_IMMUNITY;
    }
  }
  if (hits > 0) attacker.hitstop = Math.max(attacker.hitstop, attack.hitstop);
  return hits;
}
