import { ENEMY, heroAttack } from './balance';
import { isAlive } from './combat';
import { angleDiff, angleTo, dist } from './math';
import { emptyInput, type Battle, type HeroInput, type Unit } from './types';

/**
 * Scripted hero for headless tests: close in on the nearest enemy, swing the two-hit chain,
 * and dodge sideways when an enemy swing aimed at it is about to land.
 */
export interface BotState {
  /** Ticks to wait before the next attack press, so presses are not spammed every tick. */
  pressDelay: number;
}

export function createBot(): BotState {
  return { pressDelay: 0 };
}

function threatened(battle: Battle, hero: Unit): Unit | null {
  for (const u of battle.units) {
    if (u.team === hero.team || u.state !== 'windup' || u.targetId !== hero.id) continue;
    const left = ENEMY.attack.windup - u.stateTime;
    if (left > 0.2) continue;
    if (dist(u.pos, hero.pos) > ENEMY.attack.reach + 1.2) continue;
    if (Math.abs(angleDiff(u.facing, angleTo(u.pos, hero.pos))) > ENEMY.attack.arc / 2 + 0.3) continue;
    return u;
  }
  return null;
}

export function botInput(battle: Battle, bot: BotState): HeroInput {
  const input = emptyInput();
  const hero = battle.units.find((u) => u.isHero);
  if (!hero || !isAlive(hero)) return input;
  let target: Unit | null = null;
  let best = Infinity;
  for (const u of battle.units) {
    if (u.team === hero.team || !isAlive(u)) continue;
    const d = dist(hero.pos, u.pos);
    if (d < best) {
      best = d;
      target = u;
    }
  }
  if (!target) return input;
  const toTarget = angleTo(hero.pos, target.pos);
  input.aimAngle = toTarget;
  bot.pressDelay = Math.max(0, bot.pressDelay - 1);

  const threat = threatened(battle, hero);
  if (threat && hero.dodgeCooldown <= 0) {
    // Sidestep: perpendicular to the attacker's line.
    const a = angleTo(threat.pos, hero.pos) + Math.PI / 2;
    input.moveX = Math.sin(a);
    input.moveZ = -Math.cos(a);
    input.dodge = true;
    return input;
  }

  if (best > heroAttack(0).reach) {
    input.moveX = Math.sin(toTarget);
    input.moveZ = -Math.cos(toTarget);
  } else if (bot.pressDelay === 0) {
    input.attack = true;
    bot.pressDelay = 8;
  }
  return input;
}
