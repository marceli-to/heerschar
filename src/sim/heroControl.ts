import { ENERGY, HERO, HERO_ABILITIES, heroAttack } from './balance';
import { bodyRadius } from './body';
import { applyDamage, computeDamage, gainEnergy, isAlive, push, resolveMelee } from './combat';
import { abilityAim, chainLength, fireBasic, heroActionTiming, heroKit, isHeroAbility, isRangedHero, meleeAim, rangedAim, releaseAbility } from './heroAbilities';
import { lockTarget } from './heroTargeting';
import { angleDiff, angleTo, dist } from './math';
import { moveDir, turnTowards } from './movement';
import { moveFactor } from './statuses';
import type { AbilityId, Battle, BattleEvent, HeroAbilityId, HeroInput, Unit } from './types';

const DODGE_OPTS = { invulnerableTime: HERO.dodge.invulnerable };

/**
 * Records presses into short buffers, counts cooldowns down and regenerates energy. Runs every
 * tick, even during hit-stop, so a press is never lost while the hero is busy.
 */
export function bufferHeroInput(hero: Unit, input: HeroInput, dt: number): void {
  hero.attackBuffer = Math.max(0, hero.attackBuffer - dt);
  hero.dodgeBuffer = Math.max(0, hero.dodgeBuffer - dt);
  hero.abilityBuffer = Math.max(0, hero.abilityBuffer - dt);
  hero.dodgeCooldown = Math.max(0, hero.dodgeCooldown - dt);
  for (const k of Object.keys(hero.abilityCooldowns) as AbilityId[]) {
    hero.abilityCooldowns[k] = Math.max(0, (hero.abilityCooldowns[k] ?? 0) - dt);
  }
  if (hero.state === 'dead') return;
  gainEnergy(hero, ENERGY.perSecond * dt);

  if (input.attack) hero.attackBuffer = HERO.attackBuffer;
  if (input.dodge) hero.dodgeBuffer = HERO.dodgeBuffer;
  const kit = heroKit(hero);
  const pressed = input.ability1 ? kit.ability1 : input.ability2 ? kit.ability2 : input.leader ? kit.leader : null;
  if (pressed) {
    hero.queuedAbility = pressed;
    hero.abilityBuffer = HERO.abilityBuffer;
  }
  if (hero.abilityBuffer <= 0) hero.queuedAbility = null;
}

/** True when the ability is off cooldown and affordable. */
export function abilityReady(hero: Unit, id: HeroAbilityId): boolean {
  return (hero.abilityCooldowns[id] ?? 0) <= 0 && hero.energy >= HERO_ABILITIES[id].cost;
}

function moveInput(input: HeroInput): { x: number; z: number; len: number } {
  const len = Math.min(1, Math.hypot(input.moveX, input.moveZ));
  return { x: input.moveX, z: input.moveZ, len };
}

function inputAngle(input: HeroInput): number {
  return Math.atan2(input.moveX, -input.moveZ);
}

function startAttack(battle: Battle, hero: Unit, input: HeroInput, chain: number, events: BattleEvent[]): void {
  hero.facing = isRangedHero(hero) ? rangedAim(battle, hero, input) : meleeAim(battle, hero, input);
  hero.state = 'windup';
  hero.stateTime = 0;
  hero.action = null;
  hero.chain = chain;
  hero.chainQueued = false;
  hero.attackBuffer = 0;
  events.push({ type: 'attackStart', unitId: hero.id, chain });
}

/** Starts the queued ability if it is ready. Returns true when it started. */
function tryAbility(battle: Battle, hero: Unit, input: HeroInput, events: BattleEvent[]): boolean {
  const id = hero.queuedAbility;
  if (!id || hero.abilityBuffer <= 0 || !abilityReady(hero, id)) return false;
  hero.facing = abilityAim(battle, hero, input, id);
  hero.state = 'windup';
  hero.stateTime = 0;
  hero.action = id;
  hero.chain = 0;
  hero.chainQueued = false;
  hero.queuedAbility = null;
  hero.abilityBuffer = 0;
  hero.attackBuffer = 0;
  events.push({ type: 'action', unitId: hero.id, action: id });
  return true;
}

function canDodgeFrom(hero: Unit): boolean {
  return hero.state === 'idle' || hero.state === 'moving' || hero.state === 'windup' || hero.state === 'recover';
}

function startDodge(hero: Unit, input: HeroInput, events: BattleEvent[]): void {
  const m = moveInput(input);
  // Without a direction the dodge is a hop backwards, away from what the hero faces.
  hero.dodgeAngle = m.len > 0.1 ? inputAngle(input) : hero.facing + Math.PI;
  if (m.len > 0.1) hero.facing = hero.dodgeAngle;
  hero.state = 'dodging';
  hero.stateTime = 0;
  hero.action = null;
  hero.dodgeCooldown = HERO.dodge.cooldown;
  hero.dodgeBuffer = 0;
  hero.chain = 0;
  hero.chainQueued = false;
  hero.hitIds = [];
  events.push({ type: 'dodge', unitId: hero.id });
}

/**
 * Dodging through enemies grazes them (`HERO.dodgeStrike`): every enemy the hero's body touches is
 * hit once per dodge, pushed aside off the dodge line, and gives the hero energy.
 */
