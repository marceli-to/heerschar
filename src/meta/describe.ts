import { EFFECT_KEYS, LEVEL_CAP, xpToNext, type Effect, type EffectKey } from '../data/progression';
import { STRINGS } from '../data/strings';
import type { XpGain } from './game';

/** Effect keys that hold fractions and read as percentages. */
const PERCENT: ReadonlySet<EffectKey> = new Set(['hp', 'power', 'speed', 'haste', 'damage', 'toughness', 'healing', 'cooldown', 'lifesteal', 'crit', 'area']);

function amount(key: EffectKey, v: number): string {
  const n = PERCENT.has(key) ? v * 100 : v;
  return String(Math.round(n * 10) / 10);
}

/** One readable line per part of an effect, in display order (`STRINGS.effects`). */
export function effectLines(e: Effect): string[] {
  const out: string[] = [];
  for (const k of EFFECT_KEYS) {
    const v = e[k];
    if (v === undefined || v === 0) continue;
    out.push(STRINGS.effects[k].replace('{v}', amount(k, v)));
  }
  return out;
}

/** Where an experience bar stands a fraction `t` (0..1) of the way through a gain. */
export interface XpPoint {
  level: number;
  xp: number;
  needed: number;
}

/** Replays a gain along a 0..1 timeline: the bar fills, wraps at each level and ends where the gain ended. */
export function xpAt(g: XpGain, t: number): XpPoint {
  if (t >= 1) return { level: g.toLevel, xp: g.toXp, needed: xpToNext(g.toLevel) };
  let rest = g.amount * Math.max(0, t);
  let level = g.fromLevel;
  let xp = g.fromXp;
  while (level < g.toLevel && xp + rest >= xpToNext(level)) {
    rest -= xpToNext(level) - xp;
    level++;
    xp = 0;
  }
  xp = level >= LEVEL_CAP ? 0 : level === g.toLevel ? Math.min(g.toXp, xp + rest) : xp + rest;
  return { level, xp, needed: xpToNext(level) };
}

/** A character's upgrades for the sheet: one entry per upgrade, in the order first taken, with how often. */
export function upgradeTally(upgrades: readonly string[]): { id: string; count: number }[] {
  const out: { id: string; count: number }[] = [];
  for (const id of upgrades) {
    const e = out.find((x) => x.id === id);
    if (e) e.count++;
    else out.push({ id, count: 1 });
  }
  return out;
}

/** Play time for the ending summary: whole minutes, hours once past the hour ("42 min", "2 h 05 min"). */
export function formatPlayTime(ms: number): string {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}
