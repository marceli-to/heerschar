import { ACTIONS, BEHAVIOUR, BOSS_ACTIONS, BOSS_STRIKE, ENEMY, HERO, heroAttack, SUMMONS, type MeleeAttack } from './balance';
import { bodyRadius, isBoss } from './body';
import { applyDamage, applyHeal, computeDamage, isAlive, isInvulnerable, push, resolveMelee, stun } from './combat';
import { angleDiff, angleTo, clamp, dist } from './math';
import { moveDir, turnTowards } from './movement';
import { fireStraight, lob, placeArea } from './projectiles';
import { range } from './rng';
import { addStatus, getStatus, guardAndRally, hasStatus, moveFactor, speedFactor } from './statuses';
import { heroActionTiming } from './heroAbilities';
import { createUnit } from './units';
import type { AbilityId, AiActionId, Battle, BattleEvent, ClassId, Unit } from './types';

const OPTS = { invulnerableTime: HERO.dodge.invulnerable };
type BossActionId = keyof typeof BOSS_ACTIONS;
/** Boss actions whose warning is fixed at the start: the boss does not turn while winding up. */
const FIXED_AIM: readonly AiActionId[] = ['sweep', 'charge', 'slam'];
/** Units must face their target within this angle before they start an attack. */
const AIM_TOLERANCE = 0.5;
const BACK_ROW: readonly ClassId[] = ['bogenschuetze', 'heiler', 'magier', 'schamane'];
/** Healers: what a Berserker goes for first. */
const HEALERS: readonly ClassId[] = ['heiler', 'schamane'];
type AiAbilityId = Extract<AbilityId, AiActionId>;
const ABILITIES: readonly AiAbilityId[] = ['taunt', 'pierce', 'groupHeal', 'frostNova', 'ward', 'sweep', 'charge', 'slam', 'poison', 'summon', 'mend', 'raise'];

function isAbility(action: AiActionId): action is AiAbilityId {
  return (ABILITIES as readonly string[]).includes(action);
}

function isBossAction(action: AiActionId): action is BossActionId {
  return action in BOSS_ACTIONS;
}

function cooldownOf(action: AiAbilityId): number {
  return isBossAction(action) ? (BOSS_ACTIONS[action] as { cooldown: number }).cooldown : (ACTIONS[action] as { cooldown: number }).cooldown;
}

/** The AI action of a non-hero unit (`null` = none or a basic strike). */
function aiAction(unit: Unit): AiActionId | null {
  return unit.isHero ? null : (unit.action as AiActionId | null);
}

/** Windup and recover of what a unit is doing, for the sim and for posing the view. */
export function actionTiming(unit: Unit): { windup: number; recover: number } {
  if (unit.isHero) return heroActionTiming(unit);
  const action = aiAction(unit);
  if (action === null || action === 'strike') return meleeAttackOf(unit);
  return isBossAction(action) ? BOSS_ACTIONS[action] : ACTIONS[action];
}

/** The melee attack a unit swings (hero chain step, a boss's swing or the AI strike). */
export function meleeAttackOf(unit: Unit): MeleeAttack {
  if (unit.isHero) return heroAttack(unit.chain);
  return isBoss(unit) ? BOSS_STRIKE : ENEMY.attack;
}

function byId(battle: Battle, id: number | null): Unit | null {
  if (id === null) return null;
  return battle.units.find((u) => u.id === id) ?? null;
}

function livingFoes(battle: Battle, unit: Unit): Unit[] {
  return battle.units.filter((u) => u.team !== unit.team && isAlive(u));
}

function livingAllies(battle: Battle, unit: Unit): Unit[] {
  return battle.units.filter((u) => u.team === unit.team && isAlive(u));
}

function nearest(unit: Unit, list: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of list) {
    const d = dist(unit.pos, u.pos);
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}

/** How many units of the same team are mid-strike on `targetId`. */
function strikersOn(battle: Battle, unit: Unit, targetId: number): number {
  let n = 0;
  for (const u of battle.units) {
    if (u === unit || u.team !== unit.team || u.targetId !== targetId || u.action !== 'strike') continue;
    if (u.state === 'windup' || u.state === 'recover') n++;
  }
  return n;
}

function setState(unit: Unit, state: Unit['state']): void {
  if (unit.state === state) return;
  unit.state = state;
  unit.stateTime = 0;
}

