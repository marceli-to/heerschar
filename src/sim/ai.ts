import { ENEMY, HERO } from './balance';
import { isAlive, resolveMelee } from './combat';
import { angleDiff, angleTo, dist } from './math';
import { moveDir, turnTowards } from './movement';
import { range } from './rng';
import type { Battle, BattleEvent, Unit } from './types';

const OPTS = { invulnerableTime: HERO.dodge.invulnerable };

function nearestFoe(battle: Battle, unit: Unit): Unit | null {
  let best: Unit | null = null;
  let bestDist = Infinity;
  for (const u of battle.units) {
    if (u.team === unit.team || !isAlive(u)) continue;
    const d = dist(unit.pos, u.pos);
    if (d < bestDist) {
      best = u;
      bestDist = d;
    }
  }
  return best;
}

function attackersOn(battle: Battle, unit: Unit, targetId: number): number {
  let n = 0;
  for (const u of battle.units) {
    if (u === unit || u.team !== unit.team || u.targetId !== targetId) continue;
    if (u.state === 'windup' || u.state === 'recover') n++;
  }
  return n;
}

function setState(unit: Unit, state: Unit['state']): void {
  if (unit.state === state) return;
  unit.state = state;
  unit.stateTime = 0;
}

/** Stage 1 melee enemy: close in, wind up visibly, swing, recover; take turns attacking. */
export function updateEnemy(battle: Battle, unit: Unit, dt: number, events: BattleEvent[]): void {
  unit.stateTime += dt;
  unit.attackCooldown = Math.max(0, unit.attackCooldown - dt);
  const attack = ENEMY.attack;

  switch (unit.state) {
    case 'stunned':
      if (unit.stateTime >= unit.stunDuration) setState(unit, 'idle');
      return;
    case 'windup': {
      const target = battle.units.find((u) => u.id === unit.targetId);
      if (target && isAlive(target)) turnTowards(unit, angleTo(unit.pos, target.pos), ENEMY.windupTurnRate, dt);
      moveDir(unit, Math.sin(unit.facing), -Math.cos(unit.facing), attack.lunge / attack.windup, dt);
      if (unit.stateTime >= attack.windup) {
        events.push({ type: 'swing', unitId: unit.id, chain: 0 });
        resolveMelee(battle, unit, attack, OPTS, events);
        unit.attackCooldown = unit.stats.attackInterval + range(battle, 0, ENEMY.cooldownJitter);
        setState(unit, 'recover');
      }
      return;
    }
    case 'recover':
      if (unit.stateTime >= attack.recover) setState(unit, 'idle');
      return;
    case 'dead':
      return;
    case 'idle':
    case 'moving':
    case 'dodging':
      break;
  }

  const target = nearestFoe(battle, unit);
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
  const speed = unit.stats.moveSpeed;
  const engage = attack.reach * ENEMY.engageFactor;
  const mayAttack = attackersOn(battle, unit, target.id) < ENEMY.maxAttackers;

  if (mayAttack) {
    if (d > engage) {
      moveDir(unit, dir.x, dir.z, speed, dt);
      setState(unit, 'moving');
    } else if (unit.attackCooldown <= 0 && Math.abs(angleDiff(unit.facing, toTarget)) < 0.5) {
      setState(unit, 'windup');
      events.push({ type: 'attackStart', unitId: unit.id, chain: 0 });
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