function dodgeStrike(battle: Battle, hero: Unit, events: BattleEvent[]): void {
  const s = HERO.dodgeStrike;
  const reach = bodyRadius(hero) + s.contact;
  for (const u of battle.units) {
    if (u.team === hero.team || !isAlive(u) || hero.hitIds.includes(u.id)) continue;
    if (dist(hero.pos, u.pos) > reach + bodyRadius(u)) continue;
    hero.hitIds.push(u.id);
    const side = angleDiff(hero.dodgeAngle, angleTo(hero.pos, u.pos)) >= 0 ? 1 : -1;
    push(u, hero.dodgeAngle + (side * Math.PI) / 2, s.knockback);
    u.hitstop = Math.max(u.hitstop, s.hitstop);
    gainEnergy(hero, s.energy);
    applyDamage(hero, u, computeDamage(battle, hero.stats.power, s.multiplier, u, 'physical', hero), false, events);
  }
}

function toIdle(hero: Unit): void {
  hero.state = 'idle';
  hero.stateTime = 0;
  hero.chain = 0;
  hero.action = null;
}

function windupBasic(battle: Battle, hero: Unit, dt: number, events: BattleEvent[]): void {
  if (hero.attackBuffer > 0 && hero.chain + 1 < chainLength(hero)) {
    hero.chainQueued = true;
    hero.attackBuffer = 0;
  }
  if (isRangedHero(hero)) {
    if (hero.stateTime < heroActionTiming(hero).windup) return;
    fireBasic(battle, hero, events);
  } else {
    const attack = heroAttack(hero.chain);
    const f = { x: Math.sin(hero.facing), z: -Math.cos(hero.facing) };
    moveDir(hero, f.x, f.z, attack.lunge / attack.windup, dt);
    if (hero.stateTime < attack.windup) return;
    events.push({ type: 'swing', unitId: hero.id, chain: hero.chain });
    if (resolveMelee(battle, hero, attack, DODGE_OPTS, events) > 0) gainEnergy(hero, ENERGY.perBasicHit);
  }
  hero.state = 'recover';
  hero.stateTime = 0;
}

function windupAbility(battle: Battle, hero: Unit, id: HeroAbilityId, input: HeroInput, dt: number, events: BattleEvent[]): void {
  const a = HERO_ABILITIES[id];
  if ('lunge' in a && a.lunge > 0) moveDir(hero, Math.sin(hero.facing), -Math.cos(hero.facing), a.lunge / a.windup, dt);
  if (hero.stateTime < a.windup) return;
  // Paid on release, so an interrupted cast costs nothing.
  hero.energy -= a.cost;
  hero.abilityCooldowns[id] = a.cooldown * hero.mods.cooldown;
  const leap = releaseAbility(battle, hero, id, input, events);
  hero.stateTime = 0;
  if (leap) {
    hero.state = 'dodging';
    hero.dodgeAngle = hero.facing + Math.PI;
  } else {
    hero.state = 'recover';
  }
}

/** Applies one tick of hero input. Not called during hit-stop or while frozen. */
export function updateHero(battle: Battle, hero: Unit, input: HeroInput, dt: number, events: BattleEvent[]): void {
  if (hero.dodgeBuffer > 0 && hero.dodgeCooldown <= 0 && canDodgeFrom(hero)) startDodge(hero, input, events);

  const m = moveInput(input);
  const lock = lockTarget(battle);
  hero.stateTime += dt;

  switch (hero.state) {
    case 'idle':
    case 'moving': {
      if (tryAbility(battle, hero, input, events)) break;
      if (hero.attackBuffer > 0) {
        // A fresh press after a finished chain starts over at the first step.
        startAttack(battle, hero, input, 0, events);
        break;
      }
      if (lock) turnTowards(hero, angleTo(hero.pos, lock.pos), HERO.turnRate, dt);
      if (m.len > 0.05) {
        moveDir(hero, m.x, m.z, HERO.moveSpeed * moveFactor(hero), dt);
        if (!lock) turnTowards(hero, inputAngle(input), HERO.turnRate, dt);
        if (hero.state !== 'moving') hero.stateTime = 0;
        hero.state = 'moving';
      } else if (hero.state !== 'idle') {
        hero.state = 'idle';
        hero.stateTime = 0;
      }
      break;
    }
    case 'windup': {
      if (isHeroAbility(hero.action)) windupAbility(battle, hero, hero.action, input, dt, events);
      else windupBasic(battle, hero, dt, events);
      break;
    }
    case 'recover': {
      if (isHeroAbility(hero.action)) {
        if (hero.stateTime >= HERO_ABILITIES[hero.action].recover) toIdle(hero);
        break;
      }
      const next = hero.chain + 1;
      if (hero.attackBuffer > 0 && next < chainLength(hero)) {
        hero.chainQueued = true;
        hero.attackBuffer = 0;
      }
      if (hero.stateTime >= HERO.chainOpen && tryAbility(battle, hero, input, events)) break;
      if (hero.chainQueued && hero.stateTime >= HERO.chainOpen) {
        startAttack(battle, hero, input, next, events);
      } else if (hero.stateTime >= heroActionTiming(hero).recover) {
        toIdle(hero);
      }
      break;
    }
    case 'dodging': {
      const leap = hero.action === 'rueckzug';
      const distance = leap ? HERO_ABILITIES.rueckzug.distance : HERO.dodge.distance;
      const duration = leap ? HERO_ABILITIES.rueckzug.recover : HERO.dodge.duration;
      const t = Math.min(1, hero.stateTime / duration);
      // Fast start easing into run speed: v = D/T × (1.5 − t), which integrates to D over T.
      const speed = (distance / duration) * (1.5 - t);
      moveDir(hero, Math.sin(hero.dodgeAngle), -Math.cos(hero.dodgeAngle), speed, dt);
      if (!leap) dodgeStrike(battle, hero, events);
      if (hero.stateTime >= duration) toIdle(hero);
      break;
    }
    case 'stunned': {
      if (hero.stateTime >= hero.stunDuration) toIdle(hero);
      break;
    }
    case 'dead':
      break;
  }
}