function startAction(unit: Unit, action: AiActionId, target: Unit | null, events: BattleEvent[]): void {
  unit.action = action;
  if (target) unit.targetId = target.id;
  setState(unit, 'windup');
  if (isAbility(action)) unit.abilityCooldowns[action] = cooldownOf(action) * unit.mods.cooldown;
  if (action === 'strike') events.push({ type: 'attackStart', unitId: unit.id, chain: 0 });
  else events.push({ type: 'action', unitId: unit.id, action });
}

function abilityReady(unit: Unit, ability: AbilityId): boolean {
  return (unit.abilityCooldowns[ability] ?? 0) <= 0;
}

function speedOf(unit: Unit): number {
  return unit.stats.moveSpeed * moveFactor(unit);
}

function moveTowards(unit: Unit, to: Unit['pos'], speed: number, dt: number): void {
  const a = angleTo(unit.pos, to);
  moveDir(unit, Math.sin(a), -Math.cos(a), speed, dt);
  setState(unit, 'moving');
}

function moveAway(unit: Unit, from: Unit['pos'], speed: number, dt: number): void {
  const a = angleTo(from, unit.pos);
  moveDir(unit, Math.sin(a), -Math.cos(a), speed, dt);
  setState(unit, 'moving');
}

function facing(unit: Unit, target: Unit): boolean {
  return Math.abs(angleDiff(unit.facing, angleTo(unit.pos, target.pos))) < AIM_TOLERANCE;
}

/** A target the unit must take: its taunter, or (player side) the hero's mark when in reach. */
function forcedTarget(battle: Battle, unit: Unit, reach: number): Unit | null {
  const taunt = getStatus(unit, 'taunted');
  const taunter = taunt ? byId(battle, taunt.sourceId) : null;
  if (taunter && isAlive(taunter)) return taunter;
  if (unit.team !== 'player') return null;
  const mark = byId(battle, battle.markTargetId);
  if (mark && isAlive(mark) && mark.team !== unit.team && dist(unit.pos, mark.pos) <= reach) return mark;
  return null;
}

// ---------------------------------------------------------------------------------------------
// Action resolution

function release(battle: Battle, unit: Unit, events: BattleEvent[]): void {
  const target = byId(battle, unit.targetId);
  const live = target && isAlive(target) ? target : null;
  const shotRange = unit.stats.range * BEHAVIOUR.projectileRangeFactor;
  const action = aiAction(unit);
  switch (action) {
    case null:
    case 'strike':
      events.push({ type: 'swing', unitId: unit.id, chain: 0 });
      resolveMelee(battle, unit, meleeAttackOf(unit), OPTS, events);
      return;
    case 'taunt': {
      const t = ACTIONS.taunt;
      for (const f of livingFoes(battle, unit)) {
        if (f.isHero || dist(f.pos, unit.pos) > t.radius) continue;
        addStatus(f, 'taunted', t.duration + unit.mods.control, events, 0, unit.id);
        f.targetId = unit.id;
      }
      guardAndRally(unit, events);
      return;
    }
    case 'shot':
    case 'pierce':
    case 'bolt': {
      if (!live) return;
      const a = ACTIONS[action];
      fireStraight(
        battle,
        unit,
        {
          kind: action === 'shot' ? 'arrow' : action === 'pierce' ? 'piercing' : 'bolt',
          at: live.pos,
          speed: a.speed,
          radius: a.radius,
          range: shotRange,
          multiplier: a.multiplier,
          damageType: action === 'bolt' ? 'magic' : 'physical',
          pierce: action === 'pierce',
        },
        events,
      );
      return;
    }
    case 'heal':
      if (live) applyHeal(unit, live, healAmount(battle, unit, ACTIONS.heal.multiplier), events);
      return;
    case 'groupHeal': {
      const g = ACTIONS.groupHeal;
      for (const a of livingAllies(battle, unit)) {
        if (dist(a.pos, unit.pos) <= g.radius) applyHeal(unit, a, healAmount(battle, unit, g.multiplier), events);
      }
      return;
    }
    case 'fireball': {
      if (!live) return;
      const f = ACTIONS.fireball;
      lob(battle, unit, 'fireball', live.pos, f.speed, f.minFlight, f.maxFlight, { kind: 'fireball', radius: f.radius, multiplier: f.multiplier, damageType: 'magic', freeze: 0 }, events);
      return;
    }
    case 'frostNova': {
      const n = ACTIONS.frostNova;
      placeArea(battle, unit, { kind: 'frostNova', at: unit.pos, radius: n.radius, delay: n.delay, multiplier: n.multiplier, damageType: 'magic', freeze: n.freeze }, events);
      return;
    }
    case 'ward': {
      const w = ACTIONS.ward;
      if (live && live.team === unit.team) addStatus(live, 'shielded', w.duration, events, unit.stats.power * w.shield * unit.mods.healing, unit.id);
      return;
    }
    // Sweep, slam and poison are their ground warnings, which resolve on their own.
    case 'sweep':
    case 'slam':
    case 'poison':
      return;
    case 'charge':
      unit.hitIds = [];
      return;
    case 'hex': {
      if (!live) return;
      const h = BOSS_ACTIONS.hex;
      fireStraight(battle, unit, { kind: 'hex', at: live.pos, speed: h.speed, radius: h.radius, range: shotRange, multiplier: h.multiplier, damageType: 'magic', pierce: false }, events);
      return;
    }
    case 'summon':
      summon(battle, unit, events);
      return;
    case 'mend':
      for (const a of mendTargets(battle, unit)) applyHeal(unit, a, healAmount(battle, unit, BOSS_ACTIONS.mend.multiplier), events);
      return;
    case 'raise':
      for (const c of raisable(battle, unit).slice(0, BOSS_ACTIONS.raise.count)) {
        c.state = 'idle';
        c.stateTime = 0;
        c.hp = c.stats.maxHp * BOSS_ACTIONS.raise.hp;
        c.raised = true;
        c.targetId = null;
        c.attackCooldown = 1;
        c.hitstop = 0;
        c.vel = { x: 0, z: 0 };
        events.push({ type: 'raise', unitId: c.id, sourceId: unit.id });
      }
      return;
  }
}

