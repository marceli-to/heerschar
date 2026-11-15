import { EFFECT_CAPS, EFFECT_KEYS, LEVEL_CAP, sumEffects, xpToNext, type Effect, type EffectKey } from '../data/progression';
import { STRINGS } from '../data/strings';
import type { XpGain } from './game';
import { characterEffect, characterStatsWith } from './progression';
import type { Character } from './squad';

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

/** One "before → after" row: what a character has now and with the offered effect. */
export interface EffectChange {
  label: string;
  from: string;
  to: string;
}

/** Totals that read with a minus sign (less is the point). */
const LESS: ReadonlySet<EffectKey> = new Set(['toughness', 'cooldown']);
const SECONDS: ReadonlySet<EffectKey> = new Set(['control', 'slowOnHit', 'selfRally']);

function total(key: EffectKey, v: number): string {
  const cap = (EFFECT_CAPS as Partial<Record<EffectKey, number>>)[key];
  const n = cap === undefined ? v : Math.min(cap, v);
  if (SECONDS.has(key)) return `${amount(key, n)} s`;
  if (key === 'guardShield') return `${amount(key, n)}×`;
  const sign = n === 0 ? '' : LESS.has(key) ? '−' : '+';
  return `${sign}${amount(key, n)}%`;
}

/**
 * What an offered upgrade or path changes for this character, one row per part of the effect:
 * stats as fought (Health 420 → 470, Range 9 → 11 m), everything else as the running total
 * (Cooldowns −12% → −24%) once there is something to add to. Rows whose shown numbers would not
 * change are left out.
 */
export function effectChanges(c: Character, add: Effect): EffectChange[] {
  const now = characterStatsWith(c, {});
  const then = characterStatsWith(c, add);
  const effNow = characterEffect(c);
  const effThen = sumEffects([effNow, add]);
  const names = STRINGS.effectNames;
  const out: EffectChange[] = [];
  const row = (label: string, a: string, b: string) => {
    if (a !== b) out.push({ label, from: a, to: b });
  };
  for (const k of EFFECT_KEYS) {
    if (!add[k]) continue;
    switch (k) {
      case 'hp':
        row(names.hp, now.maxHp.toFixed(0), then.maxHp.toFixed(0));
        break;
      case 'power':
        row(names.power, now.power.toFixed(0), then.power.toFixed(0));
        break;
      case 'armor':
        row(names.armor, now.armor.toFixed(0), then.armor.toFixed(0));
        break;
      case 'resist':
        row(names.resist, now.resist.toFixed(0), then.resist.toFixed(0));
        break;
      case 'speed':
        row(names.speed, `${now.moveSpeed.toFixed(1)} m/s`, `${then.moveSpeed.toFixed(1)} m/s`);
        break;
      case 'range':
        row(names.range, `${now.range.toFixed(0)} m`, `${then.range.toFixed(0)} m`);
        break;
      case 'haste':
        // The hero attacks with the player's own chain, not on an interval.
        if (c.isHero) {
          if (effNow[k]) row(names.haste, total(k, effNow[k] ?? 0), total(k, effThen[k] ?? 0));
        }
        else row(names.attackInterval, `${now.attackInterval.toFixed(2)} s`, `${then.attackInterval.toFixed(2)} s`);
        break;
      default:
        // From nothing, the row would only repeat the effect line.
        if (effNow[k]) row(names[k], total(k, effNow[k] ?? 0), total(k, effThen[k] ?? 0));
    }
  }
  return out;
}
