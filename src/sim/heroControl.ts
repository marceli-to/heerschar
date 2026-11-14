import { HERO, heroAttack } from './balance';
import { isAlive, resolveMelee } from './combat';
import { angleDiff, angleTo, dist } from './math';
import { moveDir, turnTowards } from './movement';
import type { Battle, BattleEvent, HeroInput, Unit } from './types';

const DODGE_OPTS = { invulnerableTime: HERO.dodge.invulnerable };

/**
 * Records presses into short buffers. Runs every tick, even during hit-stop,
 * so a press is never lost while the hero is busy.
 */
export function bufferHeroInput(hero: Unit, input: HeroInput, dt: number): void {
  hero.attackBuffer = Math.max(0, hero.attackBuffer - dt);
  hero.dodgeBuffer = Math.max(0, hero.dodgeBuffer - dt);
  hero.dodgeCooldown = Math.max(0, hero.dodgeCooldown - dt);
  if (input.attack) hero.attackBuffer = HERO.attackBuffer;
  if (input.dodge) hero.dodgeBuffer = HERO.dodgeBuffer;
}

function moveInput(input: HeroInput): { x: number; z: number; len: number } {
  const len = Math.min(1, Math.hypot(input.moveX, input.moveZ));
  return { x: input.moveX, z: input.moveZ, len };
}

function inputAngle(input: HeroInput): number {
  return Math.atan2(input.moveX, -input.moveZ);
}

/** Melee aim assist: the nearest living enemy close to the intended swing direction. */
function assistedAngle(battle: Battle, hero: Unit, angle: number): number {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of battle.units) {
    if (u.team === hero.team || !isAlive(u)) continue;
    const d = dist(hero.pos, u.pos);
    if (d > HERO.aimAssist.range || d >= bestDist) continue;
    if (Math.abs(angleDiff(angle, angleTo(hero.pos, u.pos))) > HERO.aimAssist.angle) continue;
    best = u;
    bestDist = d;
  }
  return best ? angleTo(hero.pos, best.pos) : angle;
}

function startAttack(battle: Battle, hero: Unit, input: HeroInput, chain: number, events: BattleEvent[]): void {
  const m = moveInput(input);
  const intended = m.len > 0.1 ? inputAngle(input) : input.aimAngle;
  hero.facing = assistedAngle(battle, hero, intended);
  hero.state = 'windup';
  hero.stateTime = 0;
  hero.chain = chain;
  hero.chainQueued = false;
  hero.attackBuffer = 0;
  events.push({ type: 'attackStart', unitId: hero.id, chain });
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
  hero.dodgeCooldown = HERO.dodge.cooldown;
  hero.dodgeBuffer = 0;
  hero.chain = 0;
  hero.chainQueued = false;
  events.push({ type: 'dodge', unitId: hero.id });
}

/** Applies one tick of hero input. Not called during hit-stop. */
export function updateHero(battle: Battle, hero: Unit, input: HeroInput, dt: number, events: BattleEvent[]): void {
  if (hero.dodgeBuffer > 0 && hero.dodgeCooldown <= 0 && canDodgeFrom(hero)) startDodge(hero, input, events);

  const m = moveInput(input);
  hero.stateTime += dt;

  switch (hero.state) {
    case 'idle':
    case 'moving': {
      if (hero.attackBuffer > 0) {
        // A fresh press after a finished chain starts over at the first swing.
        startAttack(battle, hero, input, 0, events);
        break;
      }
      if (m.len > 0.05) {
        moveDir(hero, m.x, m.z, HERO.moveSpeed, dt);
        turnTowards(hero, inputAngle(input), HERO.turnRate, dt);
        if (hero.state !== 'moving') hero.stateTime = 0;
        hero.state = 'moving';
      } else if (hero.state !== 'idle') {
        hero.state = 'idle';
        hero.stateTime = 0;
      }
      break;
    }
    case 'windup': {
      const attack = heroAttack(hero.chain);
      if (hero.attackBuffer > 0 && hero.chain + 1 < HERO.chain.length) {
        hero.chainQueued = true;
        hero.attackBuffer = 0;
      }
      const f = { x: Math.sin(hero.facing), z: -Math.cos(hero.facing) };
      moveDir(hero, f.x, f.z, attack.lunge / attack.windup, dt);
      if (hero.stateTime >= attack.windup) {
        events.push({ type: 'swing', unitId: hero.id, chain: hero.chain });
        resolveMelee(battle, hero, attack, DODGE_OPTS, events);
        hero.state = 'recover';
        hero.stateTime = 0;
      }
      break;
    }
    case 'recover': {
      const attack = heroAttack(hero.chain);
      const next = hero.chain + 1;
      if (hero.attackBuffer > 0 && next < HERO.chain.length) {
        hero.chainQueued = true;
        hero.attackBuffer = 0;
      }
      if (hero.chainQueued && hero.stateTime >= HERO.chainOpen) {
        startAttack(battle, hero, input, next, events);
      } else if (hero.stateTime >= attack.recover) {
        hero.state = 'idle';
        hero.stateTime = 0;
        hero.chain = 0;
      }
      break;
    }
    case 'dodging': {
      const { distance, duration } = HERO.dodge;
      const t = Math.min(1, hero.stateTime / duration);
      // Fast start easing into run speed: v = D/T × (1.5 − t), which integrates to D over T.
      const speed = (distance / duration) * (1.5 - t);
      moveDir(hero, Math.sin(hero.dodgeAngle), -Math.cos(hero.dodgeAngle), speed, dt);
      if (hero.stateTime >= duration) {
        hero.state = 'idle';
        hero.stateTime = 0;
      }
      break;
    }
    case 'stunned': {
      if (hero.stateTime >= hero.stunDuration) {
        hero.state = 'idle';
        hero.stateTime = 0;
      }
      break;
    }
    case 'dead':
      break;
  }
}