function healAmount(battle: Battle, unit: Unit, multiplier: number): number {
  return unit.stats.power * multiplier * range(battle, 0.9, 1.1);
}

// ---------------------------------------------------------------------------------------------
// Class brains: pick what to do when idle or moving.

/** Krieger: taunt crowds, intercept foes heading for the back row, else the nearest foe. */
function kriegerBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  if (abilityReady(unit, 'taunt')) {
    const near = foes.filter((f) => !f.isHero && dist(f.pos, unit.pos) <= ACTIONS.taunt.radius);
    if (near.length >= BEHAVIOUR.tauntMinFoes) {
      startAction(unit, 'taunt', null, events);
      return;
    }
  }
  const target = forcedTarget(battle, unit, BEHAVIOUR.interceptRange) ?? interceptTarget(battle, unit, foes) ?? nearest(unit, foes);
  meleeEngage(battle, unit, target, dt, events);
}

/** The foe closest to `unit` that is going for one of its back-row allies. */
function interceptTarget(battle: Battle, unit: Unit, foes: Unit[]): Unit | null {
  const threats = foes.filter((f) => {
    const victim = byId(battle, f.targetId);
    if (!victim || victim.team !== unit.team || victim.isHero || !BACK_ROW.includes(victim.classId)) return false;
    return dist(unit.pos, f.pos) <= BEHAVIOUR.interceptRange;
  });
  return nearest(unit, threats);
}

/**
 * Close in, wind up visibly, swing; when two allies already strike the target, circle and wait
 * (unless `ignoreCap`).
 */
function meleeEngage(battle: Battle, unit: Unit, target: Unit | null, dt: number, events: BattleEvent[], ignoreCap = false): void {
  if (!target) {
    unit.targetId = null;
    setState(unit, 'idle');
    return;
  }
  unit.targetId = target.id;
  const d = dist(unit.pos, target.pos);
  const toTarget = angleTo(unit.pos, target.pos);
  turnTowards(unit, toTarget, ENEMY.turnRate, dt);
  const dir = { x: Math.sin(toTarget), z: -Math.cos(toTarget) };
  const speed = speedOf(unit);
  // The swing reaches the target's body, so big targets (bosses) can be hit from farther away.
  const engage = (meleeAttackOf(unit).reach + bodyRadius(target) - bodyRadius(unit)) * ENEMY.engageFactor;

  if (ignoreCap || strikersOn(battle, unit, target.id) < ENEMY.maxAttackers) {
    if (d > engage) {
      moveDir(unit, dir.x, dir.z, speed, dt);
      setState(unit, 'moving');
    } else if (unit.attackCooldown <= 0 && Math.abs(angleDiff(unit.facing, toTarget)) < AIM_TOLERANCE) {
      startAction(unit, 'strike', target, events);
    } else {
      setState(unit, 'idle');
    }
    return;
  }

  // Waiting for a turn: hold a ring around the target and drift sideways.
  const side = unit.id % 2 === 0 ? 1 : -1;
  let mx = -dir.z * side * 0.35;
  let mz = dir.x * side * 0.35;
  if (d > ENEMY.waitDistance + 0.5) {
    mx += dir.x;
    mz += dir.z;
  } else if (d < ENEMY.waitDistance - 0.5) {
    mx -= dir.x * 0.6;
    mz -= dir.z * 0.6;
  }
  const len = Math.hypot(mx, mz);
  if (len > 0.01) {
    moveDir(unit, mx / len, mz / len, speed * Math.min(1, len) * 0.6, dt);
    setState(unit, 'moving');
  } else {
    setState(unit, 'idle');
  }
}

