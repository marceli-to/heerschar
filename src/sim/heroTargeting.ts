import { LOCK } from './balance';
import { isAlive } from './combat';
import { angleDiff, angleTo, dist, TAU } from './math';
import type { Battle, BattleEvent, HeroInput, Unit } from './types';

function byId(battle: Battle, id: number | null): Unit | null {
  if (id === null) return null;
  return battle.units.find((u) => u.id === id) ?? null;
}

/** Living enemies of the hero within lock range. */
function candidates(battle: Battle, hero: Unit): Unit[] {
  return battle.units.filter((u) => u.team !== hero.team && isAlive(u) && dist(u.pos, hero.pos) <= LOCK.range);
}

/** The enemy nearest the view centre: view angle (as metres) plus distance, lowest wins. */
export function pickInView(battle: Battle, hero: Unit, aimAngle: number): Unit | null {
  let best: Unit | null = null;
  let bestScore = Infinity;
  for (const u of candidates(battle, hero)) {
    const off = Math.abs(angleDiff(aimAngle, angleTo(hero.pos, u.pos)));
    const score = off * LOCK.metresPerRadian + dist(hero.pos, u.pos);
    if (score < bestScore) {
      best = u;
      bestScore = score;
    }
  }
  return best;
}

/**
 * The next enemy clockwise around the hero from `current` (seen from above), so repeated
 * presses visit every enemy in range. Stays on `current` when it is the only one.
 */
function nextAround(battle: Battle, hero: Unit, current: Unit): Unit {
  const from = angleTo(hero.pos, current.pos);
  let best = current;
  let bestDelta = Infinity;
  for (const u of candidates(battle, hero)) {
    if (u === current) continue;
    let delta = (angleTo(hero.pos, u.pos) - from) % TAU;
    if (delta <= 0) delta += TAU;
    if (delta < bestDelta || (delta === bestDelta && dist(hero.pos, u.pos) < dist(hero.pos, best.pos))) {
      best = u;
      bestDelta = delta;
    }
  }
  return best;
}

/** The current lock target if it is still alive. */
export function lockTarget(battle: Battle): Unit | null {
  const t = byId(battle, battle.lockTargetId);
  return t && isAlive(t) ? t : null;
}

function setLock(battle: Battle, id: number | null, events: BattleEvent[]): void {
  if (battle.lockTargetId === id) return;
  battle.lockTargetId = id;
  events.push({ type: 'lock', targetId: id });
}

function setMark(battle: Battle, id: number | null, events: BattleEvent[]): void {
  if (battle.markTargetId === id) return;
  battle.markTargetId = id;
  events.push({ type: 'mark', targetId: id });
}

/**
 * Lock-on and mark, free and instant (they work while the hero is busy, stunned or frozen).
 * Tab locks the enemy nearest the view centre and cycles when already locked; Shift+Tab
 * releases. F marks the locked enemy (or the one nearest the view centre); F on the marked
 * enemy clears the mark.
 */
export function updateTargeting(battle: Battle, hero: Unit, input: HeroInput, events: BattleEvent[]): void {
  if (!isAlive(hero)) return;
  if (input.unlock) {
    setLock(battle, null, events);
  } else if (input.lock) {
    const current = lockTarget(battle);
    const next = current ? nextAround(battle, hero, current) : pickInView(battle, hero, input.aimAngle);
    setLock(battle, next ? next.id : null, events);
  }
  if (input.mark) {
    const t = lockTarget(battle) ?? pickInView(battle, hero, input.aimAngle);
    if (t) setMark(battle, battle.markTargetId === t.id ? null : t.id, events);
  }
}

/** Drops a lock or mark whose target has died. */
export function clearDeadTargets(battle: Battle, events: BattleEvent[]): void {
  if (battle.lockTargetId !== null && !lockTarget(battle)) setLock(battle, null, events);
  if (battle.markTargetId !== null) {
    const m = byId(battle, battle.markTargetId);
    if (!m || !isAlive(m)) setMark(battle, null, events);
  }
}
