import { STATUS } from './balance';
import type { BattleEvent, Status, StatusKind, Unit } from './types';

export function getStatus(unit: Unit, kind: StatusKind): Status | undefined {
  return unit.statuses.find((s) => s.kind === kind);
}

export function hasStatus(unit: Unit, kind: StatusKind): boolean {
  return getStatus(unit, kind) !== undefined;
}

/**
 * Adds a status or refreshes it: the longer time and the larger shield win, the newer source
 * wins for taunts.
 */
export function addStatus(unit: Unit, kind: StatusKind, time: number, events: BattleEvent[], amount = 0, sourceId = 0): void {
  const s = getStatus(unit, kind);
  if (s) {
    s.time = Math.max(s.time, time);
    s.amount = Math.max(s.amount, amount);
    s.sourceId = sourceId;
    return;
  }
  unit.statuses.push({ kind, time, amount, sourceId });
  events.push({ type: 'status', unitId: unit.id, kind, on: true });
}

export function removeStatus(unit: Unit, kind: StatusKind, events: BattleEvent[]): void {
  const i = unit.statuses.findIndex((s) => s.kind === kind);
  if (i < 0) return;
  unit.statuses.splice(i, 1);
  events.push({ type: 'status', unitId: unit.id, kind, on: false });
}

/** Counts statuses down and drops expired ones (and spent shields). */
export function tickStatuses(unit: Unit, dt: number, events: BattleEvent[]): void {
  for (let i = unit.statuses.length - 1; i >= 0; i--) {
    const s = unit.statuses[i]!;
    s.time -= dt;
    if (s.time <= 0 || (s.kind === 'shielded' && s.amount <= 0)) {
      unit.statuses.splice(i, 1);
      events.push({ type: 'status', unitId: unit.id, kind: s.kind, on: false });
    }
  }
}

/** Multiplier on move speed and on how fast attack cooldowns recharge. */
export function speedFactor(unit: Unit): number {
  return hasStatus(unit, 'rallied') ? STATUS.rallied : 1;
}