/** Schildtraeger: a slow wall of armour that hits the nearest foe. */
function schildtraegerBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  meleeEngage(battle, unit, forcedTarget(battle, unit, Infinity) ?? nearest(unit, foes), dt, events);
}

/**
 * Berserker: runs past the front line for the back row (healers first, then the nearest back-row
 * foe), and does not wait its turn behind other attackers. A taunt still pulls it off.
 */
function berserkerBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  const target =
    forcedTarget(battle, unit, Infinity) ??
    nearest(unit, foes.filter((f) => HEALERS.includes(f.classId))) ??
    nearest(unit, foes.filter((f) => BACK_ROW.includes(f.classId))) ??
    nearest(unit, foes);
  meleeEngage(battle, unit, target, dt, events, true);
}

/**
 * Shared ranged footwork around an attack: back away from close foes while the attack recharges,
 * close in when the target is out of range, otherwise hold. Returns true when the unit may attack.
 */
function rangedFootwork(unit: Unit, target: Unit, closest: Unit, dt: number): boolean {
  const speed = speedOf(unit);
  const d = dist(unit.pos, target.pos);
  const dn = dist(unit.pos, closest.pos);
  turnTowards(unit, angleTo(unit.pos, target.pos), ENEMY.turnRate, dt);
  if (dn < BEHAVIOUR.fleeDistance && unit.attackCooldown > 0) {
    moveAway(unit, closest.pos, speed, dt);
    return false;
  }
  if (d > unit.stats.range) {
    moveTowards(unit, target.pos, speed, dt);
    return false;
  }
  if (unit.attackCooldown > 0 && dn < BEHAVIOUR.rangedMinDistance) {
    moveAway(unit, closest.pos, speed * 0.6, dt);
    return false;
  }
  setState(unit, 'idle');
  return facing(unit, target);
}

/** Bogenschuetze: keeps distance and shoots the lowest-health foe in range. */
function archerBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  const closest = nearest(unit, foes);
  if (!closest) {
    setState(unit, 'idle');
    return;
  }
  const inRange = foes.filter((f) => dist(unit.pos, f.pos) <= unit.stats.range);
  const weakest = inRange.reduce<Unit | null>((best, f) => (!best || f.hp < best.hp ? f : best), null);
  const target = forcedTarget(battle, unit, unit.stats.range) ?? weakest ?? closest;
  unit.targetId = target.id;
  if (!rangedFootwork(unit, target, closest, dt)) return;
  if (abilityReady(unit, 'pierce')) startAction(unit, 'pierce', target, events);
  else if (unit.attackCooldown <= 0) startAction(unit, 'shot', target, events);
}

/** Magier: frost nova when foes come close, fireballs at the largest cluster. */
function mageBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  const closest = nearest(unit, foes);
  if (!closest) {
    setState(unit, 'idle');
    return;
  }
  if (abilityReady(unit, 'frostNova') && dist(unit.pos, closest.pos) <= ACTIONS.frostNova.trigger) {
    startAction(unit, 'frostNova', null, events);
    return;
  }
  const target = forcedTarget(battle, unit, unit.stats.range) ?? clusterTarget(unit, foes) ?? closest;
  unit.targetId = target.id;
  if (rangedFootwork(unit, target, closest, dt) && unit.attackCooldown <= 0) startAction(unit, 'fireball', target, events);
}

