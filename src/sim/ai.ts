import { ACTIONS, BEHAVIOUR, ENEMY, HERO, heroAttack, type MeleeAttack } from './balance';
import { applyHeal, isAlive, resolveMelee } from './combat';
import { angleDiff, angleTo, dist } from './math';
import { moveDir, turnTowards } from './movement';
import { fireStraight, lob, placeArea } from './projectiles';
import { range } from './rng';
import { addStatus, getStatus, speedFactor } from './statuses';
import type { AbilityId, ActionId, Battle, BattleEvent, ClassId, Unit } from './types';

const OPTS = { invulnerableTime: HERO.dodge.invulnerable };
/** Units must face their target within this angle before they start an attack. */
const AIM_TOLERANCE = 0.5;
const BACK_ROW: readonly ClassId[] = ['bogenschuetze', 'heiler', 'magier'];
const ABILITIES: readonly ActionId[] = ['taunt', 'pierce', 'groupHeal', 'frostNova'];

function isAbility(action: ActionId): action is AbilityId {
  return ABILITIES.includes(action);
}

/** Windup and recover of what a unit is doing, for the sim and for posing the view. */
export function actionTiming(unit: Unit): { windup: number; recover: number } {
  if (unit.isHero) return heroAttack(unit.chain);
  if (unit.action === null || unit.action === 'strike') return ENEMY.attack;
  return ACTIONS[unit.action];
}

/** The melee attack a unit swings (hero chain step or the AI strike). */
export function meleeAttackOf(unit: Unit): MeleeAttack {
  return unit.isHero ? heroAttack(unit.chain) : ENEMY.attack;
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

function startAction(unit: Unit, action: ActionId, target: Unit | null, events: BattleEvent[]): void {
  unit.action = action;
  if (target) unit.targetId = target.id;
  setState(unit, 'windup');
  if (isAbility(action)) unit.abilityCooldowns[action] = ACTIONS[action].cooldown;
  if (action === 'strike') events.push({ type: 'attackStart', unitId: unit.id, chain: 0 });
  else events.push({ type: 'action', unitId: unit.id, action });
}

function abilityReady(unit: Unit, ability: AbilityId): boolean {
  return (unit.abilityCooldowns[ability] ?? 0) <= 0;
}

function speedOf(unit: Unit): number {
  return unit.stats.moveSpeed * speedFactor(unit);
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
  switch (unit.action) {
    case null:
    case 'strike':
      events.push({ type: 'swing', unitId: unit.id, chain: 0 });
      resolveMelee(battle, unit, ENEMY.attack, OPTS, events);
      return;
    case 'taunt': {
      const t = ACTIONS.taunt;
      for (const f of livingFoes(battle, unit)) {
        if (f.isHero || dist(f.pos, unit.pos) > t.radius) continue;
        addStatus(f, 'taunted', t.duration, events, 0, unit.id);
        f.targetId = unit.id;
      }
      return;
    }
    case 'shot':
    case 'pierce':
    case 'bolt': {
      if (!live) return;
      const a = ACTIONS[unit.action];
      fireStraight(
        battle,
        unit,
        {
          kind: unit.action === 'shot' ? 'arrow' : unit.action === 'pierce' ? 'piercing' : 'bolt',
          at: live.pos,
          speed: a.speed,
          radius: a.radius,
          range: shotRange,
          multiplier: a.multiplier,
          damageType: unit.action === 'bolt' ? 'magic' : 'physical',
          pierce: unit.action === 'pierce',
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

/** Close in, wind up visibly, swing; when two allies already strike the target, circle and wait. */
function meleeEngage(battle: Battle, unit: Unit, target: Unit | null, dt: number, events: BattleEvent[]): void {
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
  const engage = ENEMY.attack.reach * ENEMY.engageFactor;

  if (strikersOn(battle, unit, target.id) < ENEMY.maxAttackers) {
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

/** Heiler: heals the ally with the lowest health fraction (the hero first on a tie), stays back. */
function healerBrain(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  const allies = livingAllies(battle, unit);
  const foes = livingFoes(battle, unit);
  const closest = nearest(unit, foes);
  const speed = speedOf(unit);
  const g = ACTIONS.groupHeal;

  if (abilityReady(unit, 'groupHeal')) {
    const hurt = allies.filter((a) => dist(a.pos, unit.pos) <= g.radius && a.hp / a.stats.maxHp < g.below);
    if (hurt.length >= g.minHurt) {
      startAction(unit, 'groupHeal', null, events);
      return;
    }
  }

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

const BRAINS: Record<ClassId, (battle: Battle, unit: Unit, dt: number, events: BattleEvent[]) => void> = {
  krieger: kriegerBrain,
  bogenschuetze: archerBrain,
  heiler: healerBrain,
  magier: mageBrain,
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
      if (target && isAlive(target) && target !== unit) turnTowards(unit, angleTo(unit.pos, target.pos), ENEMY.windupTurnRate, dt);
      if (unit.action === 'strike') {
        const lunge = ENEMY.attack.lunge / ENEMY.attack.windup;
        moveDir(unit, Math.sin(unit.facing), -Math.cos(unit.facing), lunge, dt);
      }
      if (unit.stateTime >= actionTiming(unit).windup) {
        release(battle, unit, events);
        if (unit.action === null || !isAbility(unit.action)) {
          unit.attackCooldown = unit.stats.attackInterval + range(battle, 0, ENEMY.cooldownJitter);
        }
        setState(unit, 'recover');
      }
      return;
    }
    case 'recover':
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