/** The foe in range with the most other foes around it (first in id order on a tie). */
function clusterTarget(unit: Unit, foes: Unit[]): Unit | null {
  let best: Unit | null = null;
  let bestCount = -1;
  for (const f of foes) {
    if (dist(unit.pos, f.pos) > unit.stats.range) continue;
    const count = foes.filter((o) => dist(o.pos, f.pos) <= ACTIONS.fireball.clusterRadius).length;
    if (count > bestCount) {
      best = f;
      bestCount = count;
    }
  }
  return best;
}

function healthFraction(u: Unit): number {
  return u.hp / u.stats.maxHp - (u.isHero ? BEHAVIOUR.heroTieBreak : 0);
}

/** Heiler: group heal when several allies nearby are hurt, else the support routine. */
function healerBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const g = ACTIONS.groupHeal;
  if (abilityReady(unit, 'groupHeal')) {
    const hurt = livingAllies(battle, unit).filter((a) => dist(a.pos, unit.pos) <= g.radius && a.hp / a.stats.maxHp < g.below);
    if (hurt.length >= g.minHurt) {
      startAction(unit, 'groupHeal', null, events);
      return;
    }
  }
  supportBrain(battle, unit, dt, events);
}

/** Schamane: shields the most hurt ally under attack, else the support routine. */
function schamaneBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  if (abilityReady(unit, 'ward')) {
    const foes = livingFoes(battle, unit);
    let ward: Unit | null = null;
    for (const a of livingAllies(battle, unit)) {
      if (hasStatus(a, 'shielded') || dist(unit.pos, a.pos) > unit.stats.range) continue;
      const threatened = foes.some((f) => f.targetId === a.id && dist(f.pos, a.pos) <= BEHAVIOUR.wardThreat);
      if (threatened && (!ward || healthFraction(a) < healthFraction(ward))) ward = a;
    }
    if (ward) {
      turnTowards(unit, angleTo(unit.pos, ward.pos), ENEMY.turnRate, dt);
      startAction(unit, 'ward', ward, events);
      return;
    }
  }
  supportBrain(battle, unit, dt, events);
}

/**
 * Healer routine (Heiler and Schamane): heals the ally with the lowest health fraction (the hero
 * first on a tie), bolts a foe when nobody needs healing, stays behind its allies.
 */
function supportBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const allies = livingAllies(battle, unit);
  const foes = livingFoes(battle, unit);
  const closest = nearest(unit, foes);
  const speed = speedOf(unit);

  let patient: Unit | null = null;
  for (const a of allies) {
    if (a.hp / a.stats.maxHp >= BEHAVIOUR.healBelow) continue;
    if (!patient || healthFraction(a) < healthFraction(patient)) patient = a;
  }

  if (patient) {
    unit.targetId = patient.id;
    turnTowards(unit, angleTo(unit.pos, patient.pos), ENEMY.turnRate, dt);
    if (dist(unit.pos, patient.pos) > unit.stats.range) {
      moveTowards(unit, patient.pos, speed, dt);
      return;
    }
    if (unit.attackCooldown <= 0) {
      startAction(unit, 'heal', patient, events);
      return;
    }
  } else if (closest) {
    const foe = forcedTarget(battle, unit, unit.stats.range) ?? closest;
    if (dist(unit.pos, foe.pos) <= unit.stats.range && unit.attackCooldown <= 0) {
      unit.targetId = foe.id;
      turnTowards(unit, angleTo(unit.pos, foe.pos), ENEMY.turnRate, dt);
      if (facing(unit, foe)) {
        startAction(unit, 'bolt', foe, events);
        return;
      }
    }
  }

  // Positioning: away from close foes, else behind the allies' centre.
  if (closest && dist(unit.pos, closest.pos) < BEHAVIOUR.healerSafeDistance) {
    moveAway(unit, closest.pos, speed, dt);
    return;
  }
  const anchor = healerAnchor(unit, allies, foes);
  if (anchor && dist(unit.pos, anchor) > 1.5) moveTowards(unit, anchor, speed * 0.8, dt);
  else setState(unit, 'idle');
}

function centre(list: Unit[]): Unit['pos'] | null {
  if (list.length === 0) return null;
  let x = 0;
  let z = 0;
  for (const u of list) {
    x += u.pos.x;
    z += u.pos.z;
  }
  return { x: x / list.length, z: z / list.length };
}

/** A point behind the other allies, on the side away from the foes. */
function healerAnchor(unit: Unit, allies: Unit[], foes: Unit[]): Unit['pos'] | null {
  const mine = centre(allies.filter((a) => a !== unit));
  const theirs = centre(foes);
  if (!mine || !theirs) return null;
  const away = angleTo(theirs, mine);
  return { x: mine.x + Math.sin(away) * BEHAVIOUR.healerBehind, z: mine.z - Math.cos(away) * BEHAVIOUR.healerBehind };
}

/** Wolf: a fast pack hunter that bites the nearest foe and does not wait its turn. */
function wolfBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  meleeEngage(battle, unit, forcedTarget(battle, unit, Infinity) ?? nearest(unit, livingFoes(battle, unit)), dt, events, true);
}

// ---------------------------------------------------------------------------------------------
// Bosses: one telegraphed action per beat (their attack interval), else the basic attack.

/**
 * Starts a boss action and places its ground warning, which resolves when the windup ends.
 * Sweep and charge face the target at once, so the warning shows where the blow goes.
 */
function startBossAction(battle: Battle, unit: Unit, action: BossActionId, target: Unit | null, events: BattleEvent[]): void {
  if (target && (action === 'sweep' || action === 'charge')) unit.facing = angleTo(unit.pos, target.pos);
  startAction(unit, action, target, events);
  switch (action) {
    case 'sweep': {
      const a = BOSS_ACTIONS.sweep;
      placeArea(battle, unit, { kind: 'sweep', shape: 'arc', at: unit.pos, angle: unit.facing, arc: a.arc, radius: a.radius, delay: a.windup, multiplier: a.multiplier, damageType: 'physical', freeze: 0, knockback: a.knockback }, events);
      return;
    }
    case 'charge': {
      const a = BOSS_ACTIONS.charge;
      placeArea(battle, unit, { kind: 'charge', shape: 'lane', at: unit.pos, angle: unit.facing, length: a.maxLength, radius: a.halfWidth, delay: a.windup, multiplier: 0, damageType: 'physical', freeze: 0 }, events);
      return;
    }
    case 'slam': {
      const a = BOSS_ACTIONS.slam;
      const spec = { kind: 'slam' as const, delay: a.windup, multiplier: a.multiplier, damageType: 'physical' as const, freeze: 0, knockback: a.knockback };
      placeArea(battle, unit, { ...spec, at: unit.pos, radius: a.radius }, events);
      const outside = byDistance(unit, livingFoes(battle, unit)).filter((f) => dist(f.pos, unit.pos) > a.radius && dist(f.pos, unit.pos) <= a.range);
      for (const f of outside.slice(0, a.targets)) placeArea(battle, unit, { ...spec, at: f.pos, radius: a.targetRadius }, events);
      return;
    }
    case 'poison': {
      const a = BOSS_ACTIONS.poison;
      const near = byDistance(unit, livingFoes(battle, unit)).filter((f) => dist(f.pos, unit.pos) <= a.range);
      for (const f of near.slice(0, a.targets)) placeArea(battle, unit, { kind: 'poison', at: f.pos, radius: a.radius, delay: a.windup, multiplier: a.multiplier, damageType: 'magic', freeze: 0 }, events);
      return;
    }
    case 'hex':
    case 'summon':
    case 'mend':
    case 'raise':
      return;
  }
}

/** Nearest first (stable, so ties keep id order). */
function byDistance(unit: Unit, list: Unit[]): Unit[] {
  return [...list].sort((a, b) => dist(unit.pos, a.pos) - dist(unit.pos, b.pos));
}

/** The charge's run: the boss crosses the lane fast and hits every foe it passes once. */
function dash(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const c = BOSS_ACTIONS.charge;
  moveDir(unit, Math.sin(unit.facing), -Math.cos(unit.facing), c.maxLength / c.dash, dt);
  for (const f of battle.units) {
    if (f.team === unit.team || !isAlive(f) || unit.hitIds.includes(f.id)) continue;
    if (dist(f.pos, unit.pos) > c.halfWidth + bodyRadius(f)) continue;
    unit.hitIds.push(f.id);
    if (isInvulnerable(f, HERO.dodge.invulnerable)) {
      events.push({ type: 'evade', unitId: f.id });
      continue;
    }
    const side = (f.pos.x - unit.pos.x) * Math.cos(unit.facing) + (f.pos.z - unit.pos.z) * Math.sin(unit.facing);
    push(f, unit.facing + (side >= 0 ? 1 : -1) * (Math.PI / 3), c.knockback);
    if (!applyDamage(unit, f, computeDamage(battle, unit.stats.power, c.multiplier, f, 'physical', unit), true, events)) stun(f, BOSS_STRIKE.stagger);
  }
}

/** Living units this boss summoned. */
function livingSummons(battle: Battle, unit: Unit): number {
  return battle.units.filter((u) => u.summonerId === unit.id && isAlive(u)).length;
}

function canSummon(battle: Battle, unit: Unit): boolean {
  const s = BOSS_ACTIONS.summon;
  if (!SUMMONS[unit.classId] || !abilityReady(unit, 'summon')) return false;
  if (livingSummons(battle, unit) >= s.maxAlive) return false;
  const any = battle.units.some((u) => u.summonerId === unit.id);
  return any || unit.hp / unit.stats.maxHp < s.firstBelow;
}

/** Calls the next group in the boss's `SUMMONS` cycle; they come in from its side's edge. */
function summon(battle: Battle, boss: Unit, events: BattleEvent[]): void {
  const groups = SUMMONS[boss.classId];
  if (!groups || groups.length === 0) return;
  // Every cast brings a whole group, so the count so far tells which group is next.
  let made = battle.units.filter((u) => u.summonerId === boss.id).length;
  let i = 0;
  while (made > 0) made -= groups[i++ % groups.length]!.length;
  const group = groups[i % groups.length]!;
  const side = boss.team === 'enemy' ? 1 : -1;
  group.forEach((classId, k) => {
    const stats = battle.reserves[classId];
    if (!stats) return;
    const z = clamp(boss.pos.z + (k - (group.length - 1) / 2) * 2.5, -5, 5);
    const u = createUnit(battle.units.length + 1, { team: boss.team, classId, isHero: false, stats, x: side * BOSS_ACTIONS.summon.edgeX, z, summonerId: boss.id });
    battle.units.push(u);
    events.push({ type: 'spawn', unitId: u.id, summonerId: boss.id });
  });
}

/** Allies of the Fen Witch inside her mend, when one of them is hurt enough. */
function mendTargets(battle: Battle, unit: Unit): Unit[] {
  const m = BOSS_ACTIONS.mend;
  return livingAllies(battle, unit).filter((a) => a !== unit && dist(a.pos, unit.pos) <= m.radius);
}

/** Fallen allies the Bone King can raise: not bosses, each only once, nearest first. */
function raisable(battle: Battle, unit: Unit): Unit[] {
  return byDistance(unit, battle.units.filter((u) => u.team === unit.team && u !== unit && !isAlive(u) && !u.raised && !isBoss(u)));
}

/** A foe worth charging: the farthest back-row foe within the lane's reach, else any far foe. */
function chargeTarget(unit: Unit, foes: Unit[]): Unit | null {
  const c = BOSS_ACTIONS.charge;
  const far = foes.filter((f) => {
    const d = dist(unit.pos, f.pos);
    return d >= c.minRange && d <= c.maxLength - 2;
  });
  const back = far.filter((f) => BACK_ROW.includes(f.classId));
  const pick = back.length > 0 ? back : far;
  return pick.reduce<Unit | null>((best, f) => (!best || dist(unit.pos, f.pos) > dist(unit.pos, best.pos) ? f : best), null);
}

/**
 * Iron Warlord and Bone King: call raiders (Warlord) or raise the fallen (Bone King), charge a
 * far foe, slam when several foes are about, sweep when the target stands in front; between
 * those, the heavy swing.
 */
function bruteBossBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  const forced = forcedTarget(battle, unit, Infinity);
  const target = forced ?? nearest(unit, foes);
  if (target && unit.attackCooldown <= 0) {
    if (canSummon(battle, unit)) return startBossAction(battle, unit, 'summon', null, events);
    if (unit.classId === 'knochenkoenig' && abilityReady(unit, 'raise') && raisable(battle, unit).length > 0) return startBossAction(battle, unit, 'raise', null, events);
    if (abilityReady(unit, 'charge')) {
      // A taunt holds the charge on the taunter (only if it stands far enough away to run at).
      const charge = forced ? (dist(forced.pos, unit.pos) >= BOSS_ACTIONS.charge.minRange ? forced : null) : chargeTarget(unit, foes);
      if (charge) return startBossAction(battle, unit, 'charge', charge, events);
    }
    const s = BOSS_ACTIONS.slam;
    if (abilityReady(unit, 'slam') && foes.filter((f) => dist(f.pos, unit.pos) <= s.range).length >= 3) return startBossAction(battle, unit, 'slam', null, events);
    const w = BOSS_ACTIONS.sweep;
    if (abilityReady(unit, 'sweep') && dist(target.pos, unit.pos) <= w.radius) return startBossAction(battle, unit, 'sweep', target, events);
  }
  meleeEngage(battle, unit, target, dt, events, true);
}

/**
 * Fen Witch: mends her escort, calls wolves and shamans, poisons the ground under the squad,
 * and hexes from range between those, keeping her distance like a caster.
 */
function witchBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const foes = livingFoes(battle, unit);
  const closest = nearest(unit, foes);
  if (!closest) {
    setState(unit, 'idle');
    return;
  }
  if (unit.attackCooldown <= 0) {
    const m = BOSS_ACTIONS.mend;
    if (abilityReady(unit, 'mend') && mendTargets(battle, unit).some((a) => a.hp / a.stats.maxHp < m.below)) return startBossAction(battle, unit, 'mend', null, events);
    if (canSummon(battle, unit)) return startBossAction(battle, unit, 'summon', null, events);
    if (abilityReady(unit, 'poison') && dist(closest.pos, unit.pos) <= BOSS_ACTIONS.poison.range) return startBossAction(battle, unit, 'poison', null, events);
  }
  const target = forcedTarget(battle, unit, unit.stats.range) ?? closest;
  unit.targetId = target.id;
  if (rangedFootwork(unit, target, closest, dt) && unit.attackCooldown <= 0) startAction(unit, 'hex', target, events);
}

const BRAINS: Record<ClassId, (battle: Battle, unit: Unit, dt: number, events: BattleEvent[]) => void> = {
  krieger: kriegerBrain,
  bogenschuetze: archerBrain,
  heiler: healerBrain,
  magier: mageBrain,
  schildtraeger: schildtraegerBrain,
  berserker: berserkerBrain,
  schamane: schamaneBrain,
  wolf: wolfBrain,
  kriegsherr: bruteBossBrain,
  sumpfhexe: witchBrain,
  knochenkoenig: bruteBossBrain,
};

// ---------------------------------------------------------------------------------------------

/**
 * One tick for an AI unit (companion or enemy): run the current windup or recover, else let
 * the class brain choose. Not called while the unit is frozen or in hit-stop.
 */
export function updateAi(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  unit.stateTime += dt;
  unit.attackCooldown = Math.max(0, unit.attackCooldown - dt * speedFactor(unit));
  for (const k of Object.keys(unit.abilityCooldowns) as AbilityId[]) {
    unit.abilityCooldowns[k] = Math.max(0, (unit.abilityCooldowns[k] ?? 0) - dt);
  }

  switch (unit.state) {
    case 'stunned':
      if (unit.stateTime >= unit.stunDuration) setState(unit, 'idle');
      return;
    case 'windup': {
      const target = byId(battle, unit.targetId);
      const fixed = unit.action !== null && FIXED_AIM.includes(unit.action as AiActionId);
      if (!fixed && target && isAlive(target) && target !== unit) turnTowards(unit, angleTo(unit.pos, target.pos), ENEMY.windupTurnRate, dt);
      if (unit.action === 'strike') {
        const a = meleeAttackOf(unit);
        moveDir(unit, Math.sin(unit.facing), -Math.cos(unit.facing), a.lunge / a.windup, dt);
      }
      if (unit.stateTime >= actionTiming(unit).windup) {
        release(battle, unit, events);
        const action = aiAction(unit);
        // Bosses wait their attack interval after every action, specials included.
        if (action === null || !isAbility(action) || isBoss(unit)) {
          unit.attackCooldown = unit.stats.attackInterval + range(battle, 0, ENEMY.cooldownJitter);
        }
        setState(unit, 'recover');
      }
      return;
    }
    case 'recover':
      if (unit.action === 'charge' && unit.stateTime <= BOSS_ACTIONS.charge.dash) dash(battle, unit, dt, events);
      if (unit.stateTime >= actionTiming(unit).recover) {
        setState(unit, 'idle');
        unit.action = null;
      }
      return;
    case 'dead':
      return;
    case 'idle':
    case 'moving':
    case 'dodging':
      break;
  }

  BRAINS[unit.classId](battle, unit, dt, events);
}
